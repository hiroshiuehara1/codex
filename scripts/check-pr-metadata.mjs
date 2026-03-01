import { readFile } from "node:fs/promises";

const START = "<!-- agent-metadata:start -->";
const END = "<!-- agent-metadata:end -->";
const REQUIRED_TOP_LEVEL = [
  "workItemId",
  "risk",
  "testPlan",
  "rollbackPlan",
  "policyResult"
];

function arg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function parseBody(body) {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }

  const json = body.slice(start + START.length, end).trim();
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function loadBody() {
  if (process.env.PR_BODY) {
    return process.env.PR_BODY;
  }

  const path = process.env.PR_BODY_PATH ?? arg("--file");
  if (!path) {
    return "";
  }

  return readFile(path, "utf-8").catch(() => "");
}

const body = await loadBody();
const metadata = parseBody(body);
if (!metadata) {
  process.stderr.write("Missing or invalid agent metadata block in PR body\n");
  process.exit(1);
}

const missing = REQUIRED_TOP_LEVEL.filter((key) => !(key in metadata));
if (missing.length > 0) {
  process.stderr.write(`PR metadata is missing keys: ${missing.join(", ")}\n`);
  process.exit(1);
}

if (!Array.isArray(metadata.testPlan) || metadata.testPlan.length === 0) {
  process.stderr.write("PR metadata testPlan must be a non-empty array\n");
  process.exit(1);
}

if (!Array.isArray(metadata.rollbackPlan) || metadata.rollbackPlan.length === 0) {
  process.stderr.write("PR metadata rollbackPlan must be a non-empty array\n");
  process.exit(1);
}
