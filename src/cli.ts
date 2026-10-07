#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { analyze } from "./analyze.js";
import { expandPaths } from "./files.js";
import { formatGithub, formatText } from "./format.js";
import { inspectDatabase } from "./introspect.js";

const program = new Command();
program
  .name("pg-migration-guard")
  .description("Preflight safety checks for PostgreSQL migrations")
  .version("0.1.1")
  .argument("<paths...>", "SQL files or glob patterns")
  .option("--database-url <url>", "read-only PostgreSQL connection URL (or set DATABASE_URL)")
  .option("--format <format>", "text, json, or github", "text")
  .option("--fail-on <level>", "error, warning, or never", "error")
  .action(async (patterns: string[], options: { databaseUrl?: string; format: string; failOn: string }) => {
    const paths = await expandPaths(patterns);
    if (paths.length === 0) throw new Error(`No SQL files matched: ${patterns.join(", ")}`);
    const files = await Promise.all(paths.map(async (path) => ({ path, sql: await readFile(path, "utf8") })));
    const connectionString = options.databaseUrl ?? process.env.DATABASE_URL;
    const database = connectionString ? await inspectDatabase(connectionString) : undefined;
    const result = analyze(files, database);

    if (options.format === "json") console.log(JSON.stringify(result, null, 2));
    else if (options.format === "github") console.log(formatGithub(result));
    else if (options.format === "text") console.log(formatText(result));
    else throw new Error(`Unsupported format: ${options.format}`);

    const hasError = result.findings.some((item) => item.severity === "error");
    const hasWarning = result.findings.some((item) => item.severity === "warning");
    if (options.failOn === "error" && hasError) process.exitCode = 1;
    if (options.failOn === "warning" && (hasError || hasWarning)) process.exitCode = 1;
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`pg-migration-guard: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
