import type { AnalysisResult, Finding } from "./types.js";

const icons = { error: "x", warning: "!", info: "i" } as const;

function bytes(value: number): string {
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function contextLine(item: Finding): string {
  if (!item.context) return "";
  return `\n   Database context: ${bytes(item.context.bytes)}, ~${item.context.estimatedRows.toLocaleString("en-US")} rows`;
}

export function formatText(result: AnalysisResult): string {
  if (result.findings.length === 0) {
    return `OK - ${result.statements} statements in ${result.files} files passed all checks.`;
  }
  const items = result.findings.map((item) =>
    `${icons[item.severity]} ${item.severity.toUpperCase()} ${item.file}:${item.line} [${item.rule}]\n` +
    `   ${item.title}${item.table ? ` on ${item.table}` : ""}${item.lock ? ` - lock: ${item.lock}` : ""}\n` +
    `   ${item.detail}${contextLine(item)}\n` +
    `   Fix: ${item.suggestion}`,
  );
  const errors = result.findings.filter((item) => item.severity === "error").length;
  const warnings = result.findings.filter((item) => item.severity === "warning").length;
  return `${items.join("\n\n")}\n\n${errors} errors, ${warnings} warnings, ${result.findings.length} total findings.`;
}

export function formatGithub(result: AnalysisResult): string {
  return result.findings.map((item) => {
    const command = item.severity === "error" ? "error" : "warning";
    const title = encodeURIComponent(`${item.rule}: ${item.title}`);
    return `::${command} file=${item.file},line=${item.line},title=${title}::${item.detail} Fix: ${item.suggestion}`;
  }).join("\n");
}
