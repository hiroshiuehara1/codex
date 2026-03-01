import type { RiskLevel } from "../types/contracts.js";

export const REQUIRED_CHECKS = [
  "typecheck",
  "lint",
  "unit",
  "integration",
  "security",
  "agentReview"
] as const;

export const COVERAGE_DROP_BUDGET_PCT = 2;

export const CANARY_GUARDS = {
  maxErrorRatePct: 2,
  maxLatencyP95Ms: 500,
  maxFailedRequests: 25,
  maxBusinessKpiDropPct: 3
} as const;

export const INCIDENT_GUARDS = {
  maxErrorRatePct: 3,
  maxLatencyP95Ms: 800,
  maxFailedRequests: 40,
  maxBusinessKpiDropPct: 5
} as const;

export const RISK_ORDER: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3
};

export const HIGH_RISK_KEYWORDS = [
  "database migration",
  "payment",
  "auth",
  "security",
  "encryption",
  "rbac",
  "production data"
];

export const MEDIUM_RISK_KEYWORDS = [
  "api",
  "cache",
  "queue",
  "session",
  "schema",
  "state"
];
