# Datadog + Argo Rollouts Copy-Paste Template

This template is prefilled for your repo: `hiroshiuehara1/codex`.

Defaults used:

- `SERVICE_NAME=web-api`
- `ARGO_ROLLOUT_NAME=web-api`
- `ARGO_ROLLOUT_NAMESPACE=production`

## A) GitHub UI setup (fast)

In GitHub repo settings (`Settings -> Secrets and variables -> Actions`):

### Repository variables

Add exactly these key/value pairs:

- `OBSERVABILITY_PROVIDER=datadog`
- `DEPLOYMENT_PROVIDER=argo-rollouts`
- `SERVICE_NAME=web-api`
- `ARGO_ROLLOUT_NAME=web-api`
- `ARGO_ROLLOUT_NAMESPACE=production`
- `ARGO_ROLLOUT_FULL_PROMOTION=true`
- `AUTO_USE_LIVE_SIGNAL=true`
- `AUTO_APPLY_INCIDENT_ACTIONS=false`
- `AUTO_REPORT_INCIDENT_ISSUE=true`
- `DATADOG_API_BASE_URL=https://api.datadoghq.com`
- `DATADOG_ERROR_RATE_QUERY=avg:service.error_rate{service:${service},stage:${stage}}`
- `DATADOG_LATENCY_P95_QUERY=avg:service.latency.p95{service:${service},stage:${stage}}`
- `DATADOG_FAILED_REQUESTS_QUERY=sum:service.request.failures{service:${service},stage:${stage}}`
- `DATADOG_BUSINESS_KPI_DROP_QUERY=avg:service.business_kpi_drop_pct{service:${service},stage:${stage}}`
- `DATADOG_SMOKE_TESTS_QUERY=avg:service.smoke_tests_passed{service:${service},stage:${stage}}`
- `DATADOG_SMOKE_TESTS_MIN=1`
- `DATADOG_CANARY_DURATION_MINUTES=30`
- `DATADOG_CANARY_TRAFFIC_PCT=10`

Optional variables:

- `KUBECONFIG_CONTEXT=<your-cluster-context>`
- `DATADOG_CANARY_DURATION_QUERY=max:service.canary.duration_minutes{service:${service}}`
- `DATADOG_CANARY_TRAFFIC_QUERY=max:service.canary.traffic_pct{service:${service}}`

### Repository secrets

Add exactly these secrets:

- `DATADOG_API_KEY=<your-datadog-api-key>`
- `DATADOG_APP_KEY=<your-datadog-app-key>`
- `ADMIN_GITHUB_TOKEN=<your-admin-token-for-branch-protection-workflow>`

## B) GitHub CLI setup (copy-paste)

Run from local repo root (`/Users/hiroshiuehara/projects/codex`).

```bash
# Variables
gh variable set OBSERVABILITY_PROVIDER --repo hiroshiuehara1/codex --body "datadog"
gh variable set DEPLOYMENT_PROVIDER --repo hiroshiuehara1/codex --body "argo-rollouts"
gh variable set SERVICE_NAME --repo hiroshiuehara1/codex --body "web-api"
gh variable set ARGO_ROLLOUT_NAME --repo hiroshiuehara1/codex --body "web-api"
gh variable set ARGO_ROLLOUT_NAMESPACE --repo hiroshiuehara1/codex --body "production"
gh variable set ARGO_ROLLOUT_FULL_PROMOTION --repo hiroshiuehara1/codex --body "true"
gh variable set AUTO_USE_LIVE_SIGNAL --repo hiroshiuehara1/codex --body "true"
gh variable set AUTO_APPLY_INCIDENT_ACTIONS --repo hiroshiuehara1/codex --body "false"
gh variable set AUTO_REPORT_INCIDENT_ISSUE --repo hiroshiuehara1/codex --body "true"
gh variable set DATADOG_API_BASE_URL --repo hiroshiuehara1/codex --body "https://api.datadoghq.com"
gh variable set DATADOG_ERROR_RATE_QUERY --repo hiroshiuehara1/codex --body "avg:service.error_rate{service:${service},stage:${stage}}"
gh variable set DATADOG_LATENCY_P95_QUERY --repo hiroshiuehara1/codex --body "avg:service.latency.p95{service:${service},stage:${stage}}"
gh variable set DATADOG_FAILED_REQUESTS_QUERY --repo hiroshiuehara1/codex --body "sum:service.request.failures{service:${service},stage:${stage}}"
gh variable set DATADOG_BUSINESS_KPI_DROP_QUERY --repo hiroshiuehara1/codex --body "avg:service.business_kpi_drop_pct{service:${service},stage:${stage}}"
gh variable set DATADOG_SMOKE_TESTS_QUERY --repo hiroshiuehara1/codex --body "avg:service.smoke_tests_passed{service:${service},stage:${stage}}"
gh variable set DATADOG_SMOKE_TESTS_MIN --repo hiroshiuehara1/codex --body "1"
gh variable set DATADOG_CANARY_DURATION_MINUTES --repo hiroshiuehara1/codex --body "30"
gh variable set DATADOG_CANARY_TRAFFIC_PCT --repo hiroshiuehara1/codex --body "10"
```

Then set secrets (prompts will ask for values):

```bash
gh secret set DATADOG_API_KEY --repo hiroshiuehara1/codex
gh secret set DATADOG_APP_KEY --repo hiroshiuehara1/codex
gh secret set ADMIN_GITHUB_TOKEN --repo hiroshiuehara1/codex
```

## C) Validation and activation

```bash
npm run config:validate -- --scope release
npm run providers:preflight -- --scope release --probe
npm run config:validate -- --scope incident
npm run providers:preflight -- --scope incident --probe
```

Then run workflows:

1. `Release Agent`: `use_live_metrics=true`, `apply_deployment=false`
2. `Incident Monitor`: `use_live_signal=true`, `apply_actions=false`, `report_issue=true`
3. If stable, enable `apply_deployment=true` and `apply_actions=true`.
