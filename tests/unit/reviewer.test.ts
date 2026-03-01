import assert from "node:assert/strict";
import test from "node:test";
import { ReviewerAgent } from "../../src/agents/reviewer.js";

const reviewer = new ReviewerAgent();

const baseWorkItem = {
  issueId: 9,
  repo: "local/repo",
  title: "Ship feature",
  acceptanceCriteria: ["done"],
  workType: "feature" as const,
  risk: "low" as const,
  status: "reviewing" as const
};

const allChecks = {
  typecheck: true,
  lint: true,
  unit: true,
  integration: true,
  security: true,
  agentReview: true
};

test("allows auto-merge for low risk and green checks", () => {
  const output = reviewer.review({
    workItem: baseWorkItem,
    checks: allChecks,
    coverageDropPct: 0,
    manualOverride: false
  });

  assert.equal(output.policy.allowed, true);
  assert.equal(output.decision.action, "auto-merge-allowed");
});

test("blocks high risk without manual override", () => {
  const output = reviewer.review({
    workItem: { ...baseWorkItem, risk: "high" },
    checks: allChecks,
    coverageDropPct: 0,
    manualOverride: false
  });

  assert.equal(output.policy.allowed, false);
  assert.ok(output.policy.violations.some((line) => line.includes("High-risk")));
});

test("blocks coverage drop above budget", () => {
  const output = reviewer.review({
    workItem: baseWorkItem,
    checks: allChecks,
    coverageDropPct: 2.1,
    manualOverride: false
  });

  assert.equal(output.policy.allowed, false);
  assert.ok(output.policy.violations.some((line) => line.includes("Coverage drop")));
});
