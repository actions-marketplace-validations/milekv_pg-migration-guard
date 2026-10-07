import { extractCreatedTable, extractTable, splitStatements } from "./sql.js";
import type { AnalysisResult, DatabaseContext, Finding, Severity, TableContext } from "./types.js";

export interface SourceFile {
  path: string;
  sql: string;
}

function tableContext(database: DatabaseContext | undefined, table: string | undefined): TableContext | undefined {
  if (!database || !table) return undefined;
  return database.tables.get(table) ?? database.tables.get(`public.${table}`);
}

function contextualSeverity(base: Severity, context: TableContext | undefined): Severity {
  if (!context) return base;
  if (context.bytes >= 10 * 1024 ** 3 || context.estimatedRows >= 10_000_000) return "error";
  if (context.bytes >= 1024 ** 3 || context.estimatedRows >= 1_000_000) return base === "info" ? "warning" : "error";
  return base;
}

function finding(
  rule: string,
  baseSeverity: Severity,
  file: string,
  line: number,
  table: string | undefined,
  context: TableContext | undefined,
  title: string,
  detail: string,
  suggestion: string,
  lock?: string,
): Finding {
  return {
    rule,
    severity: contextualSeverity(baseSeverity, context),
    file,
    line,
    table,
    title,
    detail,
    suggestion,
    lock,
    context: context ? { bytes: context.bytes, estimatedRows: context.estimatedRows } : undefined,
  };
}

export function analyze(files: SourceFile[], database?: DatabaseContext): AnalysisResult {
  const findings: Finding[] = [];
  let statementCount = 0;

  for (const file of files) {
    const statements = splitStatements(file.sql);
    statementCount += statements.length;
    const fullSql = statements.map((item) => item.text).join("\n");
    const usesTransaction = /\bBEGIN\b/i.test(fullSql);
    const hasLockTimeout = /\bSET\s+(?:LOCAL\s+)?lock_timeout\b/i.test(fullSql);
    const createdTables = new Set<string>();
    let reportedMissingLockTimeout = false;

    for (const statement of statements) {
      const sql = statement.text;
      const table = extractTable(sql);
      const context = tableContext(database, table);
      const createdTable = extractCreatedTable(sql);
      if (createdTable) {
        createdTables.add(createdTable);
        createdTables.add(createdTable.replace(/^public\./, ""));
      }

      if (/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(sql) && !/\bCONCURRENTLY\b/i.test(sql) && !createdTables.has(table ?? "")) {
        findings.push(finding("index-not-concurrent", "warning", file.path, statement.line, table, context,
          "Index creation can block writes",
          "A regular CREATE INDEX takes a SHARE lock and blocks INSERT, UPDATE, and DELETE until the build finishes.",
          "Use CREATE INDEX CONCURRENTLY outside a transaction for an existing production table.", "SHARE"));
      }
      if (/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(sql) && usesTransaction) {
        findings.push(finding("concurrent-index-in-transaction", "error", file.path, statement.line, table, context,
          "Concurrent index creation cannot run in a transaction",
          "PostgreSQL rejects CREATE INDEX CONCURRENTLY inside a transaction block.",
          "Run this statement as a non-transactional migration."));
      }
      if (/\bALTER\s+TABLE\b[\s\S]*\bALTER\s+(?:COLUMN\s+)?[^\s]+\s+SET\s+NOT\s+NULL\b/i.test(sql)) {
        findings.push(finding("set-not-null", "warning", file.path, statement.line, table, context,
          "SET NOT NULL may scan the entire table",
          "Validation can be slow on a populated table and the final change requires an ACCESS EXCLUSIVE lock.",
          "Add a CHECK (column IS NOT NULL) NOT VALID, validate it separately, then set NOT NULL.", "ACCESS EXCLUSIVE"));
      }
      if (/\bALTER\s+TABLE\b[\s\S]*\bALTER\s+(?:COLUMN\s+)?[^\s]+\s+(?:TYPE|SET\s+DATA\s+TYPE)\b/i.test(sql)) {
        findings.push(finding("alter-column-type", "error", file.path, statement.line, table, context,
          "Column type change may rewrite the table",
          "Many type conversions rewrite every row while holding an ACCESS EXCLUSIVE lock.",
          "Use an expand and contract migration: add a new column, backfill in batches, dual-write, then switch reads.", "ACCESS EXCLUSIVE"));
      }
      if (/\bALTER\s+TABLE\b[\s\S]*\bADD\s+(?:COLUMN\s+)?[^;]+\bDEFAULT\s+(?:now\s*\(|clock_timestamp\s*\(|random\s*\(|gen_random_uuid\s*\()/i.test(sql)) {
        findings.push(finding("volatile-default", "error", file.path, statement.line, table, context,
          "Volatile default can rewrite existing rows",
          "A volatile default must be evaluated for existing rows and can turn a metadata-only change into a table rewrite.",
          "Add the nullable column first, backfill in batches, then add the default for new rows."));
      }
      if (/\bALTER\s+TABLE\b[\s\S]*\bADD\s+(?:CONSTRAINT\s+[^\s]+\s+)?FOREIGN\s+KEY\b/i.test(sql) && !/\bNOT\s+VALID\b/i.test(sql)) {
        findings.push(finding("foreign-key-validates-immediately", "warning", file.path, statement.line, table, context,
          "Foreign key validates existing rows immediately",
          "Immediate validation scans existing data and can hold locks longer than expected.",
          "Add the foreign key as NOT VALID and run VALIDATE CONSTRAINT separately."));
      }
      if (/\bDROP\s+(?:TABLE|COLUMN)\b/i.test(sql) || /\bALTER\s+TABLE\b[\s\S]*\bDROP\s+(?:COLUMN\s+)?/i.test(sql)) {
        findings.push(finding("destructive-change", "error", file.path, statement.line, table, context,
          "Destructive schema change",
          "Dropping a table or column can break older application versions and permanently remove data.",
          "Use a staged expand and contract rollout and remove the object only after all consumers stop using it.", "ACCESS EXCLUSIVE"));
      }
      if (/\bALTER\s+TABLE\b/i.test(sql) && !hasLockTimeout && !reportedMissingLockTimeout) {
        findings.push(finding("missing-lock-timeout", "info", file.path, statement.line, table, context,
          "Migration has no lock timeout",
          "Without lock_timeout, a migration can wait indefinitely while blocking later work in the deployment queue.",
          "Set a short lock_timeout before the change and retry the migration if the lock cannot be acquired."));
        reportedMissingLockTimeout = true;
      }
    }
  }

  return {
    findings,
    files: files.length,
    statements: statementCount,
    databaseConnected: Boolean(database),
  };
}
