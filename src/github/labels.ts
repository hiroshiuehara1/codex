import type { RiskLevel } from "../types/contracts.js";

export const AGENT_LABELS = [
  "agent:queued",
  "agent:in-progress",
  "agent:blocked",
  "agent:review",
  "agent:release",
  "agent:done"
] as const;

export const RISK_LABELS = ["risk:low", "risk:medium", "risk:high"] as const;

export const AUTONOMY_LABELS = [
  "autonomy:auto",
  "autonomy:needs-human"
] as const;

export function labelsForRisk(risk: RiskLevel): string[] {
  return [`risk:${risk}`];
}

export function labelsForApproval(requiresHumanApproval: boolean): string[] {
  return [requiresHumanApproval ? "autonomy:needs-human" : "autonomy:auto"];
}
