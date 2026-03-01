import { randomUUID } from "node:crypto";
import { renderMetadataBlock } from "../github/metadata.js";
import type {
  AgentDecision,
  BuilderOutput,
  PolicyResult,
  TestPlan,
  WorkItem
} from "../types/contracts.js";

function defaultTestPlan(workItem: WorkItem): TestPlan {
  return {
    unit: [`Add unit test coverage for ${workItem.title}`],
    integration: ["Validate API and persistence behavior"],
    e2e: ["Validate user-facing critical path"],
    flakyRisk: workItem.risk === "high" ? "high" : "medium"
  };
}

export class BuilderAgent {
  build(workItem: WorkItem): BuilderOutput {
    const runId = randomUUID().slice(0, 8);
    const branchName = `codex/agent/${workItem.issueId}/${runId}`;

    const initialPolicy: PolicyResult = {
      allowed: false,
      violations: ["Awaiting reviewer policy evaluation"],
      requiredChecks: [
        "typecheck",
        "lint",
        "unit",
        "integration",
        "security",
        "agentReview"
      ]
    };

    const testPlan = defaultTestPlan(workItem);

    const metadata = {
      workItemId: workItem.issueId,
      risk: workItem.risk,
      testPlan: [...testPlan.unit, ...testPlan.integration, ...testPlan.e2e],
      rollbackPlan: [
        "Rollback deployment to previous release",
        "Reopen issue with incident template",
        "Attach failed canary metrics"
      ],
      policyResult: initialPolicy
    };

    const decision: AgentDecision = {
      workItemId: workItem.issueId,
      agent: "builder",
      action: "create-branch-and-pr",
      reason: `Prepared branch ${branchName} and PR metadata`,
      confidence: 0.81,
      requiresHumanApproval: workItem.risk === "high"
    };

    return {
      branchName,
      commitMessage: `feat(agent): implement #${workItem.issueId} - ${workItem.title}`,
      prTitle: `[Agent] ${workItem.title}`,
      prBodySections: [
        "## Summary",
        "Implemented via autonomous builder agent",
        "## Test Plan",
        ...metadata.testPlan,
        "## Rollback Plan",
        ...metadata.rollbackPlan,
        renderMetadataBlock(metadata)
      ],
      metadata,
      decision
    };
  }
}
