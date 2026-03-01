import type { IncidentSignal, ReleaseStage, RolloutMetrics } from "../types/contracts.js";

export interface RolloutMetricsRequest {
  service: string;
  stage: ReleaseStage;
  workItemId: number;
}

export interface IncidentSignalRequest {
  service: string;
  workItemId: number;
}

export interface ObservabilityClient {
  getRolloutMetrics(input: RolloutMetricsRequest): Promise<RolloutMetrics>;
  getIncidentSignal(input: IncidentSignalRequest): Promise<IncidentSignal>;
}

export class StaticObservabilityClient implements ObservabilityClient {
  constructor(
    private readonly metrics: RolloutMetrics,
    private readonly signal: IncidentSignal
  ) {}

  async getRolloutMetrics(): Promise<RolloutMetrics> {
    return this.metrics;
  }

  async getIncidentSignal(): Promise<IncidentSignal> {
    return this.signal;
  }
}

interface ObservabilityApiClientOptions {
  baseUrl: string;
  token?: string | undefined;
  timeoutMs?: number;
}

export class ObservabilityApiClient implements ObservabilityClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: ObservabilityApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async getRolloutMetrics(input: RolloutMetricsRequest): Promise<RolloutMetrics> {
    const path = `/v1/services/${encodeURIComponent(input.service)}/rollout-metrics?stage=${encodeURIComponent(input.stage)}&workItemId=${input.workItemId}`;
    const payload = await this.get<Partial<RolloutMetrics>>(path);

    return {
      smokeTestsPassed: payload.smokeTestsPassed === true,
      canaryDurationMinutes: Number(payload.canaryDurationMinutes ?? 0),
      canaryTrafficPct: Number(payload.canaryTrafficPct ?? 0),
      errorRatePct: Number(payload.errorRatePct ?? 0),
      latencyP95Ms: Number(payload.latencyP95Ms ?? 0),
      failedRequests: Number(payload.failedRequests ?? 0),
      businessKpiDropPct: Number(payload.businessKpiDropPct ?? 0)
    };
  }

  async getIncidentSignal(input: IncidentSignalRequest): Promise<IncidentSignal> {
    const path = `/v1/services/${encodeURIComponent(input.service)}/incident-signal?workItemId=${input.workItemId}`;
    const payload = await this.get<Partial<IncidentSignal>>(path);

    return {
      service: payload.service ?? input.service,
      errorRatePct: Number(payload.errorRatePct ?? 0),
      latencyP95Ms: Number(payload.latencyP95Ms ?? 0),
      failedRequests: Number(payload.failedRequests ?? 0),
      businessKpiDropPct: Number(payload.businessKpiDropPct ?? 0)
    };
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Observability API ${response.status}: ${text || response.statusText}`
        );
      }

      const raw = (await response.json()) as { data?: unknown } | unknown;
      if (raw && typeof raw === "object" && "data" in raw && raw.data) {
        return raw.data as T;
      }

      return raw as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

interface DatadogObservabilityClientOptions {
  apiKey: string;
  appKey: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
  windowMinutes?: number;
  errorRateQueryTemplate?: string;
  latencyP95QueryTemplate?: string;
  failedRequestsQueryTemplate?: string;
  businessKpiDropQueryTemplate?: string;
  smokeTestsQueryTemplate?: string;
  smokeTestsMinValue?: number;
  canaryDurationQueryTemplate?: string;
  canaryTrafficQueryTemplate?: string;
  defaultCanaryDurationMinutes?: number;
  defaultCanaryTrafficPct?: number;
}

interface DatadogSeries {
  pointlist?: Array<[number, number | null]>;
}

interface DatadogQueryResponse {
  status?: string;
  error?: string;
  series?: DatadogSeries[];
}

const DEFAULT_ERROR_RATE_QUERY = "avg:service.error_rate{service:${service},stage:${stage}}";
const DEFAULT_LATENCY_P95_QUERY = "avg:service.latency.p95{service:${service},stage:${stage}}";
const DEFAULT_FAILED_REQUESTS_QUERY =
  "sum:service.request.failures{service:${service},stage:${stage}}";
const DEFAULT_BUSINESS_KPI_DROP_QUERY =
  "avg:service.business_kpi_drop_pct{service:${service},stage:${stage}}";

export class DatadogObservabilityClient implements ObservabilityClient {
  private readonly apiKey: string;
  private readonly appKey: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly windowMinutes: number;
  private readonly errorRateQueryTemplate: string;
  private readonly latencyP95QueryTemplate: string;
  private readonly failedRequestsQueryTemplate: string;
  private readonly businessKpiDropQueryTemplate: string;
  private readonly smokeTestsQueryTemplate: string | undefined;
  private readonly smokeTestsMinValue: number;
  private readonly canaryDurationQueryTemplate: string | undefined;
  private readonly canaryTrafficQueryTemplate: string | undefined;
  private readonly defaultCanaryDurationMinutes: number;
  private readonly defaultCanaryTrafficPct: number;

  constructor(options: DatadogObservabilityClientOptions) {
    this.apiKey = options.apiKey;
    this.appKey = options.appKey;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.datadoghq.com").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.windowMinutes = options.windowMinutes ?? 30;
    this.errorRateQueryTemplate =
      options.errorRateQueryTemplate ?? DEFAULT_ERROR_RATE_QUERY;
    this.latencyP95QueryTemplate =
      options.latencyP95QueryTemplate ?? DEFAULT_LATENCY_P95_QUERY;
    this.failedRequestsQueryTemplate =
      options.failedRequestsQueryTemplate ?? DEFAULT_FAILED_REQUESTS_QUERY;
    this.businessKpiDropQueryTemplate =
      options.businessKpiDropQueryTemplate ?? DEFAULT_BUSINESS_KPI_DROP_QUERY;
    this.smokeTestsQueryTemplate = options.smokeTestsQueryTemplate;
    this.smokeTestsMinValue = options.smokeTestsMinValue ?? 1;
    this.canaryDurationQueryTemplate = options.canaryDurationQueryTemplate;
    this.canaryTrafficQueryTemplate = options.canaryTrafficQueryTemplate;
    this.defaultCanaryDurationMinutes = options.defaultCanaryDurationMinutes ?? this.windowMinutes;
    this.defaultCanaryTrafficPct = options.defaultCanaryTrafficPct ?? 10;
  }

  async getRolloutMetrics(input: RolloutMetricsRequest): Promise<RolloutMetrics> {
    const window = this.windowBounds();
    const variables = {
      service: input.service,
      stage: input.stage,
      workItemId: String(input.workItemId)
    };

    const [errorRatePct, latencyP95Ms, failedRequests, businessKpiDropPct] =
      await Promise.all([
        this.queryScalar(this.errorRateQueryTemplate, window.from, window.to, variables),
        this.queryScalar(this.latencyP95QueryTemplate, window.from, window.to, variables),
        this.queryScalar(this.failedRequestsQueryTemplate, window.from, window.to, variables),
        this.queryScalar(this.businessKpiDropQueryTemplate, window.from, window.to, variables)
      ]);

    const smokeTestsPassed = this.smokeTestsQueryTemplate
      ? (await this.queryScalar(
          this.smokeTestsQueryTemplate,
          window.from,
          window.to,
          variables
        )) >= this.smokeTestsMinValue
      : true;

    const canaryDurationMinutes = this.canaryDurationQueryTemplate
      ? await this.queryScalar(
          this.canaryDurationQueryTemplate,
          window.from,
          window.to,
          variables
        )
      : this.defaultCanaryDurationMinutes;

    const canaryTrafficPct = this.canaryTrafficQueryTemplate
      ? await this.queryScalar(
          this.canaryTrafficQueryTemplate,
          window.from,
          window.to,
          variables
        )
      : this.defaultCanaryTrafficPct;

    return {
      smokeTestsPassed,
      canaryDurationMinutes,
      canaryTrafficPct,
      errorRatePct,
      latencyP95Ms,
      failedRequests,
      businessKpiDropPct
    };
  }

  async getIncidentSignal(input: IncidentSignalRequest): Promise<IncidentSignal> {
    const window = this.windowBounds();
    const variables = {
      service: input.service,
      stage: "incident",
      workItemId: String(input.workItemId)
    };

    const [errorRatePct, latencyP95Ms, failedRequests, businessKpiDropPct] =
      await Promise.all([
        this.queryScalar(this.errorRateQueryTemplate, window.from, window.to, variables),
        this.queryScalar(this.latencyP95QueryTemplate, window.from, window.to, variables),
        this.queryScalar(this.failedRequestsQueryTemplate, window.from, window.to, variables),
        this.queryScalar(this.businessKpiDropQueryTemplate, window.from, window.to, variables)
      ]);

    return {
      service: input.service,
      errorRatePct,
      latencyP95Ms,
      failedRequests,
      businessKpiDropPct
    };
  }

  private windowBounds(): { from: number; to: number } {
    const to = Math.floor(Date.now() / 1000);
    const from = to - this.windowMinutes * 60;
    return { from, to };
  }

  private interpolate(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replaceAll(`\${${key}}`, value);
    }

    return result;
  }

  private async queryScalar(
    queryTemplate: string,
    from: number,
    to: number,
    variables: Record<string, string>
  ): Promise<number> {
    const query = this.interpolate(queryTemplate, variables);
    const params = new URLSearchParams({
      from: String(from),
      to: String(to),
      query
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/query?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "DD-API-KEY": this.apiKey,
          "DD-APPLICATION-KEY": this.appKey
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Datadog API ${response.status}: ${text || response.statusText}`);
      }

      const payload = (await response.json()) as DatadogQueryResponse;
      if (payload.error) {
        throw new Error(`Datadog query failed: ${payload.error}`);
      }

      return this.lastPointValue(payload.series ?? []);
    } finally {
      clearTimeout(timeout);
    }
  }

  private lastPointValue(series: DatadogSeries[]): number {
    let latestTimestamp = -Infinity;
    let latestValue = 0;

    for (const item of series) {
      const points = item.pointlist ?? [];
      for (const [timestamp, value] of points) {
        if (typeof value !== "number" || Number.isNaN(value)) {
          continue;
        }

        if (timestamp >= latestTimestamp) {
          latestTimestamp = timestamp;
          latestValue = value;
        }
      }
    }

    return Number.isFinite(latestValue) ? latestValue : 0;
  }
}

export type ObservabilityProvider = "api" | "datadog" | "none";

function inferProviderFromEnv(): ObservabilityProvider {
  const explicit = (process.env.OBSERVABILITY_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "api" || explicit === "datadog" || explicit === "none") {
    return explicit;
  }

  if (process.env.DATADOG_API_KEY && process.env.DATADOG_APP_KEY) {
    return "datadog";
  }

  if (process.env.OBSERVABILITY_API_BASE_URL) {
    return "api";
  }

  return "none";
}

export function createObservabilityClientFromEnv(): ObservabilityClient | null {
  const provider = inferProviderFromEnv();

  if (provider === "datadog") {
    const apiKey = process.env.DATADOG_API_KEY;
    const appKey = process.env.DATADOG_APP_KEY;

    if (!apiKey || !appKey) {
      return null;
    }

    return new DatadogObservabilityClient({
      apiKey,
      appKey,
      apiBaseUrl:
        process.env.DATADOG_API_BASE_URL ??
        process.env.DATADOG_HOST ??
        "https://api.datadoghq.com",
      timeoutMs: Number(process.env.DATADOG_API_TIMEOUT_MS ?? "15000"),
      windowMinutes: Number(process.env.DATADOG_WINDOW_MINUTES ?? "30"),
      ...(process.env.DATADOG_ERROR_RATE_QUERY
        ? { errorRateQueryTemplate: process.env.DATADOG_ERROR_RATE_QUERY }
        : {}),
      ...(process.env.DATADOG_LATENCY_P95_QUERY
        ? { latencyP95QueryTemplate: process.env.DATADOG_LATENCY_P95_QUERY }
        : {}),
      ...(process.env.DATADOG_FAILED_REQUESTS_QUERY
        ? { failedRequestsQueryTemplate: process.env.DATADOG_FAILED_REQUESTS_QUERY }
        : {}),
      ...(process.env.DATADOG_BUSINESS_KPI_DROP_QUERY
        ? { businessKpiDropQueryTemplate: process.env.DATADOG_BUSINESS_KPI_DROP_QUERY }
        : {}),
      ...(process.env.DATADOG_SMOKE_TESTS_QUERY
        ? { smokeTestsQueryTemplate: process.env.DATADOG_SMOKE_TESTS_QUERY }
        : {}),
      smokeTestsMinValue: Number(process.env.DATADOG_SMOKE_TESTS_MIN ?? "1"),
      ...(process.env.DATADOG_CANARY_DURATION_QUERY
        ? { canaryDurationQueryTemplate: process.env.DATADOG_CANARY_DURATION_QUERY }
        : {}),
      ...(process.env.DATADOG_CANARY_TRAFFIC_QUERY
        ? { canaryTrafficQueryTemplate: process.env.DATADOG_CANARY_TRAFFIC_QUERY }
        : {}),
      defaultCanaryDurationMinutes: Number(
        process.env.DATADOG_CANARY_DURATION_MINUTES ?? "30"
      ),
      defaultCanaryTrafficPct: Number(process.env.DATADOG_CANARY_TRAFFIC_PCT ?? "10")
    });
  }

  if (provider === "api") {
    const baseUrl = process.env.OBSERVABILITY_API_BASE_URL;
    const token = process.env.OBSERVABILITY_API_TOKEN;

    if (!baseUrl) {
      return null;
    }

    return new ObservabilityApiClient({
      baseUrl,
      ...(token ? { token } : {}),
      timeoutMs: Number(process.env.OBSERVABILITY_API_TIMEOUT_MS ?? "15000")
    });
  }

  return null;
}
