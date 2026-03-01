import {
  COVERAGE_DROP_BUDGET_PCT,
  REQUIRED_CHECKS
} from "../config/policy.js";
import type {
  AgentDecision,
  PolicyResult,
  ReviewInput,
  ReviewOutput
} from "../types/contracts.js";

function missingChecks(checks: ReviewInput["checks"]): string[] {
  return REQUIRED_CHECKS.filter((name) => checks[name] !== true);
}

export class ReviewerAgent {
  review(input: ReviewInput): ReviewOutput {
    const violations = [...(input.additionalViolations ?? [])];
    const missing = missingChecks(input.checks);

    if (missing.length > 0) {
      violations.push(`Missing required checks: ${missing.join(", ")}`);
    }

    if (input.coverageDropPct > COVERAGE_DROP_BUDGET_PCT) {
      violations.push(
        `Coverage drop ${input.coverageDropPct.toFixed(2)}% exceeds budget ${COVERAGE_DROP_BUDGET_PCT}%`
      );
    }

    if (input.workItem.risk === "high" && !input.manualOverride) {
      violations.push("High-risk work requires explicit human approval");
    }

    const policy: PolicyResult = {
      allowed: violations.length === 0,
      violations,
      requiredChecks: [...REQUIRED_CHECKS]
    };

    const decision: AgentDecision = {
      workItemId: input.workItem.issueId,
      agent: "reviewer",
      action: policy.allowed ? "auto-merge-allowed" : "hold-merge",
      reason: policy.allowed
        ? "All required checks passed and risk policy satisfied"
        : `Merge blocked: ${violations.join("; ")}`,
      confidence: policy.allowed ? 0.9 : 0.95,
      requiresHumanApproval:
        input.workItem.risk === "high" || input.manualOverride || !policy.allowed
    };

    return {
      policy,
      decision,
      missingChecks: missing
    };
  }
}
