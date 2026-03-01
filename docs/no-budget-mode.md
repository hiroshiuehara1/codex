# No-Budget Mode

Use this mode when you do not have paid observability/deployment integrations.

This keeps the agent team active for planning, building, tests, review, and policy gates, while disabling live rollout/incident actions.

## GitHub variables

Set these repository variables in `Settings -> Secrets and variables -> Actions`:

- `OBSERVABILITY_PROVIDER=none`
- `DEPLOYMENT_PROVIDER=noop`
- `AUTO_USE_LIVE_SIGNAL=false`
- `AUTO_APPLY_INCIDENT_ACTIONS=false`
- `AUTO_REPORT_INCIDENT_ISSUE=false`
- `SERVICE_NAME=web-api`

## Optional secrets

- `ADMIN_GITHUB_TOKEN` (needed only for branch-protection automation workflow)

No Datadog, Prometheus, or deployment API secrets are required in this mode.

## Safe workflow usage

When manually running workflows:

1. `Release Agent`
- `use_live_metrics=false`
- `apply_deployment=false`
2. `Incident Monitor`
- `use_live_signal=false`
- `apply_actions=false`
- `report_issue=false`

## What still works

- Issue intake and planner labeling
- Builder/tester/reviewer loop
- PR metadata and policy checks
- CI gates and branch protection
- Simulated release and incident evaluation from sample JSON inputs

## What is disabled

- Live canary metric pulls
- Live deploy promote/rollback execution
- Live incident telemetry polling
