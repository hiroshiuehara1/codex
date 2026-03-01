import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOTS = ["src", "tests"];
const FAIL_PATTERNS = [
  { regex: /\t/g, message: "Tab character found" },
  { regex: /TODO:/g, message: "TODO marker found" }
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const next = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(next)));
      continue;
    }
    if (entry.isFile() && next.endsWith(".ts")) {
      files.push(next);
    }
  }

  return files;
}

const findings = [];
for (const root of ROOTS) {
  const files = await walk(root);
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    for (const pattern of FAIL_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push(`${file}: ${pattern.message}`);
      }
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exit(1);
}
