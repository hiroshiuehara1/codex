# Secrets and Variables Checklist

Use this checklist to configure GitHub repository settings for live agent execution.

## Profile A: Generic API (observability + deployment)

### Repository secrets

- `OBSERVABILITY_API_BASE_URL`
- `OBSERVABILITY_API_TOKEN` (optional if your API is public)
- `DEPLOY_API_BASE_URL`
- `DEPLOY_API_TOKEN` (optional if your deploy API is public)
- `GITHUB_TOKEN` is automatically provided by Actions for issue creation
- `ADMIN_GITHUB_TOKEN` for branch protection workflow (repo admin token)

### Repository variables

- `OBSERVABILITY_PROVIDER=api`
- `DEPLOYMENT_PROVIDER=api`
- `SERVICE_NAME=web-api` (or your service name)
- `AUTO_USE_LIVE_SIGNAL=false` (for scheduled incident monitor)
- `AUTO_APPLY_INCIDENT_ACTIONS=false` (start safe)
- `AUTO_REPORT_INCIDENT_ISSUE=true`

## Profile B: Datadog + Argo Rollouts

### Repository secrets

- `DATADOG_API_KEY`
- `DATADOG_APP_KEY`
- `ADMIN_GITHUB_TOKEN`
- `GITHUB_TOKEN` is automatically provided by Actions

### Repository variables

- `OBSERVABILITY_PROVIDER=datadog`
- `DEPLOYMENT_PROVIDER=argo-rollouts`
- `SERVICE_NAME=web-api`
- `ARGO_ROLLOUT_NAME=web-api`
- `ARGO_ROLLOUT_NAMESPACE=production`
- `ARGO_ROLLOUT_FULL_PROMOTION=true`
- `KUBECONFIG_CONTEXT=<cluster-context>` (optional)
- `DATADOG_API_BASE_URL=https://api.datadoghq.com`
- `DATADOG_ERROR_RATE_QUERY=avg:service.error_rate{service:${service},stage:${stage}}`
- `DATADOG_LATENCY_P95_QUERY=avg:service.latency.p95{service:${service},stage:${stage}}`
- `DATADOG_FAILED_REQUESTS_QUERY=sum:service.request.failures{service:${service},stage:${stage}}`
- `DATADOG_BUSINESS_KPI_DROP_QUERY=avg:service.business_kpi_drop_pct{service:${service},stage:${stage}}`
- `DATADOG_SMOKE_TESTS_QUERY=avg:service.smoke_tests_passed{service:${service},stage:${stage}}` (optional)
- `DATADOG_SMOKE_TESTS_MIN=1` (optional)
- `DATADOG_CANARY_DURATION_QUERY=max:service.canary.duration_minutes{service:${service}}` (optional)
- `DATADOG_CANARY_TRAFFIC_QUERY=max:service.canary.traffic_pct{service:${service}}` (optional)
- `DATADOG_CANARY_DURATION_MINUTES=30`
- `DATADOG_CANARY_TRAFFIC_PCT=10`
- `AUTO_USE_LIVE_SIGNAL=true` (if scheduled monitor should use live signal)
- `AUTO_APPLY_INCIDENT_ACTIONS=false` (start safe)
- `AUTO_REPORT_INCIDENT_ISSUE=true`

## Validation commands

Run these locally or in CI (with env loaded):

```bash
npm run config:validate -- --scope release
npm run config:validate -- --scope incident
npm run config:validate -- --scope branch-protection
```

## Rollout recommendation

1. Start with live metrics/signal enabled and apply actions disabled.
2. Verify summaries in `.agent/release-summary.json` and `.agent/incident-summary.json`.
3. Enable apply actions only after two successful dry runs.
