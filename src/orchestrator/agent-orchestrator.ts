import { readFile } from "node:fs/promises";
import { BuilderAgent } from "../agents/builder.js";
import { IncidentAgent } from "../agents/incident.js";
import { PlannerAgent } from "../agents/planner.js";
import { ReleaseAgent } from "../agents/release.js";
import { ReviewerAgent } from "../agents/reviewer.js";
import { TestAgent } from "../agents/tester.js";
import { sha256 } from "../core/hash.js";
import { IdempotencyStore } from "../core/idempotency.js";
import { DecisionLogger } from "../core/logger.js";
import type {
  BuilderOutput,
  IncidentOutput,
  IncidentSignal,
  IssueContext,
  PlannerOutput,
  ReleaseInput,
  ReleaseOutput,
  ReviewInput,
  ReviewOutput,
  TestOutput,
  WorkItem
} from "../types/contracts.js";

export interface IssueRunOutput {
  duplicate: boolean;
  planner: PlannerOutput;
  builder: BuilderOutput | null;
  tester: TestOutput | null;
}

export class AgentOrchestrator {
  private readonly planner = new PlannerAgent();
  private readonly builder = new BuilderAgent();
  private readonly tester = new TestAgent();
  private readonly reviewer = new ReviewerAgent();
  private readonly releaseAgent = new ReleaseAgent();
  private readonly incidentAgent = new IncidentAgent();

  constructor(
    private readonly logger: DecisionLogger,
    private readonly idempotency: IdempotencyStore
  ) {}

  static async create(paths?: {
    logPath?: string;
    idempotencyPath?: string;
  }): Promise<AgentOrchestrator> {
    const logger = new DecisionLogger(paths?.logPath ?? ".agent/decisions.log.ndjson");
    const idempotency = new IdempotencyStore(
      paths?.idempotencyPath ?? ".agent/idempotency.json"
    );
    await idempotency.load();

    return new AgentOrchestrator(logger, idempotency);
  }

  async runIssue(issue: IssueContext): Promise<IssueRunOutput> {
    const idempotencyKey = sha256(`${issue.issueId}:${issue.title}:${issue.body}`);
    const planner = this.planner.plan(issue);

    if (this.idempotency.has(idempotencyKey)) {
      await this.logDecision(["planner.plan"], issue, planner.decision);
      return {
        duplicate: true,
        planner,
        builder: null,
        tester: null
      };
    }

    await this.idempotency.add(idempotencyKey);
    await this.logDecision(["planner.plan"], issue, planner.decision);

    if (planner.promptInjectionDetected) {
      return {
        duplicate: false,
        planner,
        builder: null,
        tester: null
      };
    }

    const builder = this.builder.build({ ...planner.workItem, status: "building" });
    await this.logDecision(["builder.build", "github.createPR"], builder, builder.decision);

    const tester = this.tester.createPlan({ ...planner.workItem, status: "testing" });
    await this.logDecision(["tester.generatePlan", "ci.enqueue"], tester, tester.decision);

    return {
      duplicate: false,
      planner,
      builder,
      tester
    };
  }

  async review(input: ReviewInput): Promise<ReviewOutput> {
    const output = this.reviewer.review(input);
    await this.logDecision(["reviewer.review", "policy.evaluate"], input, output.decision, output.policy);
    return output;
  }

  async release(input: ReleaseInput): Promise<ReleaseOutput> {
    const output = this.releaseAgent.release(input);
    await this.logDecision(["release.evaluate", "deploy.progressive"], input, output.decision);
    return output;
  }

  async assessIncident(workItem: WorkItem, signal: IncidentSignal): Promise<IncidentOutput> {
    const output = this.incidentAgent.assess(workItem, signal);
    await this.logDecision(["incident.monitor", "rollback.evaluate"], signal, output.decision);
    return output;
  }

  async governanceReport(logPath = ".agent/decisions.log.ndjson"): Promise<string> {
    const source = await readFile(logPath, "utf-8").catch(() => "");
    const lines = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { decision: { agent: string; action: string; requiresHumanApproval: boolean } });

    const total = lines.length;
    const byAgent = new Map<string, number>();
    const byAction = new Map<string, number>();
    let approvalRequired = 0;

    for (const line of lines) {
      byAgent.set(line.decision.agent, (byAgent.get(line.decision.agent) ?? 0) + 1);
      byAction.set(line.decision.action, (byAction.get(line.decision.action) ?? 0) + 1);
      if (line.decision.requiresHumanApproval) {
        approvalRequired += 1;
      }
    }

    const agentSection = [...byAgent.entries()]
      .map(([agent, count]) => `- ${agent}: ${count}`)
      .join("\n");

    const actionSection = [...byAction.entries()]
      .map(([action, count]) => `- ${action}: ${count}`)
      .join("\n");

    return [
      "# Weekly Agent Governance Report",
      "",
      `- Total decisions: ${total}`,
      `- Decisions requiring human approval: ${approvalRequired}`,
      "",
      "## Decisions by Agent",
      agentSection || "- none",
      "",
      "## Decisions by Action",
      actionSection || "- none"
    ].join("\n");
  }

  private async logDecision(
    toolCalls: string[],
    input: unknown,
    decision: PlannerOutput["decision"],
    policyResult?: ReviewOutput["policy"]
  ): Promise<void> {
    const payload = JSON.stringify(input);
    const record = {
      timestamp: new Date().toISOString(),
      inputContextHash: sha256(payload),
      toolCalls,
      decision
    };

    await this.logger.log({
      ...record,
      ...(policyResult ? { policyResult } : {})
    });
  }
}
