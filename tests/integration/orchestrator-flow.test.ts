import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentOrchestrator } from "../../src/orchestrator/agent-orchestrator.js";

async function createOrchestrator() {
  const dir = await mkdtemp(join(tmpdir(), "codex-agentic-"));
  return AgentOrchestrator.create({
    logPath: join(dir, "decisions.log.ndjson"),
    idempotencyPath: join(dir, "idempotency.json")
  });
}

test("full low-risk flow can reach release and healthy monitoring", async () => {
  const orchestrator = await createOrchestrator();

  const issueRun = await orchestrator.runIssue({
    issueId: 300,
    repo: "local/repo",
    title: "Add profile endpoint",
    body: "- [ ] Add endpoint\n- [ ] Add tests",
    labels: ["agent:ready"]
  });

  assert.equal(issueRun.duplicate, false);
  assert.notEqual(issueRun.builder, null);
  assert.notEqual(issueRun.tester, null);

  const review = await orchestrator.review({
    workItem: issueRun.planner.workItem,
    checks: {
      typecheck: true,
      lint: true,
      unit: true,
      integration: true,
      security: true,
      agentReview: true
    },
    coverageDropPct: 0,
    manualOverride: false
  });

  assert.equal(review.policy.allowed, true);

  const release = await orchestrator.release({
    workItem: issueRun.planner.workItem,
    stage: "staging",
    metrics: {
      smokeTestsPassed: true,
      canaryDurationMinutes: 30,
      canaryTrafficPct: 10,
      errorRatePct: 0.4,
      latencyP95Ms: 240,
      failedRequests: 3,
      businessKpiDropPct: 0.2
    }
  });

  assert.equal(release.promoted, true);
  assert.equal(release.nextStage, "canary");

  const incident = await orchestrator.assessIncident(issueRun.planner.workItem, {
    service: "web-api",
    errorRatePct: 0.6,
    latencyP95Ms: 250,
    failedRequests: 5,
    businessKpiDropPct: 0.4
  });

  assert.equal(incident.shouldRollback, false);
});
