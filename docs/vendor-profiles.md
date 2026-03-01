# Vendor Profiles

## Datadog + Argo Rollouts

This profile uses:

- Datadog Metrics Query API (`GET /api/v1/query`) for rollout/incident metrics.
- Argo Rollouts kubectl plugin commands for deployment actions.

### Required environment variables

```bash
export OBSERVABILITY_PROVIDER="datadog"
export DATADOG_API_KEY="..."
export DATADOG_APP_KEY="..."

export DEPLOYMENT_PROVIDER="argo-rollouts"
export ARGO_ROLLOUT_NAME="web-api"
export ARGO_ROLLOUT_NAMESPACE="production"
```

### Recommended Datadog query templates

```bash
export DATADOG_ERROR_RATE_QUERY="avg:service.error_rate{service:${service},stage:${stage}}"
export DATADOG_LATENCY_P95_QUERY="avg:service.latency.p95{service:${service},stage:${stage}}"
export DATADOG_FAILED_REQUESTS_QUERY="sum:service.request.failures{service:${service},stage:${stage}}"
export DATADOG_BUSINESS_KPI_DROP_QUERY="avg:service.business_kpi_drop_pct{service:${service},stage:${stage}}"
```

Optional:

```bash
export DATADOG_SMOKE_TESTS_QUERY="avg:service.smoke_tests_passed{service:${service},stage:${stage}}"
export DATADOG_SMOKE_TESTS_MIN="1"
export DATADOG_CANARY_DURATION_QUERY="max:service.canary.duration_minutes{service:${service}}"
export DATADOG_CANARY_TRAFFIC_QUERY="max:service.canary.traffic_pct{service:${service}}"
```

### Runtime requirements for Argo Rollouts

The runner must have:

- `kubectl`
- Argo Rollouts plugin (`kubectl argo rollouts`)
- access to target cluster/namespace

### Validate configuration

```bash
npm run config:validate -- --scope release
npm run config:validate -- --scope incident
```

### Command behavior

- Promotion: `kubectl argo rollouts promote <rollout> -n <namespace> [--full]`
- Rollback: `kubectl argo rollouts abort <rollout> -n <namespace>`

## Prometheus + Argo Rollouts

This profile uses:

- Prometheus Query API (`GET /api/v1/query`) for rollout/incident metrics.
- Argo Rollouts kubectl plugin commands for deployment actions.

### Required environment variables

```bash
export OBSERVABILITY_PROVIDER="prometheus"
export PROMETHEUS_BASE_URL="https://prometheus.example.com"
export PROMETHEUS_BEARER_TOKEN="..."

export DEPLOYMENT_PROVIDER="argo-rollouts"
export ARGO_ROLLOUT_NAME="web-api"
export ARGO_ROLLOUT_NAMESPACE="production"
```

### Recommended Prometheus query templates

```bash
export PROMETHEUS_ERROR_RATE_QUERY='avg(service_error_rate_pct{service="${service}",stage="${stage}"})'
export PROMETHEUS_LATENCY_P95_QUERY='avg(service_latency_p95_ms{service="${service}",stage="${stage}"})'
export PROMETHEUS_FAILED_REQUESTS_QUERY='sum(service_failed_requests{service="${service}",stage="${stage}"})'
export PROMETHEUS_BUSINESS_KPI_DROP_QUERY='avg(service_business_kpi_drop_pct{service="${service}",stage="${stage}"})'
```

Optional:

```bash
export PROMETHEUS_SMOKE_TESTS_QUERY='avg(service_smoke_tests_passed{service="${service}",stage="${stage}"})'
export PROMETHEUS_SMOKE_TESTS_MIN="1"
export PROMETHEUS_CANARY_DURATION_QUERY='max(service_canary_duration_minutes{service="${service}"})'
export PROMETHEUS_CANARY_TRAFFIC_QUERY='max(service_canary_traffic_pct{service="${service}"})'
```

### Runtime requirements for Argo Rollouts

The runner must have:

- `kubectl`
- Argo Rollouts plugin (`kubectl argo rollouts`)
- access to target cluster/namespace

### Validate configuration

```bash
npm run config:validate -- --scope release
npm run providers:preflight -- --scope release --probe
npm run config:validate -- --scope incident
npm run providers:preflight -- --scope incident --probe
```
