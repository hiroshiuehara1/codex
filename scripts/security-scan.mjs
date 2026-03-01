import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SECRET_PATTERNS = [
  { regex: /AKIA[0-9A-Z]{16}/g, message: "Possible AWS access key" },
  { regex: /ghp_[A-Za-z0-9]{36}/g, message: "Possible GitHub PAT" },
  { regex: /BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/g, message: "Possible private key" }
];

const MAX_CVSS = Number(process.env.MAX_CVSS ?? "7");
const DEPENDENCY_REPORT_PATH = "reports/dependency-report.json";
const IGNORE_DIRS = new Set([".git", "node_modules", "dist"]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const next = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(next)));
      continue;
    }

    if (entry.isFile()) {
      files.push(next);
    }
  }

  return files;
}

const secretFindings = [];
const files = await walk(".");
for (const file of files) {
  const content = await readFile(file, "utf-8").catch(() => "");
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(content)) {
      secretFindings.push(`${file}: ${pattern.message}`);
    }
  }
}

const dependencyFindings = [];
if (await exists(DEPENDENCY_REPORT_PATH)) {
  const report = JSON.parse(await readFile(DEPENDENCY_REPORT_PATH, "utf-8"));
  const findings = Array.isArray(report.findings) ? report.findings : [];
  for (const finding of findings) {
    const cvss = Number(finding.cvss ?? 0);
    if (cvss >= MAX_CVSS) {
      dependencyFindings.push(
        `${finding.package ?? "unknown"} (${finding.cve ?? "unknown"}) CVSS ${cvss}`
      );
    }
  }
}

const all = [...secretFindings, ...dependencyFindings];
if (all.length > 0) {
  process.stderr.write(`${all.join("\n")}\n`);
  process.exit(1);
}
