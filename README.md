# Repo scheduler

_Schedules repository events for more reliable GitHub Actions workflow runs_

GitHub Actions cron schedules are unreliable — they can drift, skip, or start
late. This project provides serverless scheduler implementations for multiple
cloud platforms that dispatch `repository_dispatch` events on a fixed schedule
using a GitHub App for authentication.

## How it works

Each platform implementation authenticates as a GitHub App and dispatches a
`repository_dispatch` event with your configured event type and payload.

The target repository can then use `on: repository_dispatch` in any workflow to
respond to the event.

## Platforms

- [Cloudflare Workers](dist/cloudflare-worker/README.md)
- [AWS Lambda](dist/aws-lambda/README.md)
- [Google Cloud Run](dist/gcp-cloud-run/README.md)
- [Azure Functions](dist/azure-function/README.md)

## Configuration

| Input               | Description                            |
| ------------------- | -------------------------------------- |
| `GITHUB_APP_ID`     | GitHub App ID                          |
| `GITHUB_APP_PK`     | GitHub App PEM-encoded private key[^1] |
| `GITHUB_REPO`       | Target repository in `owner/repo` form |
| `GITHUB_EVENT_TYPE` | `repository_dispatch` event type       |
| `GITHUB_PAYLOAD`    | JSON object for `client_payload`       |

[^1]:
    Each platform stores the private key in its native secret manager — the
    `GITHUB_APP_PK` input's content varies by platform.
