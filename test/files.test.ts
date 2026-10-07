import { describe, expect, it } from "vitest";
import { expandPaths } from "../src/files.js";

describe("expandPaths", () => {
  it("expands recursive SQL globs without third-party glob code", async () => {
    const paths = await expandPaths(["examples/**/*.sql"]);
    expect(paths).toContain("examples/risky.sql");
  });

  it("accepts an exact file", async () => {
    expect(await expandPaths(["examples/risky.sql"])).toEqual(["examples/risky.sql"]);
  });
});
