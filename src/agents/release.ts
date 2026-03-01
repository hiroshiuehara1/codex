import { CANARY_GUARDS } from "../config/policy.js";
import type {
  AgentDecision,
  ReleaseInput,
  ReleaseOutput
} from "../types/contracts.js";

function canaryFailureReason(input: ReleaseInput): string | null {
  const { metrics } = input;

  if (!metrics.smokeTestsPassed) {
    return "Smoke tests failed";
  }

  if (input.stage === "canary") {
    if (metrics.canaryTrafficPct < 10) {
      return `Canary traffic ${metrics.canaryTrafficPct}% below minimum 10%`;
    }

    if (metrics.canaryDurationMinutes < 30) {
      return `Canary duration ${metrics.canaryDurationMinutes}m below minimum 30m`;
    }
  }

  if (metrics.errorRatePct > CANARY_GUARDS.maxErrorRatePct) {
    return `Error rate ${metrics.errorRatePct}% above ${CANARY_GUARDS.maxErrorRatePct}%`;
  }

  if (metrics.latencyP95Ms > CANARY_GUARDS.maxLatencyP95Ms) {
    return `Latency p95 ${metrics.latencyP95Ms}ms above ${CANARY_GUARDS.maxLatencyP95Ms}ms`;
  }

  if (metrics.failedRequests > CANARY_GUARDS.maxFailedRequests) {
    return `Failed requests ${metrics.failedRequests} above ${CANARY_GUARDS.maxFailedRequests}`;
  }

  if (metrics.businessKpiDropPct > CANARY_GUARDS.maxBusinessKpiDropPct) {
    return `Business KPI drop ${metrics.businessKpiDropPct}% above ${CANARY_GUARDS.maxBusinessKpiDropPct}%`;
  }

  return null;
}

export class ReleaseAgent {
  release(input: ReleaseInput): ReleaseOutput {
    const failedReason = canaryFailureReason(input);

    if (failedReason) {
      const decision: AgentDecision = {
        workItemId: input.workItem.issueId,
        agent: "release",
        action: "rollback",
        reason: `Canary/stage guardrail breached: ${failedReason}`,
        confidence: 0.97,
        requiresHumanApproval: true
      };

      return {
        promoted: false,
        nextStage: "rollback",
        reason: failedReason,
        decision
      };
    }

    const nextStage =
      input.stage === "staging"
        ? "canary"
        : input.stage === "canary"
          ? "full"
          : "full";

    const decision: AgentDecision = {
      workItemId: input.workItem.issueId,
      agent: "release",
      action: input.stage === "full" ? "release-complete" : `promote-to-${nextStage}`,
      reason: `Health checks passed for ${input.stage}`,
      confidence: 0.88,
      requiresHumanApproval: false
    };

    return {
      promoted: true,
      nextStage,
      reason: "All release guardrails satisfied",
      decision
    };
  }
}
