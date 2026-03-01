import assert from "node:assert/strict";
import test from "node:test";
import { ReleaseAgent } from "../../src/agents/release.js";

const release = new ReleaseAgent();

const workItem = {
  issueId: 11,
  repo: "local/repo",
  title: "Release candidate",
  acceptanceCriteria: ["ok"],
  workType: "feature" as const,
  risk: "medium" as const,
  status: "releasing" as const
};

test("promotes canary when healthy", () => {
  const output = release.release({
    workItem,
    stage: "canary",
    metrics: {
      smokeTestsPassed: true,
      canaryDurationMinutes: 30,
      canaryTrafficPct: 10,
      errorRatePct: 0.3,
      latencyP95Ms: 250,
      failedRequests: 5,
      businessKpiDropPct: 0.2
    }
  });

  assert.equal(output.promoted, true);
  assert.equal(output.nextStage, "full");
});

test("rolls back when canary thresholds fail", () => {
  const output = release.release({
    workItem,
    stage: "canary",
    metrics: {
      smokeTestsPassed: true,
      canaryDurationMinutes: 30,
      canaryTrafficPct: 10,
      errorRatePct: 4,
      latencyP95Ms: 900,
      failedRequests: 60,
      businessKpiDropPct: 8
    }
  });

  assert.equal(output.promoted, false);
  assert.equal(output.nextStage, "rollback");
});

test("rolls back when canary window is too short", () => {
  const output = release.release({
    workItem,
    stage: "canary",
    metrics: {
      smokeTestsPassed: true,
      canaryDurationMinutes: 12,
      canaryTrafficPct: 10,
      errorRatePct: 0.2,
      latencyP95Ms: 220,
      failedRequests: 3,
      businessKpiDropPct: 0.1
    }
  });

  assert.equal(output.promoted, false);
  assert.equal(output.nextStage, "rollback");
  assert.ok(output.reason.includes("duration"));
});
