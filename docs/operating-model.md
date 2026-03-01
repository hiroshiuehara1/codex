# Operating Model

## Work intake

1. Team files an `Agent Task` issue.
2. Planner classifies `workType`, `risk`, acceptance criteria, and task graph.
3. Planner applies labels:
   - `agent:in-progress`
   - `risk:low|medium|high`
   - `autonomy:auto|autonomy:needs-human`

## Build and test

1. Builder prepares:
   - branch `codex/agent/<issue-id>/<run-id>`
   - PR title and body sections
   - machine-readable metadata block
2. Tester generates unit/integration/e2e test plan.

## Review and merge

Reviewer enforces required checks:

- typecheck
- lint
- unit
- integration
- security
- agentReview

Merge is blocked when:

- any required check fails
- coverage drop exceeds 2%
- risk is `high` without explicit human approval

## Release progression

Stages:

1. staging
2. canary (10% traffic, min 30 minutes by policy)
3. full

Canary hard stops:

- error rate > 2%
- p95 latency > 500ms
- failed requests > 25
- business KPI drop > 3%

Any breach triggers rollback path.

Live mode integrations:

- Observability providers:
  - Generic API (`OBSERVABILITY_PROVIDER=api`, `OBSERVABILITY_API_BASE_URL`)
  - Datadog Metrics Query API (`OBSERVABILITY_PROVIDER=datadog`, `DATADOG_API_KEY`, `DATADOG_APP_KEY`)
  - Prometheus Query API (`OBSERVABILITY_PROVIDER=prometheus`, `PROMETHEUS_BASE_URL`)
- Deployment providers:
  - Generic API (`DEPLOYMENT_PROVIDER=api`, `DEPLOY_API_BASE_URL`)
  - Argo Rollouts via `kubectl argo rollouts` (`DEPLOYMENT_PROVIDER=argo-rollouts`)
- GitHub Issues API (`GITHUB_TOKEN`, `GITHUB_REPOSITORY`) for incident issue creation.

## Incident + rollback

Incident monitor runs continuously/scheduled and evaluates thresholds. If breached:

1. mark deployment unhealthy
2. trigger rollback
3. open root-cause issue and follow-up fix task

## Governance

Every agent decision is logged as NDJSON with:

- timestamp
- input context hash
- tool call list
- decision reason/confidence
- policy result (when relevant)

A weekly report aggregates decisions by agent/action and approval volume.

## Branch protection baseline

Baseline branch protection should enforce:

- required checks: `validate`, `pr-metadata`, `reviewer-gate`
- at least 1 approving review
- stale review dismissal on updates
- linear history
- conversation resolution before merge

Use `npm run branch-protection:apply` (or the `Branch Protection` workflow) to apply these settings.
