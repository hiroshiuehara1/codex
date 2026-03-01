import { INCIDENT_GUARDS } from "../config/policy.js";
import type {
  AgentDecision,
  IncidentOutput,
  IncidentSignal,
  WorkItem
} from "../types/contracts.js";

export class IncidentAgent {
  assess(workItem: WorkItem, signal: IncidentSignal): IncidentOutput {
    const breaches: string[] = [];

    if (signal.errorRatePct > INCIDENT_GUARDS.maxErrorRatePct) {
      breaches.push(`error rate ${signal.errorRatePct}%`);
    }

    if (signal.latencyP95Ms > INCIDENT_GUARDS.maxLatencyP95Ms) {
      breaches.push(`latency p95 ${signal.latencyP95Ms}ms`);
    }

    if (signal.failedRequests > INCIDENT_GUARDS.maxFailedRequests) {
      breaches.push(`failed requests ${signal.failedRequests}`);
    }

    if (signal.businessKpiDropPct > INCIDENT_GUARDS.maxBusinessKpiDropPct) {
      breaches.push(`business KPI drop ${signal.businessKpiDropPct}%`);
    }

    const shouldRollback = breaches.length > 0;
    const incidentTitle = shouldRollback
      ? `[Incident][AutoRollback] Regression after issue #${workItem.issueId}`
      : `[Monitoring] Healthy deployment for issue #${workItem.issueId}`;

    const incidentBody = shouldRollback
      ? `Triggered rollback due to: ${breaches.join(", ")}. Root-cause issue should be created automatically.`
      : "No rollback action required. All incident thresholds are within limits.";

    const decision: AgentDecision = {
      workItemId: workItem.issueId,
      agent: "incident",
      action: shouldRollback ? "trigger-rollback-and-open-incident" : "no-op",
      reason: shouldRollback
        ? `Threshold breaches detected: ${breaches.join(", ")}`
        : "No incident thresholds breached",
      confidence: shouldRollback ? 0.96 : 0.82,
      requiresHumanApproval: shouldRollback
    };

    return {
      shouldRollback,
      incidentTitle,
      incidentBody,
      decision
    };
  }
}
