import { describe, expect, it } from "vitest";
import { extractTable, splitStatements } from "../src/sql.js";

describe("SQL utilities", () => {
  it("does not split semicolons in strings, comments, or dollar blocks", () => {
    const sql = `
      -- ignored ;
      INSERT INTO notes(body) VALUES ('hello; world');
      DO $$ BEGIN RAISE NOTICE 'x;y'; END $$;
      ALTER TABLE public.users ADD COLUMN active boolean;
    `;
    expect(splitStatements(sql)).toHaveLength(3);
    expect(splitStatements(sql).map((item) => item.line)).toEqual([3, 4, 5]);
  });

  it("extracts qualified and quoted table names", () => {
    expect(extractTable('ALTER TABLE "public"."Orders" ADD COLUMN x int;')).toBe("public.orders");
    expect(extractTable("CREATE INDEX idx ON users(email);")).toBe("users");
  });
});
