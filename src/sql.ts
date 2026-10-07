export interface SqlStatement {
  text: string;
  line: number;
}

export function splitStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let dollarTag: string | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "\n") lineComment = false;
    if (lineComment) continue;
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && !dollarTag && char === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!quote && !dollarTag && char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (!quote && !dollarTag && char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        index += match[0].length - 1;
        continue;
      }
    } else if (dollarTag && sql.startsWith(dollarTag, index)) {
      index += dollarTag.length - 1;
      dollarTag = null;
      continue;
    }
    if (dollarTag) continue;
    if ((char === "'" || char === '"') && (!quote || quote === char)) {
      if (quote === char && next === char) {
        index += 1;
        continue;
      }
      quote = quote === char ? null : char;
      continue;
    }
    if (!quote && char === ";") {
      const raw = sql.slice(start, index + 1);
      const text = raw.trim();
      if (text) statements.push({ text, line: statementLine(sql, start, raw) });
      start = index + 1;
    }
  }

  const raw = sql.slice(start);
  const rest = raw.trim();
  if (rest) statements.push({ text: rest, line: statementLine(sql, start, raw) });
  return statements;
}

function statementLine(sql: string, start: number, raw: string): number {
  const leading = raw.match(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/)?.[0].length ?? 0;
  return 1 + (sql.slice(0, start + leading).match(/\n/g)?.length ?? 0);
}

export function normalizeIdentifier(value: string): string {
  return value.replace(/^"|"$/g, "").toLowerCase();
}

export function extractTable(statement: string): string | undefined {
  const match = statement.match(
    /\b(?:ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+[^\s]+\s+ON)\s+(?:IF\s+EXISTS\s+)?((?:"[^"]+"|[\w$]+)(?:\.(?:"[^"]+"|[\w$]+))?)/i,
  );
  return match?.[1]
    ?.split(".")
    .map(normalizeIdentifier)
    .join(".");
}

export function extractCreatedTable(statement: string): string | undefined {
  const match = statement.match(/\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+((?:"[^"]+"|[\w$]+)(?:\.(?:"[^"]+"|[\w$]+))?)/i);
  return match?.[1]
    ?.split(".")
    .map(normalizeIdentifier)
    .join(".");
}
