import { spawnSync } from "node:child_process";

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) {
    return fallback;
  }
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
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

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf-8"
  });

  return {
    ok: (result.status ?? 1) === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

async function probeDatadog(baseUrl, apiKey, appKey, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/validate`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "DD-API-KEY": apiKey,
        "DD-APPLICATION-KEY": appKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        message: `Datadog validate failed ${response.status}: ${text || response.statusText}`
      };
    }

    return { ok: true, message: "Datadog credential probe passed" };
  } catch (error) {
    return {
      ok: false,
      message: `Datadog probe error: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const scope = String(arg("--scope", "both")).trim().toLowerCase();
  const useLiveMetrics = normalizeBoolean(
    arg("--use-live-metrics", process.env.USE_LIVE_METRICS ?? "false")
  );
  const useLiveSignal = normalizeBoolean(
    arg("--use-live-signal", process.env.USE_LIVE_SIGNAL ?? "false")
  );
  const applyDeployment = normalizeBoolean(
    arg("--apply-deployment", process.env.APPLY_DEPLOYMENT ?? "false")
  );
  const applyActions = normalizeBoolean(
    arg("--apply-actions", process.env.APPLY_ACTIONS ?? "false")
  );
  const reportIssue = normalizeBoolean(
    arg("--report-issue", process.env.REPORT_ISSUE ?? "false")
  );

  const strict = hasFlag("--strict");
  const probe = hasFlag("--probe");

  const observabilityProvider = inferObservabilityProvider();
  const deploymentProvider = inferDeploymentProvider();

  const releaseScope = scope === "release" || scope === "both";
  const incidentScope = scope === "incident" || scope === "both";

  const errors = [];
  const warnings = [];
  const checks = [];

  const observabilityRequired =
    (releaseScope && useLiveMetrics) || (incidentScope && useLiveSignal);

  if (observabilityRequired) {
    if (observabilityProvider === "datadog") {
      const missing = ["DATADOG_API_KEY", "DATADOG_APP_KEY"].filter((name) => !isSet(name));
      if (missing.length > 0) {
        errors.push(`Missing Datadog credentials: ${missing.join(", ")}`);
      } else if (probe) {
        const baseUrl = process.env.DATADOG_API_BASE_URL ?? "https://api.datadoghq.com";
        const result = await probeDatadog(
          baseUrl,
          process.env.DATADOG_API_KEY,
          process.env.DATADOG_APP_KEY,
          Number(process.env.DATADOG_API_TIMEOUT_MS ?? "15000")
        );
        checks.push(result.message);
        if (!result.ok) {
          errors.push(result.message);
        }
      }
    } else if (observabilityProvider === "api") {
      if (!isSet("OBSERVABILITY_API_BASE_URL")) {
        errors.push("OBSERVABILITY_API_BASE_URL is required for OBSERVABILITY_PROVIDER=api.");
      }
      if (probe && !isSet("OBSERVABILITY_API_TOKEN")) {
        warnings.push(
          "OBSERVABILITY_API_TOKEN is not set; ensure API endpoint allows unauthenticated reads."
        );
      }
    } else {
      errors.push(
        "Observability is required, but provider is none. Set OBSERVABILITY_PROVIDER=api or datadog."
      );
    }
  }

  const deploymentRequired =
    (releaseScope && applyDeployment) || (incidentScope && applyActions);

  if (deploymentRequired) {
    if (deploymentProvider === "argo-rollouts") {
      if (!isSet("ARGO_ROLLOUT_NAME")) {
        errors.push("ARGO_ROLLOUT_NAME is required for DEPLOYMENT_PROVIDER=argo-rollouts.");
      }
      const kubectlVersion = run("kubectl", ["version", "--client"]);
      if (!kubectlVersion.ok) {
        errors.push(`kubectl client check failed: ${kubectlVersion.stderr || kubectlVersion.stdout}`);
      }

      const args = [];
      if (isSet("KUBECONFIG_CONTEXT")) {
        args.push("--context", process.env.KUBECONFIG_CONTEXT);
      }
      args.push("argo", "rollouts", "version");
      const argoVersion = run("kubectl", args);
      if (!argoVersion.ok) {
        errors.push(
          `kubectl argo rollouts plugin check failed: ${argoVersion.stderr || argoVersion.stdout}`
        );
      }
    } else if (deploymentProvider === "api") {
      if (!isSet("DEPLOY_API_BASE_URL")) {
        errors.push("DEPLOY_API_BASE_URL is required for DEPLOYMENT_PROVIDER=api.");
      }
      if (probe && !isSet("DEPLOY_API_TOKEN")) {
        warnings.push(
          "DEPLOY_API_TOKEN is not set; ensure deployment API endpoint accepts current authentication mode."
        );
      }
    } else {
      errors.push(
        "Deployment actions are enabled but DEPLOYMENT_PROVIDER resolves to noop. Set provider to api or argo-rollouts."
      );
    }
  }

  if (incidentScope && reportIssue) {
    if (!isSet("GITHUB_TOKEN")) {
      errors.push("GITHUB_TOKEN is required when --report-issue is enabled.");
    }
    if (!isSet("GITHUB_REPOSITORY")) {
      errors.push("GITHUB_REPOSITORY is required when --report-issue is enabled.");
    }
  }

  process.stdout.write("Provider preflight summary:\n");
  process.stdout.write(`- scope: ${scope}\n`);
  process.stdout.write(`- observability provider: ${observabilityProvider}\n`);
  process.stdout.write(`- deployment provider: ${deploymentProvider}\n`);
  process.stdout.write(`- probe: ${probe}\n`);

  if (checks.length > 0) {
    process.stdout.write("Checks:\n");
    for (const check of checks) {
      process.stdout.write(`- ${check}\n`);
    }
  }

  if (warnings.length > 0) {
    process.stdout.write("Warnings:\n");
    for (const warning of warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write("Preflight errors:\n");
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  if (strict && warnings.length > 0) {
    process.stderr.write("Strict mode enabled: warnings treated as failure.\n");
    process.exit(1);
  }

  process.stdout.write("Provider preflight passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
