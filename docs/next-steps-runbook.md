# Next Steps Runbook

This is the concrete execution sequence after code setup.

## 1) Configure profile

Pick one:

- Generic API profile (internal observability + deploy APIs)
- Datadog + Argo Rollouts profile
- Prometheus + Argo Rollouts profile (Datadog alternative)
- No-budget simulation profile (`OBSERVABILITY_PROVIDER=none`, `DEPLOYMENT_PROVIDER=noop`)

Set secrets/variables using [`docs/secrets-vars-checklist.md`](./secrets-vars-checklist.md).
For this repository with prefilled values, use [`docs/datadog-argo-copy-paste-template.md`](./datadog-argo-copy-paste-template.md).
Prometheus prefilled values for this repository are in [`docs/prometheus-argo-copy-paste-template.md`](./prometheus-argo-copy-paste-template.md).
No-budget workflow mode is in [`docs/no-budget-mode.md`](./no-budget-mode.md).

## 2) Validate config

```bash
npm run config:validate -- --scope release
npm run config:validate -- --scope incident
npm run config:validate -- --scope branch-protection
```

## 3) Preflight providers (connectivity/tools)

```bash
npm run providers:preflight -- --scope release --probe
npm run providers:preflight -- --scope incident --probe
```

For Argo mode, this checks:

- `kubectl` client availability
- `kubectl argo rollouts` plugin availability

For Datadog mode, this probes `GET /api/v1/validate`.
For Prometheus mode, this probes `GET /api/v1/query?query=up`.

## 4) Apply branch protection

```bash
npm run branch-protection:apply -- --repo owner/repo --branch main --dry-run
npm run branch-protection:apply -- --repo owner/repo --branch main
```

## 5) Run safe live workflow tests

- Release Agent:
  - `use_live_metrics=true`
  - `apply_deployment=false`
- Incident Monitor:
  - `use_live_signal=true`
  - `apply_actions=false`
  - `report_issue=true`

## 6) Enable actions

After successful dry runs:

- Release Agent: `apply_deployment=true`
- Incident Monitor: `apply_actions=true`

## 7) Start pilot issue flow

- Create issue from `Agent Task` template
- Verify labels, PR metadata, policy gate, and rollout/incident behavior

## 8) Weekly governance

- Review `governance-report` artifact weekly
- Track lead time, escaped defects, rollback triggers, and override rates
