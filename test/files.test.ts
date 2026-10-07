import { describe, expect, it } from "vitest";
import { expandPaths, filterChangedPaths } from "../src/files.js";

describe("expandPaths", () => {
  it("expands recursive SQL globs without third-party glob code", async () => {
    const paths = await expandPaths(["examples/**/*.sql"]);
    expect(paths).toContain("examples/risky.sql");
  });

  it("accepts an exact file", async () => {
    expect(await expandPaths(["examples/risky.sql"])).toEqual(["examples/risky.sql"]);
  });

  it("keeps only changed files within the requested paths", () => {
    expect(filterChangedPaths(
      ["migrations/001.sql", "migrations/002.sql", "docs/example.sql"],
      ["migrations/002.sql", "src/index.ts"],
    )).toEqual(["migrations/002.sql"]);
  });

  it("normalizes changed paths from Windows", () => {
    expect(filterChangedPaths(
      ["migrations/002.sql"],
      ["migrations\\002.sql"],
    )).toEqual(["migrations/002.sql"]);
  });
});
