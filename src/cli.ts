#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { analyze } from "./analyze.js";
import { changedSqlFilesSince, expandPaths, filterChangedPaths } from "./files.js";
import { formatGithub, formatText } from "./format.js";
import { inspectDatabase } from "./introspect.js";

const program = new Command();
program
  .name("pg-migration-guard")
  .description("Preflight safety checks for PostgreSQL migrations")
  .version("0.2.0")
  .argument("<paths...>", "SQL files or glob patterns")
  .option("--database-url <url>", "read-only PostgreSQL connection URL (or set DATABASE_URL)")
  .option("--changed-since <ref>", "check only SQL files changed since a Git reference")
  .option("--format <format>", "text, json, or github", "text")
  .option("--fail-on <level>", "error, warning, or never", "error")
  .action(async (patterns: string[], options: { databaseUrl?: string; changedSince?: string; format: string; failOn: string }) => {
    if (!["text", "json", "github"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
    if (!["error", "warning", "never"].includes(options.failOn)) throw new Error(`Unsupported failure level: ${options.failOn}`);

    const matchedPaths = await expandPaths(patterns);
    if (matchedPaths.length === 0) throw new Error(`No SQL files matched: ${patterns.join(", ")}`);
    const paths = options.changedSince
      ? filterChangedPaths(matchedPaths, await changedSqlFilesSince(options.changedSince))
      : matchedPaths;
    const files = await Promise.all(paths.map(async (path) => ({ path, sql: await readFile(path, "utf8") })));
    const connectionString = options.databaseUrl ?? process.env.DATABASE_URL;
    const database = connectionString ? await inspectDatabase(connectionString) : undefined;
    const result = analyze(files, database);

    if (options.format === "json") console.log(JSON.stringify(result, null, 2));
    else if (options.format === "github") console.log(formatGithub(result));
    else console.log(formatText(result));

    const hasError = result.findings.some((item) => item.severity === "error");
    const hasWarning = result.findings.some((item) => item.severity === "warning");
    if (options.failOn === "error" && hasError) process.exitCode = 1;
    if (options.failOn === "warning" && (hasError || hasWarning)) process.exitCode = 1;
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`pg-migration-guard: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
