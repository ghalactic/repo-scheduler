# Repository dispatch migration

Migrate the Ghalactic repo scheduler from `workflow_dispatch` to
`repository_dispatch`, clean up stale references from the extraction, add CI,
and make the schedule configurable where platforms support it.

## Dispatch module changes

Replace the current `DispatchConfig` interface:

```ts
export interface DispatchConfig {
  appId: string;
  privateKey: string;
  repo: string;
  eventType: string;
  payload?: Record<string, unknown>;
}
```

The `dispatch()` function changes:

- Remove default-branch resolution (not needed for `repository_dispatch`).
- Call `POST /repos/{owner}/{repo}/dispatches` with `event_type` and
  `client_payload`.
- `payload` defaults to `{}` if not provided.

## Environment variables

All platforms switch from:

| Old               | New                 | Required              |
| ----------------- | ------------------- | --------------------- |
| `GITHUB_WORKFLOW` | `GITHUB_EVENT_TYPE` | Yes                   |
| —                 | `GITHUB_PAYLOAD`    | No (defaults to `{}`) |

Each platform entrypoint:

- Reads `GITHUB_EVENT_TYPE` (required — throw if missing).
- Reads `GITHUB_PAYLOAD` (optional). If set, parse as JSON; throw with a clear
  message if parsing fails.
- Passes `eventType` and `payload` to `dispatch()`.

## Schedule configurability

| Platform   | Mechanism                                            | Default            |
| ---------- | ---------------------------------------------------- | ------------------ |
| AWS        | CloudFormation parameter `Schedule`                  | `rate(30 minutes)` |
| Azure      | App setting `%SCHEDULE_EXPRESSION%` in `app.timer()` | `0 */30 * * * *`   |
| Cloudflare | `crons` array in `wrangler.toml`                     | `*/30 * * * *`     |
| GCP        | `--schedule` flag on `gcloud scheduler jobs`         | `*/30 * * * *`     |

AWS and Azure schedules are adjustable without redeploying code. Cloudflare and
GCP require editing deploy-time config.

## Stale reference cleanup

Remove all mentions of "provision-github-tokens", "token-provider workflow", and
related phrasing from:

- `dist/` READMEs, templates, and deploy configs
- Source comments and test fixtures
- Top-level `README.md`

Replace with generic language about dispatching repository events.

## CI workflow

Add `.github/workflows/ci.yml` with inlined steps (adapted from the shared CI
workflow used by the source repo):

```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: make link-dependencies
      - run: make ci
```

No codecov integration initially — add later if needed.

## Test changes

- Update `dispatch.spec.ts` to test the new `eventType`/`payload` interface.
- Remove tests for default-branch resolution.
- Add tests for `GITHUB_PAYLOAD` parsing (valid JSON, invalid JSON, absent).
- Update platform entrypoint specs to use new env var names.

## Configuration table (updated)

| Variable            | Required | Sensitive | Description                                         |
| ------------------- | -------- | --------- | --------------------------------------------------- |
| `GITHUB_APP_ID`     | Yes      | No        | Numeric GitHub App ID                               |
| `GITHUB_APP_PK`     | Yes      | Yes       | PEM-encoded private key (via secret store)          |
| `GITHUB_REPO`       | Yes      | No        | Target repository in `owner/repo` form              |
| `GITHUB_EVENT_TYPE` | Yes      | No        | `repository_dispatch` event type string             |
| `GITHUB_PAYLOAD`    | No       | No        | JSON string for `client_payload` (defaults to `{}`) |
