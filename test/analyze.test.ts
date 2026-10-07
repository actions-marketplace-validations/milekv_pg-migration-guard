import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import type { DatabaseContext } from "../src/types.js";

const largeDatabase: DatabaseContext = {
  serverVersion: 170000,
  tables: new Map([
    ["orders", { schema: "public", table: "orders", bytes: 12 * 1024 ** 3, estimatedRows: 25_000_000 }],
  ]),
};

describe("analyze", () => {
  it("finds high-impact risks and uses database context", () => {
    const result = analyze([{ path: "001.sql", sql: `
      CREATE INDEX orders_customer_idx ON orders(customer_id);
      ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
    ` }], largeDatabase);

    expect(result.findings.map((item) => item.rule)).toEqual([
      "index-not-concurrent",
      "set-not-null",
      "missing-lock-timeout",
    ]);
    expect(result.findings[0]?.severity).toBe("error");
    expect(result.findings[0]?.context?.estimatedRows).toBe(25_000_000);
  });

  it("rejects concurrent indexes inside transactions", () => {
    const result = analyze([{ path: "002.sql", sql: "BEGIN; CREATE INDEX CONCURRENTLY idx ON users(email); COMMIT;" }]);
    expect(result.findings.some((item) => item.rule === "concurrent-index-in-transaction")).toBe(true);
  });

  it("accepts a safe concurrent index migration", () => {
    const result = analyze([{ path: "003.sql", sql: "CREATE INDEX CONCURRENTLY users_email_idx ON users(email);" }]);
    expect(result.findings).toEqual([]);
  });

  it("does not require concurrent indexes for a table created in the same migration", () => {
    const result = analyze([{ path: "003.sql", sql: `
      CREATE TABLE users (id bigint primary key, email text);
      CREATE INDEX users_email_idx ON users(email);
    ` }]);
    expect(result.findings).toEqual([]);
  });

  it("flags destructive changes and volatile defaults", () => {
    const result = analyze([{ path: "004.sql", sql: `
      ALTER TABLE users ADD COLUMN token uuid DEFAULT gen_random_uuid();
      ALTER TABLE users DROP COLUMN legacy_name;
    ` }]);
    expect(result.findings.map((item) => item.rule)).toContain("volatile-default");
    expect(result.findings.map((item) => item.rule)).toContain("destructive-change");
    expect(result.findings.filter((item) => item.rule === "missing-lock-timeout")).toHaveLength(1);
  });

  it("does not treat dropping a constraint as dropping data", () => {
    const result = analyze([{ path: "005.sql", sql: `
      SET lock_timeout = '3s';
      ALTER TABLE users DROP CONSTRAINT users_email_check;
    ` }]);

    expect(result.findings.some((item) => item.rule === "destructive-change")).toBe(false);
  });
});
