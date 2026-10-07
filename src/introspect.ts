import { Client } from "pg";
import type { DatabaseContext, TableContext } from "./types.js";

interface TableRow {
  schema_name: string;
  table_name: string;
  bytes: string;
  estimated_rows: string;
}

export async function inspectDatabase(connectionString: string): Promise<DatabaseContext> {
  const client = new Client({
    connectionString,
    application_name: "pg-migration-guard",
    statement_timeout: 5000,
    query_timeout: 7000,
  });

  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const versionResult = await client.query<{ server_version_num: string }>(
      "SELECT current_setting('server_version_num') AS server_version_num",
    );
    const tableResult = await client.query<TableRow>(`
      SELECT
        namespace.nspname AS schema_name,
        relation.relname AS table_name,
        pg_total_relation_size(relation.oid)::text AS bytes,
        greatest(relation.reltuples, 0)::bigint::text AS estimated_rows
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE relation.relkind IN ('r', 'p')
        AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
    `);
    await client.query("ROLLBACK");

    const tables = new Map<string, TableContext>();
    for (const row of tableResult.rows) {
      const context = {
        schema: row.schema_name,
        table: row.table_name,
        bytes: Number(row.bytes),
        estimatedRows: Number(row.estimated_rows),
      };
      tables.set(`${context.schema}.${context.table}`.toLowerCase(), context);
      if (context.schema === "public") tables.set(context.table.toLowerCase(), context);
    }
    return {
      serverVersion: Number(versionResult.rows[0]?.server_version_num ?? 0),
      tables,
    };
  } finally {
    await client.end();
  }
}
