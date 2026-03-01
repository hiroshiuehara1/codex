import assert from "node:assert/strict";
import test from "node:test";
import {
  DatadogObservabilityClient,
  ObservabilityApiClient,
  createObservabilityClientFromEnv
} from "../../src/incident/observability-client.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("observability API client reads rollout metrics", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /rollout-metrics/);
    return jsonResponse({
      data: {
        smokeTestsPassed: true,
        canaryDurationMinutes: 30,
        canaryTrafficPct: 10,
        errorRatePct: 0.4,
        latencyP95Ms: 230,
        failedRequests: 3,
        businessKpiDropPct: 0.2
      }
    });
  };

  try {
    const client = new ObservabilityApiClient({ baseUrl: "https://obs.example.com" });
    const metrics = await client.getRolloutMetrics({
      service: "web-api",
      stage: "canary",
      workItemId: 2
    });

    assert.equal(metrics.smokeTestsPassed, true);
    assert.equal(metrics.canaryDurationMinutes, 30);
    assert.equal(metrics.canaryTrafficPct, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("observability API client reads incident signal", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /incident-signal/);
    return jsonResponse({
      service: "web-api",
      errorRatePct: 4,
      latencyP95Ms: 900,
      failedRequests: 70,
      businessKpiDropPct: 7
    });
  };

  try {
    const client = new ObservabilityApiClient({ baseUrl: "https://obs.example.com" });
    const signal = await client.getIncidentSignal({
      service: "web-api",
      workItemId: 3
    });

    assert.equal(signal.errorRatePct, 4);
    assert.equal(signal.latencyP95Ms, 900);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("datadog client reads rollout metrics from v1 query API", async () => {
  const calls: Array<{ url: string; headers: unknown }> = [];
  const values = [1.1, 240, 6, 2.2];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: init?.headers });
    const value = values.shift() ?? 0;
    return jsonResponse({
      status: "ok",
      series: [
        {
          pointlist: [
            [1700000000, null],
            [1700000100, value]
          ]
        }
      ]
    });
  };

  try {
    const client = new DatadogObservabilityClient({
      apiKey: "dd-api",
      appKey: "dd-app",
      apiBaseUrl: "https://api.datadoghq.com",
      defaultCanaryDurationMinutes: 30,
      defaultCanaryTrafficPct: 10
    });

    const metrics = await client.getRolloutMetrics({
      service: "web-api",
      stage: "canary",
      workItemId: 99
    });

    assert.equal(metrics.errorRatePct, 1.1);
    assert.equal(metrics.latencyP95Ms, 240);
    assert.equal(metrics.failedRequests, 6);
    assert.equal(metrics.businessKpiDropPct, 2.2);
    assert.equal(metrics.canaryDurationMinutes, 30);
    assert.equal(metrics.canaryTrafficPct, 10);
    assert.equal(calls.length, 4);
    assert.match(calls[0]?.url ?? "", /\/api\/v1\/query\?/);

    const headers = calls[0]?.headers as Record<string, string>;
    assert.equal(headers["DD-API-KEY"], "dd-api");
    assert.equal(headers["DD-APPLICATION-KEY"], "dd-app");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("datadog client reads incident signal from v1 query API", async () => {
  const values = [4.2, 880, 42, 6.5];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const value = values.shift() ?? 0;
    return jsonResponse({
      status: "ok",
      series: [{ pointlist: [[1700000100, value]] }]
    });
  };

  try {
    const client = new DatadogObservabilityClient({
      apiKey: "dd-api",
      appKey: "dd-app"
    });

    const signal = await client.getIncidentSignal({
      service: "web-api",
      workItemId: 7
    });

    assert.equal(signal.errorRatePct, 4.2);
    assert.equal(signal.latencyP95Ms, 880);
    assert.equal(signal.failedRequests, 42);
    assert.equal(signal.businessKpiDropPct, 6.5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("factory returns null when env missing", () => {
  const prevProvider = process.env.OBSERVABILITY_PROVIDER;
  const prevBaseUrl = process.env.OBSERVABILITY_API_BASE_URL;
  const prevApiKey = process.env.DATADOG_API_KEY;
  const prevAppKey = process.env.DATADOG_APP_KEY;
  delete process.env.OBSERVABILITY_PROVIDER;
  delete process.env.OBSERVABILITY_API_BASE_URL;
  delete process.env.DATADOG_API_KEY;
  delete process.env.DATADOG_APP_KEY;

  try {
    const client = createObservabilityClientFromEnv();
    assert.equal(client, null);
  } finally {
    if (prevProvider) {
      process.env.OBSERVABILITY_PROVIDER = prevProvider;
    } else {
      delete process.env.OBSERVABILITY_PROVIDER;
    }

    if (prevBaseUrl) {
      process.env.OBSERVABILITY_API_BASE_URL = prevBaseUrl;
    } else {
      delete process.env.OBSERVABILITY_API_BASE_URL;
    }

    if (prevApiKey) {
      process.env.DATADOG_API_KEY = prevApiKey;
    } else {
      delete process.env.DATADOG_API_KEY;
    }

    if (prevAppKey) {
      process.env.DATADOG_APP_KEY = prevAppKey;
    } else {
      delete process.env.DATADOG_APP_KEY;
    }
  }
});

test("factory picks datadog when configured", () => {
  const prevProvider = process.env.OBSERVABILITY_PROVIDER;
  const prevApiKey = process.env.DATADOG_API_KEY;
  const prevAppKey = process.env.DATADOG_APP_KEY;

  process.env.OBSERVABILITY_PROVIDER = "datadog";
  process.env.DATADOG_API_KEY = "key";
  process.env.DATADOG_APP_KEY = "app";

  try {
    const client = createObservabilityClientFromEnv();
    assert.equal(client instanceof DatadogObservabilityClient, true);
  } finally {
    if (prevProvider) {
      process.env.OBSERVABILITY_PROVIDER = prevProvider;
    } else {
      delete process.env.OBSERVABILITY_PROVIDER;
    }

    if (prevApiKey) {
      process.env.DATADOG_API_KEY = prevApiKey;
    } else {
      delete process.env.DATADOG_API_KEY;
    }

    if (prevAppKey) {
      process.env.DATADOG_APP_KEY = prevAppKey;
    } else {
      delete process.env.DATADOG_APP_KEY;
    }
  }
});
