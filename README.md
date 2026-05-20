# Repo scheduler

_Schedules repository events for more reliable GitHub Actions workflow runs_

GitHub Actions cron schedules are unreliable — they can drift, skip, or start
late. This project provides serverless scheduler implementations for multiple
cloud platforms that dispatch `repository_dispatch` events on a fixed schedule
using a GitHub App for authentication.

## How it works

Each platform implementation authenticates as a GitHub App and dispatches a
`repository_dispatch` event with your configured event type and optional
payload.

The target repository can then use `on: repository_dispatch` in any workflow to
respond to the event.

## Configuration

| Variable            | Required | Sensitive | Description                            |
| ------------------- | -------- | --------- | -------------------------------------- |
| `GITHUB_APP_ID`     | Yes      | No        | GitHub App ID                          |
| `GITHUB_APP_PK`     | Yes      | Yes       | GitHub App PEM-encoded private key     |
| `GITHUB_REPO`       | Yes      | No        | Target repository in `owner/repo` form |
| `GITHUB_EVENT_TYPE` | Yes      | No        | `repository_dispatch` event type       |
| `GITHUB_PAYLOAD`    | No       | No        | JSON for `client_payload`              |

Each platform stores the private key in its native secret manager. See the
individual platform guide for details.

## Platforms

- [Cloudflare Workers](dist/cloudflare-worker/README.md)
- [AWS Lambda](dist/aws-lambda/README.md)
- [Google Cloud Run](dist/gcp-cloud-run/README.md)
- [Azure Functions](dist/azure-function/README.md)
