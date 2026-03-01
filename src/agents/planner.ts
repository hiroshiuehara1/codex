import {
  HIGH_RISK_KEYWORDS,
  MEDIUM_RISK_KEYWORDS
} from "../config/policy.js";
import { detectPromptInjection } from "../core/prompt-guard.js";
import {
  labelsForApproval,
  labelsForRisk
} from "../github/labels.js";
import type {
  AgentDecision,
  IssueContext,
  PlannerOutput,
  RiskLevel,
  WorkType
} from "../types/contracts.js";

function parseAcceptanceCriteria(body: string): string[] {
  const lines = body.split("\n");
  const criteria = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [") || line.startsWith("- "))
    .map((line) => line.replace(/^- \[[ xX]\]\s*/, "").replace(/^-\s*/, ""))
    .filter((line) => line.length > 0);

  return criteria.length > 0 ? criteria : ["Implement requested scope safely"];
}

function inferWorkType(issue: IssueContext): WorkType {
  const source = `${issue.title} ${issue.body} ${issue.labels.join(" ")}`.toLowerCase();
  if (source.includes("bug") || source.includes("fix")) {
    return "bugfix";
  }
  if (source.includes("test") || source.includes("coverage")) {
    return "test";
  }
  if (source.includes("refactor")) {
    return "refactor";
  }
  return "feature";
}

function inferRisk(issue: IssueContext, blockedByPromptGuard: boolean): RiskLevel {
  if (blockedByPromptGuard) {
    return "high";
  }

  const source = `${issue.title} ${issue.body}`.toLowerCase();

  if (HIGH_RISK_KEYWORDS.some((keyword) => source.includes(keyword))) {
    return "high";
  }

  if (MEDIUM_RISK_KEYWORDS.some((keyword) => source.includes(keyword))) {
    return "medium";
  }

  return "low";
}

function taskGraphFor(workType: WorkType): string[] {
  const common = [
    "Analyze issue scope",
    "Implement code changes",
    "Add or update tests",
    "Run policy checks",
    "Prepare release + rollback notes"
  ];

  if (workType === "bugfix") {
    return ["Reproduce bug", ...common, "Confirm regression test coverage"];
  }

  if (workType === "test") {
    return ["Identify critical paths", "Harden test determinism", ...common];
  }

  return common;
}

export class PlannerAgent {
  plan(issue: IssueContext): PlannerOutput {
    const promptGuard = detectPromptInjection(issue.body);
    const workType = inferWorkType(issue);
    const risk = inferRisk(issue, promptGuard.blocked);
    const acceptanceCriteria = parseAcceptanceCriteria(issue.body);
    const requiresHumanApproval = risk === "high";

    const decision: AgentDecision = {
      workItemId: issue.issueId,
      agent: "planner",
      action: promptGuard.blocked ? "block-and-escalate" : "plan-work",
      reason: promptGuard.blocked
        ? `Prompt-injection risk detected: ${promptGuard.reasons.join("; ")}`
        : `Planned work as ${workType} with ${risk} risk`,
      confidence: promptGuard.blocked ? 0.98 : 0.84,
      requiresHumanApproval
    };

    return {
      workItem: {
        issueId: issue.issueId,
        repo: issue.repo,
        title: issue.title,
        acceptanceCriteria,
        workType,
        risk,
        status: "planning"
      },
      taskGraph: taskGraphFor(workType),
      decision,
      promptInjectionDetected: promptGuard.blocked,
      inferredLabels: [
        "agent:in-progress",
        ...labelsForRisk(risk),
        ...labelsForApproval(requiresHumanApproval)
      ]
    };
  }
}
