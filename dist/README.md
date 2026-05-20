# Repo scheduler platform guides

GitHub Actions cron can drift, skip runs, or start late. If you need a more
predictable schedule, deploy an external scheduler that dispatches
`repository_dispatch` events to your target repo.

## How it works

Each platform runs a scheduled serverless function. On every invocation, it
authenticates as your GitHub App and calls `repository_dispatch` on the target
repository with your configured event type.

Install your GitHub App on the target repository and grant `contents:write` so it
can dispatch events.

## Configuration

| Variable            | Required | Sensitive | Description                                         |
| ------------------- | -------- | --------- | --------------------------------------------------- |
| `GITHUB_APP_ID`     | Yes      | No        | Numeric GitHub App ID                               |
| `GITHUB_APP_PK`     | Yes      | Yes       | PEM-encoded private key (via secret store)          |
| `GITHUB_REPO`       | Yes      | No        | Target repository in `owner/repo` form              |
| `GITHUB_EVENT_TYPE` | Yes      | No        | `repository_dispatch` event type string             |
| `GITHUB_PAYLOAD`    | No       | No        | JSON string for `client_payload` (defaults to `{}`) |

Each platform stores the private key in its native secret manager. See the
individual platform guide for details.

## Platform guides

- [Cloudflare Worker scheduler][cloudflare-worker]
- [AWS Lambda scheduler][aws-lambda]
- [Google Cloud Run scheduler][gcp-cloud-run]
- [Azure Function scheduler][azure-function]

[cloudflare-worker]: ./cloudflare-worker/README.md
[aws-lambda]: ./aws-lambda/README.md
[gcp-cloud-run]: ./gcp-cloud-run/README.md
[azure-function]: ./azure-function/README.md
