export type RiskLevel = "low" | "medium" | "high";

export type WorkType = "feature" | "bugfix" | "test" | "refactor";

export type WorkStatus =
  | "queued"
  | "planning"
  | "building"
  | "testing"
  | "reviewing"
  | "releasing"
  | "done"
  | "failed";

export type AgentName =
  | "planner"
  | "builder"
  | "tester"
  | "reviewer"
  | "release"
  | "incident";

export interface WorkItem {
  issueId: number;
  repo: string;
  title: string;
  acceptanceCriteria: string[];
  workType: WorkType;
  risk: RiskLevel;
  status: WorkStatus;
}

export interface AgentDecision {
  workItemId: number;
  agent: AgentName;
  action: string;
  reason: string;
  confidence: number;
  requiresHumanApproval: boolean;
}

export interface PolicyResult {
  allowed: boolean;
  violations: string[];
  requiredChecks: string[];
}

export interface PRMetadata {
  workItemId: number;
  risk: RiskLevel;
  testPlan: string[];
  rollbackPlan: string[];
  policyResult: PolicyResult;
}

export interface IssueContext {
  issueId: number;
  repo: string;
  title: string;
  body: string;
  labels: string[];
}

export interface PlannerOutput {
  workItem: WorkItem;
  taskGraph: string[];
  decision: AgentDecision;
  promptInjectionDetected: boolean;
  inferredLabels: string[];
}

export interface BuilderOutput {
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBodySections: string[];
  metadata: PRMetadata;
  decision: AgentDecision;
}

export interface TestPlan {
  unit: string[];
  integration: string[];
  e2e: string[];
  flakyRisk: "low" | "medium" | "high";
}

export interface TestOutput {
  testPlan: TestPlan;
  decision: AgentDecision;
}

export interface CheckSuite {
  typecheck: boolean;
  lint: boolean;
  unit: boolean;
  integration: boolean;
  security: boolean;
  agentReview: boolean;
}

export interface ReviewInput {
  workItem: WorkItem;
  checks: Partial<CheckSuite>;
  coverageDropPct: number;
  manualOverride: boolean;
  additionalViolations?: string[];
}

export interface ReviewOutput {
  policy: PolicyResult;
  decision: AgentDecision;
  missingChecks: string[];
}

export type ReleaseStage = "staging" | "canary" | "full";

export interface RolloutMetrics {
  smokeTestsPassed: boolean;
  canaryDurationMinutes: number;
  canaryTrafficPct: number;
  errorRatePct: number;
  latencyP95Ms: number;
  failedRequests: number;
  businessKpiDropPct: number;
}

export interface ReleaseInput {
  workItem: WorkItem;
  stage: ReleaseStage;
  metrics: RolloutMetrics;
}

export interface ReleaseOutput {
  promoted: boolean;
  nextStage: ReleaseStage | "rollback";
  reason: string;
  decision: AgentDecision;
}

export interface IncidentSignal {
  service: string;
  errorRatePct: number;
  latencyP95Ms: number;
  failedRequests: number;
  businessKpiDropPct: number;
}

export interface IncidentOutput {
  shouldRollback: boolean;
  incidentTitle: string;
  incidentBody: string;
  decision: AgentDecision;
}

export interface DecisionLogRecord {
  timestamp: string;
  inputContextHash: string;
  toolCalls: string[];
  decision: AgentDecision;
  policyResult?: PolicyResult;
}
