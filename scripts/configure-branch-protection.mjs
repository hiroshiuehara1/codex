import { spawnSync } from "node:child_process";

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) {
    return fallback;
  }
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const repo = arg("--repo", process.env.GITHUB_REPOSITORY);
const branch = arg("--branch", "main");
const checksRaw = arg("--checks", "validate,pr-metadata,reviewer-gate");
const strict = arg("--strict", "true") !== "false";
const dryRun = hasFlag("--dry-run");

if (!repo) {
  process.stderr.write("Missing repository. Provide --repo owner/name or GITHUB_REPOSITORY.\n");
  process.exit(1);
}

const requiredChecks = checksRaw
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (requiredChecks.length === 0) {
  process.stderr.write("At least one required status check must be configured.\n");
  process.exit(1);
}

const payload = {
  required_status_checks: {
    strict,
    contexts: requiredChecks
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 1,
    require_last_push_approval: false
  },
  restrictions: null,
  required_linear_history: true,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true,
  lock_branch: false,
  allow_fork_syncing: true
};

if (dryRun) {
  process.stdout.write(`${JSON.stringify({ repo, branch, payload }, null, 2)}\n`);
  process.exit(0);
}

const result = spawnSync(
  "gh",
  [
    "api",
    "--method",
    "PUT",
    `repos/${repo}/branches/${branch}/protection`,
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
    "--input",
    "-"
  ],
  {
    stdio: ["pipe", "inherit", "inherit"],
    input: JSON.stringify(payload)
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
