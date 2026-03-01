import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createIssueReporterFromEnv,
  type IssueCreateResult
} from "./incident/issue-reporter.js";
import { createObservabilityClientFromEnv } from "./incident/observability-client.js";
import { AgentOrchestrator } from "./orchestrator/agent-orchestrator.js";
import {
  createDeploymentClientFromEnv,
  type DeploymentResult
} from "./release/deployment-client.js";
import type {
  CheckSuite,
  IncidentSignal,
  IssueContext,
  ReleaseInput,
  ReleaseStage,
  RolloutMetrics,
  WorkItem
} from "./types/contracts.js";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) {
    return undefined;
  }

  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function readJsonFile<T>(path: string): Promise<T> {
  const payload = await readFile(path, "utf-8");
  return JSON.parse(payload) as T;
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function issueFromEvent(event: {
  issue?: {
    number?: number;
    title?: string;
    body?: string;
    labels?: Array<{ name?: string }>;
  };
  repository?: { full_name?: string };
}): IssueContext {
  const issueId = event.issue?.number ?? Number(arg("--issue-id") ?? "0");
  const repo = event.repository?.full_name ?? arg("--repo") ?? "local/repo";
  const title = event.issue?.title ?? arg("--title") ?? "Untitled work item";
  const body = event.issue?.body ?? arg("--body") ?? "";
  const labels =
    event.issue?.labels?.map((label) => label.name ?? "").filter(Boolean) ??
    (arg("--labels") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  if (!issueId || Number.isNaN(issueId)) {
    throw new Error("Missing issue id. Pass --issue-id or --event-file.");
  }

  return {
    issueId,
    repo,
    title,
    body,
    labels
  };
}

function extractWorkItem(input: { workItem?: WorkItem; planner?: { workItem?: WorkItem } }): WorkItem {
  if (input.workItem) {
    return input.workItem;
  }

  if (input.planner?.workItem) {
    return input.planner.workItem;
  }

  throw new Error("Could not locate work item payload. Expected workItem or planner.workItem");
}

function normalizeChecks(input: Partial<CheckSuite>): Partial<CheckSuite> {
  return {
    typecheck: input.typecheck === true,
    lint: input.lint === true,
    unit: input.unit === true,
    integration: input.integration === true,
    security: input.security === true,
    agentReview: input.agentReview === true
  };
}

async function resolveRolloutMetrics(
  workItem: WorkItem,
  stage: ReleaseStage,
  service: string,
  metricsFile: string,
  useLiveMetrics: boolean
): Promise<{ metrics: RolloutMetrics; source: "file" | "observability-api" }> {
  if (!useLiveMetrics) {
    const metrics = await readJsonFile<RolloutMetrics>(metricsFile);
    return { metrics, source: "file" };
  }

  const client = createObservabilityClientFromEnv();
  if (!client) {
    throw new Error(
      "No observability provider configured. Set OBSERVABILITY_PROVIDER=api with OBSERVABILITY_API_BASE_URL, OBSERVABILITY_PROVIDER=datadog with DATADOG_API_KEY and DATADOG_APP_KEY, or OBSERVABILITY_PROVIDER=prometheus with PROMETHEUS_BASE_URL."
    );
  }

  const metrics = await client.getRolloutMetrics({
    service,
    stage,
    workItemId: workItem.issueId
  });

  return { metrics, source: "observability-api" };
}

async function resolveIncidentSignal(
  workItem: WorkItem,
  service: string,
  signalFile: string,
  useLiveSignal: boolean
): Promise<{ signal: IncidentSignal; source: "file" | "observability-api" }> {
  if (!useLiveSignal) {
    const signal = await readJsonFile<IncidentSignal>(signalFile);
    return { signal, source: "file" };
  }

  const client = createObservabilityClientFromEnv();
  if (!client) {
    throw new Error(
      "No observability provider configured. Set OBSERVABILITY_PROVIDER=api with OBSERVABILITY_API_BASE_URL, OBSERVABILITY_PROVIDER=datadog with DATADOG_API_KEY and DATADOG_APP_KEY, or OBSERVABILITY_PROVIDER=prometheus with PROMETHEUS_BASE_URL."
    );
  }

  const signal = await client.getIncidentSignal({
    service,
    workItemId: workItem.issueId
  });

  return { signal, source: "observability-api" };
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const orchestrator = await AgentOrchestrator.create();

  switch (command) {
    case "issue": {
      const eventPath = arg("--event-file");
      const event = eventPath
        ? await readJsonFile<{
            issue?: {
              number?: number;
              title?: string;
              body?: string;
              labels?: Array<{ name?: string }>;
            };
            repository?: { full_name?: string };
          }>(eventPath)
        : {};

      const issue = issueFromEvent(event);
      const output = await orchestrator.runIssue(issue);

      const outPath = `.agent/work-item-${issue.issueId}.json`;
      await writeJsonFile(outPath, output);
      await writeJsonFile(".agent/run-summary.json", {
        issueId: issue.issueId,
        duplicate: output.duplicate,
        promptInjectionDetected: output.planner.promptInjectionDetected,
        risk: output.planner.workItem.risk,
        labels: output.planner.inferredLabels,
        outputPath: outPath
      });
      break;
    }

    case "review": {
      const workItemFile = arg("--work-item") ?? ".agent/work-item.json";
      const checksFile = arg("--checks") ?? ".agent/checks.json";
      const coverageDropPct = Number(arg("--coverage-drop") ?? "0");
      const manualOverride = hasFlag("--manual-override");

      const workInput = await readJsonFile<{ workItem?: WorkItem; planner?: { workItem?: WorkItem } }>(
        workItemFile
      );
      const checksInput = await readJsonFile<Partial<CheckSuite>>(checksFile);

      const output = await orchestrator.review({
        workItem: extractWorkItem(workInput),
        checks: normalizeChecks(checksInput),
        coverageDropPct,
        manualOverride
      });

      await writeJsonFile(".agent/review-summary.json", output);
      if (!output.policy.allowed) {
        process.exitCode = 1;
      }
      break;
    }

    case "release": {
      const workItemFile = arg("--work-item") ?? ".agent/work-item.json";
      const metricsFile = arg("--metrics") ?? ".agent/rollout-metrics.json";
      const stage = (arg("--stage") ?? "staging") as ReleaseStage;
      const service = arg("--service") ?? process.env.SERVICE_NAME ?? "web-api";
      const useLiveMetrics = hasFlag("--live-metrics");
      const apply = hasFlag("--apply");

      const workInput = await readJsonFile<{ workItem?: WorkItem; planner?: { workItem?: WorkItem } }>(
        workItemFile
      );
      const workItem = extractWorkItem(workInput);
      const metricsResolution = await resolveRolloutMetrics(
        workItem,
        stage,
        service,
        metricsFile,
        useLiveMetrics
      );

      const releaseInput: ReleaseInput = {
        workItem,
        stage,
        metrics: metricsResolution.metrics
      };

      const output = await orchestrator.release(releaseInput);
      const deploymentActions: DeploymentResult[] = [];
      if (apply) {
        const deploymentClient = createDeploymentClientFromEnv();

        if (!output.promoted || output.nextStage === "rollback") {
          deploymentActions.push(
            await deploymentClient.rollback({
              service,
              workItemId: workItem.issueId,
              reason: output.reason
            })
          );
        } else if (stage !== "full" && (output.nextStage === "canary" || output.nextStage === "full")) {
          deploymentActions.push(
            await deploymentClient.promote({
              service,
              targetStage: output.nextStage,
              workItemId: workItem.issueId
            })
          );
        }
      }

      await writeJsonFile(".agent/release-summary.json", {
        ...output,
        runtime: {
          stage,
          service,
          metricsSource: metricsResolution.source,
          apply,
          deploymentActions
        }
      });

      const deploymentFailures = deploymentActions.some((action) => action.success !== true);
      if (!output.promoted) {
        process.exitCode = 1;
      } else if (deploymentFailures) {
        process.exitCode = 1;
      }
      break;
    }

    case "incident": {
      const workItemFile = arg("--work-item") ?? ".agent/work-item.json";
      const metricsFile = arg("--metrics") ?? ".agent/incident-signal.json";
      const service = arg("--service") ?? process.env.SERVICE_NAME ?? "web-api";
      const useLiveSignal = hasFlag("--live-signal");
      const apply = hasFlag("--apply");
      const reportIssue = hasFlag("--report-issue");

      const workInput = await readJsonFile<{ workItem?: WorkItem; planner?: { workItem?: WorkItem } }>(
        workItemFile
      );
      const workItem = extractWorkItem(workInput);
      const signalResolution = await resolveIncidentSignal(
        workItem,
        service,
        metricsFile,
        useLiveSignal
      );

      const output = await orchestrator.assessIncident(workItem, signalResolution.signal);
      const runtimeActions: Array<DeploymentResult | IssueCreateResult> = [];
      if (apply && output.shouldRollback) {
        const deploymentClient = createDeploymentClientFromEnv();
        runtimeActions.push(
          await deploymentClient.rollback({
            service,
            workItemId: workItem.issueId,
            reason: output.decision.reason
          })
        );

        if (reportIssue) {
          const issueReporter = createIssueReporterFromEnv();
          runtimeActions.push(
            await issueReporter.createIssue({
              title: output.incidentTitle,
              body: output.incidentBody,
              labels: ["incident:auto", "autonomy:needs-human", "agent:blocked"]
            })
          );
        }
      }

      await writeJsonFile(".agent/incident-summary.json", {
        ...output,
        runtime: {
          service,
          signalSource: signalResolution.source,
          apply,
          reportIssue,
          actions: runtimeActions
        }
      });
      if (output.shouldRollback) {
        process.exitCode = 1;
      }
      break;
    }

    case "governance": {
      const logPath = arg("--log-file") ?? ".agent/decisions.log.ndjson";
      const report = await orchestrator.governanceReport(logPath);
      await mkdir(".agent", { recursive: true });
      await writeFile(".agent/governance-report.md", `${report}\n`, "utf-8");
      break;
    }

    default:
      throw new Error(
        "Unknown command. Use one of: issue, review, release, incident, governance"
      );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
