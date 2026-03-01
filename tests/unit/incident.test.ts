import assert from "node:assert/strict";
import test from "node:test";
import { IncidentAgent } from "../../src/agents/incident.js";

const incident = new IncidentAgent();

const workItem = {
  issueId: 12,
  repo: "local/repo",
  title: "Deployed feature",
  acceptanceCriteria: ["ok"],
  workType: "feature" as const,
  risk: "medium" as const,
  status: "done" as const
};

test("triggers rollback for incident threshold breach", () => {
  const output = incident.assess(workItem, {
    service: "web-api",
    errorRatePct: 4,
    latencyP95Ms: 900,
    failedRequests: 80,
    businessKpiDropPct: 6
  });

  assert.equal(output.shouldRollback, true);
  assert.ok(output.incidentTitle.includes("AutoRollback"));
});

test("keeps deployment when healthy", () => {
  const output = incident.assess(workItem, {
    service: "web-api",
    errorRatePct: 0.5,
    latencyP95Ms: 220,
    failedRequests: 4,
    businessKpiDropPct: 0.3
  });

  assert.equal(output.shouldRollback, false);
});
