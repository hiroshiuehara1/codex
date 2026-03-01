function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) {
    return fallback;
  }
  return process.argv[idx + 1] ?? fallback;
}

function normalizeBoolean(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function isSet(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0);
}

function inferObservabilityProvider() {
  const explicit = String(process.env.OBSERVABILITY_PROVIDER ?? "").trim().toLowerCase();
  if (["api", "datadog", "none"].includes(explicit)) {
    return explicit;
  }
  if (isSet("DATADOG_API_KEY") && isSet("DATADOG_APP_KEY")) {
    return "datadog";
  }
  if (isSet("OBSERVABILITY_API_BASE_URL")) {
    return "api";
  }
  return "none";
}

function inferDeploymentProvider() {
  const explicit = String(process.env.DEPLOYMENT_PROVIDER ?? "").trim().toLowerCase();
  if (["api", "argo-rollouts", "noop"].includes(explicit)) {
    return explicit;
  }
  if (isSet("ARGO_ROLLOUT_NAME")) {
    return "argo-rollouts";
  }
  if (isSet("DEPLOY_API_BASE_URL")) {
    return "api";
  }
  return "noop";
}

function missingVars(names) {
  return names.filter((name) => !isSet(name));
}

function validateObservability(provider, required) {
  if (!required) {
    return { errors: [], warnings: [] };
  }

  if (provider === "datadog") {
    const missing = missingVars(["DATADOG_API_KEY", "DATADOG_APP_KEY"]);
    return {
      errors: missing.map((name) => `Missing ${name} for datadog observability provider.`),
      warnings: []
    };
  }

  if (provider === "api") {
    const missing = missingVars(["OBSERVABILITY_API_BASE_URL"]);
    return {
      errors: missing.map((name) => `Missing ${name} for api observability provider.`),
      warnings: []
    };
  }

  return {
    errors: [
      "Observability provider is not configured, but live metrics/signal is enabled. Set OBSERVABILITY_PROVIDER=api or datadog."
    ],
    warnings: []
  };
}

function validateDeployment(provider, required) {
  if (!required) {
    return { errors: [], warnings: [] };
  }

  if (provider === "argo-rollouts") {
    const missing = missingVars(["ARGO_ROLLOUT_NAME"]);
    return {
      errors: missing.map((name) => `Missing ${name} for argo-rollouts deployment provider.`),
      warnings: missing.length === 0 && !isSet("ARGO_ROLLOUT_NAMESPACE")
        ? ["ARGO_ROLLOUT_NAMESPACE is not set; default namespace will be used."]
        : []
    };
  }

  if (provider === "api") {
    const missing = missingVars(["DEPLOY_API_BASE_URL"]);
    return {
      errors: missing.map((name) => `Missing ${name} for api deployment provider.`),
      warnings: []
    };
  }

  return {
    errors: [
      "Deployment provider is noop, but apply action is enabled. Set DEPLOYMENT_PROVIDER=api or argo-rollouts."
    ],
    warnings: []
  };
}

function validateIssueReporting(required) {
  if (!required) {
    return { errors: [], warnings: [] };
  }

  const missing = missingVars(["GITHUB_TOKEN", "GITHUB_REPOSITORY"]);
  return {
    errors: missing.map((name) => `Missing ${name} for incident issue reporting.`),
    warnings: []
  };
}

function validateBranchProtection() {
  const missing = missingVars(["GITHUB_TOKEN", "GITHUB_REPOSITORY"]);
  return {
    errors: missing.map((name) => `Missing ${name} for branch-protection automation.`),
    warnings: []
  };
}

function main() {
  const scope = String(arg("--scope", "both")).trim().toLowerCase();
  const strict = normalizeBoolean(arg("--strict", "false"));

  const useLiveMetrics = normalizeBoolean(
    arg("--use-live-metrics", process.env.USE_LIVE_METRICS ?? "false")
  );
  const applyDeployment = normalizeBoolean(
    arg("--apply-deployment", process.env.APPLY_DEPLOYMENT ?? "false")
  );

  const useLiveSignal = normalizeBoolean(
    arg("--use-live-signal", process.env.USE_LIVE_SIGNAL ?? "false")
  );
  const applyActions = normalizeBoolean(
    arg("--apply-actions", process.env.APPLY_ACTIONS ?? "false")
  );
  const reportIssue = normalizeBoolean(
    arg("--report-issue", process.env.REPORT_ISSUE ?? "false")
  );

  const observabilityProvider = inferObservabilityProvider();
  const deploymentProvider = inferDeploymentProvider();

  const errors = [];
  const warnings = [];

  const checkRelease = scope === "release" || scope === "both";
  const checkIncident = scope === "incident" || scope === "both";
  const checkBranchProtection = scope === "branch-protection" || scope === "both";

  if (checkRelease) {
    const obs = validateObservability(observabilityProvider, useLiveMetrics);
    const dep = validateDeployment(deploymentProvider, applyDeployment);
    errors.push(...obs.errors, ...dep.errors);
    warnings.push(...obs.warnings, ...dep.warnings);
  }

  if (checkIncident) {
    const obs = validateObservability(observabilityProvider, useLiveSignal);
    const dep = validateDeployment(deploymentProvider, applyActions);
    const issue = validateIssueReporting(reportIssue);
    errors.push(...obs.errors, ...dep.errors, ...issue.errors);
    warnings.push(...obs.warnings, ...dep.warnings, ...issue.warnings);
  }

  if (checkBranchProtection) {
    const bp = validateBranchProtection();
    errors.push(...bp.errors);
    warnings.push(...bp.warnings);
  }

  process.stdout.write("Runtime config summary:\n");
  process.stdout.write(`- scope: ${scope}\n`);
  process.stdout.write(`- observability provider: ${observabilityProvider}\n`);
  process.stdout.write(`- deployment provider: ${deploymentProvider}\n`);
  process.stdout.write(`- release(use_live_metrics=${useLiveMetrics}, apply_deployment=${applyDeployment})\n`);
  process.stdout.write(`- incident(use_live_signal=${useLiveSignal}, apply_actions=${applyActions}, report_issue=${reportIssue})\n`);

  if (warnings.length > 0) {
    process.stdout.write("Warnings:\n");
    for (const warning of warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write("Configuration errors:\n");
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  if (strict && warnings.length > 0) {
    process.stderr.write("Strict mode enabled: warnings treated as failure.\n");
    process.exit(1);
  }

  process.stdout.write("Configuration is valid for the selected scope.\n");
}

main();
