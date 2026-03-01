# Codex Agentic Pilot

GitHub-native, mostly autonomous software delivery pipeline with specialist agents:

- `planner` for intake, risk classification, and task graph
- `builder` for branch/PR preparation and metadata contract
- `tester` for continuous test-plan generation
- `reviewer` for merge policy gates
- `release` for staged rollout and canary promotion logic
- `incident` for regression detection and rollback escalation

## Why this exists

This repository implements the 90-day pilot blueprint for an autonomous software team that can:

- convert issues into executable work items
- generate PR metadata and policy evidence
- enforce CI + merge gates
- run staged release checks
- trigger rollback on incident thresholds
- produce weekly governance reports

## Quickstart

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run security:scan
```

## Local execution examples

### 1) Issue intake -> planner/builder/tester

```bash
npm run agent:issue -- --issue-id 42 --repo local/codex --title "Add onboarding API" --body "- [ ] Add endpoint\n- [ ] Add tests"
cat .agent/run-summary.json
```

### 2) Reviewer gate

```bash
cat > .agent/checks.json <<'JSON'
{
  "typecheck": true,
  "lint": true,
  "unit": true,
  "integration": true,
  "security": true,
  "agentReview": true
}
JSON

npm run agent:review -- --work-item .agent/work-item-42.json --checks .agent/checks.json --coverage-drop 0
cat .agent/review-summary.json
```

### 3) Release stage decision

```bash
npm run agent:release -- --work-item ops/samples/work-item.json --metrics ops/samples/rollout-metrics-good.json --stage canary
cat .agent/release-summary.json
```

### 3b) Live release with deployment API

```bash
export OBSERVABILITY_PROVIDER="api"
export OBSERVABILITY_API_BASE_URL="https://observability.example.com"
export OBSERVABILITY_API_TOKEN="..."
export DEPLOYMENT_PROVIDER="api"
export DEPLOY_API_BASE_URL="https://deploy.example.com"
export DEPLOY_API_TOKEN="..."

npm run agent:release -- \
  --work-item ops/samples/work-item.json \
  --stage canary \
  --service web-api \
  --live-metrics \
  --apply
```

### 4) Incident monitor

```bash
npm run agent:incident -- --work-item ops/samples/work-item.json --metrics ops/samples/incident-signal-bad.json
cat .agent/incident-summary.json
```

### 4b) Live incident monitor with rollback + issue creation

```bash
export OBSERVABILITY_PROVIDER="api"
export OBSERVABILITY_API_BASE_URL="https://observability.example.com"
export OBSERVABILITY_API_TOKEN="..."
export DEPLOYMENT_PROVIDER="api"
export DEPLOY_API_BASE_URL="https://deploy.example.com"
export DEPLOY_API_TOKEN="..."
export GITHUB_TOKEN="..."
export GITHUB_REPOSITORY="owner/repo"

npm run agent:incident -- \
  --work-item ops/samples/work-item.json \
  --service web-api \
  --live-signal \
  --apply \
  --report-issue
```

### 4c) Vendor profile: Datadog + Argo Rollouts

```bash
export OBSERVABILITY_PROVIDER="datadog"
export DATADOG_API_KEY="..."
export DATADOG_APP_KEY="..."
export DATADOG_API_BASE_URL="https://api.datadoghq.com"
export DATADOG_ERROR_RATE_QUERY="avg:service.error_rate{service:${service},stage:${stage}}"
export DATADOG_LATENCY_P95_QUERY="avg:service.latency.p95{service:${service},stage:${stage}}"
export DATADOG_FAILED_REQUESTS_QUERY="sum:service.request.failures{service:${service},stage:${stage}}"
export DATADOG_BUSINESS_KPI_DROP_QUERY="avg:service.business_kpi_drop_pct{service:${service},stage:${stage}}"

export DEPLOYMENT_PROVIDER="argo-rollouts"
export ARGO_ROLLOUT_NAME="web-api"
export ARGO_ROLLOUT_NAMESPACE="production"
export ARGO_ROLLOUT_FULL_PROMOTION="true"

# Requires kubectl + argo rollouts plugin:
# kubectl argo rollouts promote ...
# kubectl argo rollouts abort ...
```

### 5) Governance report

```bash
npm run governance:report
cat .agent/governance-report.md
```

## GitHub control plane

- Issue template: [`.github/ISSUE_TEMPLATE/agent-task.yml`](.github/ISSUE_TEMPLATE/agent-task.yml)
- PR metadata contract: [`.github/pull_request_template.md`](.github/pull_request_template.md)
- Workflows:
  - [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
  - [`.github/workflows/agent-orchestrator.yml`](.github/workflows/agent-orchestrator.yml)
  - [`.github/workflows/agent-policy-gate.yml`](.github/workflows/agent-policy-gate.yml)
  - [`.github/workflows/release-agent.yml`](.github/workflows/release-agent.yml)
  - [`.github/workflows/incident-monitor.yml`](.github/workflows/incident-monitor.yml)
  - [`.github/workflows/branch-protection.yml`](.github/workflows/branch-protection.yml)
  - [`.github/workflows/weekly-governance.yml`](.github/workflows/weekly-governance.yml)

## Labels

Sync labels in a GitHub repo with:

```bash
npm run labels:sync
```

Required labels and semantics are documented in [`docs/operating-model.md`](docs/operating-model.md).
Vendor profiles are documented in [`docs/vendor-profiles.md`](docs/vendor-profiles.md).
Exact repo setup checklist is in [`docs/secrets-vars-checklist.md`](docs/secrets-vars-checklist.md).
Copy-paste setup for this repo (`hiroshiuehara1/codex`) is in [`docs/datadog-argo-copy-paste-template.md`](docs/datadog-argo-copy-paste-template.md).

## Branch protection

Apply protection rules (required checks + PR review + conversation resolution):

```bash
npm run branch-protection:apply -- --repo owner/repo --branch main --dry-run
npm run branch-protection:apply -- --repo owner/repo --branch main
```

Use a token with admin permissions on the repository when applying changes.

## Config validation

Validate secrets/variables before running live workflows:

```bash
npm run config:validate -- --scope release
npm run config:validate -- --scope incident
npm run config:validate -- --scope branch-protection
```
