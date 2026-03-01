# Public Interfaces

## TypeScript contracts

`src/types/contracts.ts` defines the orchestrator-facing interfaces:

- `WorkItem`
- `AgentDecision`
- `PolicyResult`
- `PRMetadata`
- `ReviewInput/ReviewOutput`
- `ReleaseInput/ReleaseOutput`
- `IncidentSignal/IncidentOutput`

These interfaces are considered stable integration contracts for scripts and workflows.

## PR metadata JSON contract

Embedded in PR body between markers:

- `<!-- agent-metadata:start -->`
- `<!-- agent-metadata:end -->`

Required fields:

- `workItemId`
- `risk`
- `testPlan`
- `rollbackPlan`
- `policyResult`

Validated by `npm run agent:review:check`.

## GitHub label contract

- `agent:queued`
- `agent:in-progress`
- `agent:blocked`
- `agent:review`
- `agent:release`
- `agent:done`
- `risk:low`
- `risk:medium`
- `risk:high`
- `autonomy:auto`
- `autonomy:needs-human`

## Live API integrations

`agent:release` supports:

- `--live-metrics` (source rollout metrics from observability API)
- `--apply` (execute promote/rollback against deployment API)
- `--service <name>` (service identity in external APIs)

`agent:incident` supports:

- `--live-signal` (source incident signal from observability API)
- `--apply` (execute rollback against deployment API)
- `--report-issue` (create GitHub incident issue via REST API)
- `--service <name>`

Environment variables:

- `OBSERVABILITY_PROVIDER` (`api`, `datadog`, `prometheus`, `none`)
- `OBSERVABILITY_API_BASE_URL`, `OBSERVABILITY_API_TOKEN`
- `DATADOG_API_KEY`, `DATADOG_APP_KEY`, `DATADOG_API_BASE_URL`
- `DATADOG_ERROR_RATE_QUERY`, `DATADOG_LATENCY_P95_QUERY`, `DATADOG_FAILED_REQUESTS_QUERY`, `DATADOG_BUSINESS_KPI_DROP_QUERY`
- `DATADOG_SMOKE_TESTS_QUERY`, `DATADOG_SMOKE_TESTS_MIN`, `DATADOG_CANARY_DURATION_QUERY`, `DATADOG_CANARY_TRAFFIC_QUERY`
- `PROMETHEUS_BASE_URL`, `PROMETHEUS_BEARER_TOKEN`, `PROMETHEUS_API_TIMEOUT_MS`
- `PROMETHEUS_ERROR_RATE_QUERY`, `PROMETHEUS_LATENCY_P95_QUERY`, `PROMETHEUS_FAILED_REQUESTS_QUERY`, `PROMETHEUS_BUSINESS_KPI_DROP_QUERY`
- `PROMETHEUS_SMOKE_TESTS_QUERY`, `PROMETHEUS_SMOKE_TESTS_MIN`, `PROMETHEUS_CANARY_DURATION_QUERY`, `PROMETHEUS_CANARY_TRAFFIC_QUERY`
- `PROMETHEUS_CANARY_DURATION_MINUTES`, `PROMETHEUS_CANARY_TRAFFIC_PCT`
- `DEPLOYMENT_PROVIDER` (`api`, `argo-rollouts`, `noop`)
- `DEPLOY_API_BASE_URL`, `DEPLOY_API_TOKEN`
- `ARGO_ROLLOUT_NAME`, `ARGO_ROLLOUT_NAMESPACE`, `KUBECONFIG_CONTEXT`, `ARGO_ROLLOUT_FULL_PROMOTION`
- `GITHUB_TOKEN`, `GITHUB_REPOSITORY`
