import { spawnSync } from "node:child_process";

export type DeploymentStage = "staging" | "canary" | "full";

export interface PromoteRequest {
  service: string;
  targetStage: DeploymentStage;
  workItemId: number;
}

export interface RollbackRequest {
  service: string;
  workItemId: number;
  reason: string;
}

export interface DeploymentResult {
  success: boolean;
  action: "promote" | "rollback";
  stage?: DeploymentStage;
  deploymentId?: string;
  message: string;
}

export interface DeploymentClient {
  promote(input: PromoteRequest): Promise<DeploymentResult>;
  rollback(input: RollbackRequest): Promise<DeploymentResult>;
}

export class NoopDeploymentClient implements DeploymentClient {
  async promote(input: PromoteRequest): Promise<DeploymentResult> {
    return {
      success: true,
      action: "promote",
      stage: input.targetStage,
      message: "No-op deployment client: promotion simulated"
    };
  }

  async rollback(input: RollbackRequest): Promise<DeploymentResult> {
    return {
      success: true,
      action: "rollback",
      message: `No-op deployment client: rollback simulated (${input.reason})`
    };
  }
}

interface DeploymentApiClientOptions {
  baseUrl: string;
  token?: string | undefined;
  timeoutMs?: number;
}

interface ApiResponse {
  success?: boolean;
  deploymentId?: string;
  message?: string;
}

export class DeploymentApiClient implements DeploymentClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: DeploymentApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async promote(input: PromoteRequest): Promise<DeploymentResult> {
    const response = await this.request<ApiResponse>("/v1/deployments/promote", {
      service: input.service,
      targetStage: input.targetStage,
      workItemId: input.workItemId
    });

    return {
      success: response.success !== false,
      action: "promote",
      stage: input.targetStage,
      ...(response.deploymentId ? { deploymentId: response.deploymentId } : {}),
      message: response.message ?? `Promoted ${input.service} to ${input.targetStage}`
    };
  }

  async rollback(input: RollbackRequest): Promise<DeploymentResult> {
    const response = await this.request<ApiResponse>("/v1/deployments/rollback", {
      service: input.service,
      workItemId: input.workItemId,
      reason: input.reason
    });

    return {
      success: response.success !== false,
      action: "rollback",
      ...(response.deploymentId ? { deploymentId: response.deploymentId } : {}),
      message: response.message ?? `Rollback triggered for ${input.service}`
    };
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Deployment API ${response.status}: ${text || response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => CommandResult;

function defaultCommandRunner(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf-8"
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

interface ArgoRolloutsDeploymentClientOptions {
  rolloutName?: string | undefined;
  namespace?: string;
  kubeContext?: string | undefined;
  fullPromotion?: boolean;
  runner?: CommandRunner;
}

export class ArgoRolloutsDeploymentClient implements DeploymentClient {
  private readonly rolloutName: string | undefined;
  private readonly namespace: string;
  private readonly kubeContext: string | undefined;
  private readonly fullPromotion: boolean;
  private readonly runner: CommandRunner;

  constructor(options: ArgoRolloutsDeploymentClientOptions = {}) {
    this.rolloutName = options.rolloutName;
    this.namespace = options.namespace ?? "default";
    this.kubeContext = options.kubeContext;
    this.fullPromotion = options.fullPromotion ?? true;
    this.runner = options.runner ?? defaultCommandRunner;
  }

  async promote(input: PromoteRequest): Promise<DeploymentResult> {
    const rollout = this.rolloutName ?? input.service;
    const args = this.baseArgs();

    args.push("argo", "rollouts", "promote", rollout, "-n", this.namespace);
    if (input.targetStage === "full" && this.fullPromotion) {
      args.push("--full");
    }

    const result = this.runner("kubectl", args);
    if (result.status !== 0) {
      throw new Error(`Argo Rollouts promote failed: ${result.stderr || result.stdout}`);
    }

    return {
      success: true,
      action: "promote",
      stage: input.targetStage,
      message: `Argo Rollouts promoted ${rollout} in namespace ${this.namespace}`
    };
  }

  async rollback(input: RollbackRequest): Promise<DeploymentResult> {
    const rollout = this.rolloutName ?? input.service;
    const args = this.baseArgs();
    args.push("argo", "rollouts", "abort", rollout, "-n", this.namespace);

    const result = this.runner("kubectl", args);
    if (result.status !== 0) {
      throw new Error(`Argo Rollouts abort failed: ${result.stderr || result.stdout}`);
    }

    return {
      success: true,
      action: "rollback",
      message: `Argo Rollouts aborted ${rollout} in namespace ${this.namespace}`
    };
  }

  private baseArgs(): string[] {
    if (!this.kubeContext) {
      return [];
    }

    return ["--context", this.kubeContext];
  }
}

export type DeploymentProvider = "api" | "argo-rollouts" | "noop";

function inferProviderFromEnv(): DeploymentProvider {
  const explicit = (process.env.DEPLOYMENT_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "api" || explicit === "argo-rollouts" || explicit === "noop") {
    return explicit;
  }

  if (process.env.ARGO_ROLLOUT_NAME) {
    return "argo-rollouts";
  }

  if (process.env.DEPLOY_API_BASE_URL) {
    return "api";
  }

  return "noop";
}

export function createDeploymentClientFromEnv(): DeploymentClient {
  const provider = inferProviderFromEnv();

  if (provider === "argo-rollouts") {
    return new ArgoRolloutsDeploymentClient({
      rolloutName: process.env.ARGO_ROLLOUT_NAME,
      namespace: process.env.ARGO_ROLLOUT_NAMESPACE ?? "default",
      kubeContext: process.env.KUBECONFIG_CONTEXT,
      fullPromotion: process.env.ARGO_ROLLOUT_FULL_PROMOTION !== "false"
    });
  }

  if (provider === "api") {
    const baseUrl = process.env.DEPLOY_API_BASE_URL;
    const token = process.env.DEPLOY_API_TOKEN;

    if (!baseUrl) {
      return new NoopDeploymentClient();
    }

    return new DeploymentApiClient({
      baseUrl,
      ...(token ? { token } : {}),
      timeoutMs: Number(process.env.DEPLOY_API_TIMEOUT_MS ?? "15000")
    });
  }

  return new NoopDeploymentClient();
}
