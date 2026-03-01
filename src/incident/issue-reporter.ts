export interface IssuePayload {
  title: string;
  body: string;
  labels?: string[];
}

export interface IssueCreateResult {
  created: boolean;
  issueNumber?: number;
  url?: string;
  message: string;
}

export interface IssueReporter {
  createIssue(payload: IssuePayload): Promise<IssueCreateResult>;
}

export class NoopIssueReporter implements IssueReporter {
  async createIssue(payload: IssuePayload): Promise<IssueCreateResult> {
    return {
      created: false,
      message: `No-op issue reporter: skipped issue creation (${payload.title})`
    };
  }
}

interface GitHubIssueReporterOptions {
  repo: string;
  token: string;
  apiBaseUrl?: string | undefined;
}

interface GitHubIssueResponse {
  number: number;
  html_url: string;
}

export class GitHubIssueReporter implements IssueReporter {
  private readonly repo: string;
  private readonly token: string;
  private readonly apiBaseUrl: string;

  constructor(options: GitHubIssueReporterOptions) {
    this.repo = options.repo;
    this.token = options.token;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
  }

  async createIssue(payload: IssuePayload): Promise<IssueCreateResult> {
    const response = await fetch(`${this.apiBaseUrl}/repos/${this.repo}/issues`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`GitHub issue API ${response.status}: ${text || response.statusText}`);
    }

    const data = (await response.json()) as GitHubIssueResponse;
    return {
      created: true,
      issueNumber: data.number,
      url: data.html_url,
      message: `Incident issue #${data.number} created`
    };
  }
}

export function createIssueReporterFromEnv(): IssueReporter {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repo || !token) {
    return new NoopIssueReporter();
  }

  return new GitHubIssueReporter({
    repo,
    token,
    ...(process.env.GITHUB_API_URL
      ? { apiBaseUrl: process.env.GITHUB_API_URL }
      : {})
  });
}
