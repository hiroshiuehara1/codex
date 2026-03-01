import assert from "node:assert/strict";
import test from "node:test";
import {
  GitHubIssueReporter,
  NoopIssueReporter,
  createIssueReporterFromEnv
} from "../../src/incident/issue-reporter.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("github issue reporter creates issue", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /api.github.com/);
    assert.equal((init?.method ?? "GET").toUpperCase(), "POST");
    return jsonResponse({ number: 101, html_url: "https://github.com/org/repo/issues/101" });
  };

  try {
    const reporter = new GitHubIssueReporter({
      repo: "org/repo",
      token: "ghs_token"
    });

    const result = await reporter.createIssue({
      title: "Incident",
      body: "Rollback triggered",
      labels: ["incident:auto"]
    });

    assert.equal(result.created, true);
    assert.equal(result.issueNumber, 101);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("no-op reporter skips issue creation", async () => {
  const reporter = new NoopIssueReporter();
  const result = await reporter.createIssue({ title: "x", body: "y" });
  assert.equal(result.created, false);
});

test("factory returns no-op when token missing", async () => {
  const prevRepo = process.env.GITHUB_REPOSITORY;
  const prevToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_TOKEN;

  try {
    const reporter = createIssueReporterFromEnv();
    const result = await reporter.createIssue({ title: "x", body: "y" });
    assert.equal(result.created, false);
  } finally {
    if (prevRepo) {
      process.env.GITHUB_REPOSITORY = prevRepo;
    }
    if (prevToken) {
      process.env.GITHUB_TOKEN = prevToken;
    }
  }
});
