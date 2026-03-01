# Branch Protection Automation

This project ships `scripts/configure-branch-protection.mjs` to apply baseline merge safety rules.

## Required checks (default)

- `validate`
- `pr-metadata`
- `reviewer-gate`

## Local usage

```bash
npm run branch-protection:apply -- --repo owner/repo --branch main --dry-run
npm run branch-protection:apply -- --repo owner/repo --branch main
```

## GitHub Actions usage

Use workflow `.github/workflows/branch-protection.yml`.

Requirements:

- repository secret `ADMIN_GITHUB_TOKEN` with admin access to target repo
- branch target (default `main`)

## Notes

- `--dry-run` prints the API payload without mutating GitHub settings.
- `--checks` can override required status checks (comma-separated).
