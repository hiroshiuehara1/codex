import { spawnSync } from "node:child_process";

const labels = [
  ["agent:queued", "0E8A16", "Queued for planner agent"],
  ["agent:in-progress", "1D76DB", "Agent execution in progress"],
  ["agent:blocked", "D73A49", "Blocked by policy or dependency"],
  ["agent:review", "FBCA04", "Ready for reviewer agent"],
  ["agent:release", "5319E7", "Ready for release agent"],
  ["agent:done", "0E8A16", "Completed by agent flow"],
  ["risk:low", "0E8A16", "Low-risk work item"],
  ["risk:medium", "FBCA04", "Medium-risk work item"],
  ["risk:high", "D73A49", "High-risk work item"],
  ["autonomy:auto", "1D76DB", "Agent can proceed autonomously"],
  ["autonomy:needs-human", "B60205", "Human approval required"]
];

for (const [name, color, description] of labels) {
  const result = spawnSync(
    "gh",
    ["label", "create", name, "--color", color, "--description", description, "--force"],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
