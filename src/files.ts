import { readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

function globRegex(pattern: string): RegExp {
  const normalized = pattern.replaceAll("\\", "/");
  let result = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      if (normalized[index + 2] === "/") {
        result += "(?:.*/)?";
        index += 2;
      } else {
        result += ".*";
        index += 1;
      }
    } else if (char === "*") result += "[^/]*";
    else if (char === "?") result += "[^/]";
    else result += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  return new RegExp(`${result}$`);
}

function staticBase(pattern: string): string {
  const firstGlob = pattern.search(/[?*]/);
  const prefix = firstGlob === -1 ? pattern : pattern.slice(0, firstGlob);
  const slash = Math.max(prefix.lastIndexOf("/"), prefix.lastIndexOf("\\"));
  return slash === -1 ? "." : prefix.slice(0, slash) || ".";
}

async function walk(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

export async function expandPaths(patterns: string[]): Promise<string[]> {
  const cwd = process.cwd();
  const output = new Set<string>();
  for (const pattern of patterns) {
    if (!/[?*]/.test(pattern)) {
      const path = resolve(pattern);
      const info = await stat(path);
      if (info.isDirectory()) {
        for (const file of await walk(path)) if (file.toLowerCase().endsWith(".sql")) output.add(relative(cwd, file).replaceAll(sep, "/"));
      } else output.add(relative(cwd, path).replaceAll(sep, "/"));
      continue;
    }
    const base = resolve(staticBase(pattern));
    const matcher = globRegex(pattern.replaceAll(sep, "/"));
    for (const file of await walk(base)) {
      const candidate = relative(cwd, file).replaceAll(sep, "/");
      if (matcher.test(candidate)) output.add(candidate);
    }
  }
  return [...output].sort();
}
