import assert from "node:assert/strict";
import test from "node:test";
import {
  ArgoRolloutsDeploymentClient,
  DeploymentApiClient,
  NoopDeploymentClient,
  createDeploymentClientFromEnv
} from "../../src/release/deployment-client.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("deployment API client promotes stage via HTTP", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return jsonResponse({ success: true, deploymentId: "dep_1" });
  };

  try {
    const client = new DeploymentApiClient({
      baseUrl: "https://deploy.example.com",
      token: "secret-token"
    });

    const result = await client.promote({
      service: "web-api",
      targetStage: "canary",
      workItemId: 12
    });

    assert.equal(result.success, true);
    assert.equal(result.stage, "canary");
    assert.equal(result.deploymentId, "dep_1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://deploy.example.com/v1/deployments/promote");
    assert.equal(
      (calls[0]?.init?.headers as Record<string, string>).authorization,
      "Bearer secret-token"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("argo rollout client executes promote and abort commands", async () => {
  const commands: Array<{ cmd: string; args: string[] }> = [];
  const client = new ArgoRolloutsDeploymentClient({
    rolloutName: "checkout",
    namespace: "prod",
    runner: (cmd, args) => {
      commands.push({ cmd, args });
      return { status: 0, stdout: "ok", stderr: "" };
    }
  });

  const promoted = await client.promote({
    service: "web-api",
    targetStage: "full",
    workItemId: 1
  });

  const rolledBack = await client.rollback({
    service: "web-api",
    workItemId: 1,
    reason: "threshold breach"
  });

  assert.equal(promoted.success, true);
  assert.equal(rolledBack.success, true);
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0], {
    cmd: "kubectl",
    args: ["argo", "rollouts", "promote", "checkout", "-n", "prod", "--full"]
  });
  assert.deepEqual(commands[1], {
    cmd: "kubectl",
    args: ["argo", "rollouts", "abort", "checkout", "-n", "prod"]
  });
});

test("no-op deployment client simulates rollback", async () => {
  const client = new NoopDeploymentClient();
  const result = await client.rollback({
    service: "web-api",
    workItemId: 10,
    reason: "test"
  });

  assert.equal(result.success, true);
  assert.equal(result.action, "rollback");
});

test("factory returns no-op client when env missing", async () => {
  const prevProvider = process.env.DEPLOYMENT_PROVIDER;
  const prevBaseUrl = process.env.DEPLOY_API_BASE_URL;
  delete process.env.DEPLOYMENT_PROVIDER;
  delete process.env.DEPLOY_API_BASE_URL;

  try {
    const client = createDeploymentClientFromEnv();
    const result = await client.promote({
      service: "web-api",
      targetStage: "staging",
      workItemId: 1
    });
    assert.equal(result.success, true);
    assert.match(result.message, /No-op/i);
  } finally {
    if (prevProvider) {
      process.env.DEPLOYMENT_PROVIDER = prevProvider;
    }
    if (prevBaseUrl) {
      process.env.DEPLOY_API_BASE_URL = prevBaseUrl;
    }
  }
});

test("factory picks argo-rollouts provider when configured", () => {
  const prevProvider = process.env.DEPLOYMENT_PROVIDER;
  const prevRollout = process.env.ARGO_ROLLOUT_NAME;
  process.env.DEPLOYMENT_PROVIDER = "argo-rollouts";
  process.env.ARGO_ROLLOUT_NAME = "checkout";

  try {
    const client = createDeploymentClientFromEnv();
    assert.equal(client instanceof ArgoRolloutsDeploymentClient, true);
  } finally {
    if (prevProvider) {
      process.env.DEPLOYMENT_PROVIDER = prevProvider;
    } else {
      delete process.env.DEPLOYMENT_PROVIDER;
    }

    if (prevRollout) {
      process.env.ARGO_ROLLOUT_NAME = prevRollout;
    } else {
      delete process.env.ARGO_ROLLOUT_NAME;
    }
  }
});
