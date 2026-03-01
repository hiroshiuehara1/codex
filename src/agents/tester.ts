import type {
  AgentDecision,
  TestOutput,
  TestPlan,
  WorkItem
} from "../types/contracts.js";

export class TestAgent {
  createPlan(workItem: WorkItem): TestOutput {
    const depth = workItem.risk === "high" ? "deep" : "standard";

    const testPlan: TestPlan = {
      unit: [
        `Cover happy path for issue #${workItem.issueId}`,
        "Cover failure path and validation branches"
      ],
      integration: [
        "Exercise API contract and persistence interactions",
        "Verify backward compatibility with existing endpoints"
      ],
      e2e: [
        "Validate core user flow in staging",
        "Verify release smoke test"
      ],
      flakyRisk: workItem.risk === "high" ? "high" : "medium"
    };

    const decision: AgentDecision = {
      workItemId: workItem.issueId,
      agent: "tester",
      action: "generate-test-plan",
      reason: `Generated ${depth} coverage plan for ${workItem.risk}-risk work`,
      confidence: 0.8,
      requiresHumanApproval: false
    };

    return {
      testPlan,
      decision
    };
  }
}
