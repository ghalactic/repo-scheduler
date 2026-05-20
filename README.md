# Repo scheduler

_Dispatch `repository_dispatch` events to GitHub repositories on a reliable
schedule_

GitHub Actions cron schedules are unreliable — they can drift, skip, or start
late. This project provides serverless scheduler implementations for multiple
cloud platforms that dispatch `repository_dispatch` events on a fixed schedule
using a GitHub App for authentication.

## Platforms

| Platform           | Guide                                                      |
| ------------------ | ---------------------------------------------------------- |
| Cloudflare Workers | [dist/cloudflare-worker](dist/cloudflare-worker/README.md) |
| AWS Lambda         | [dist/aws-lambda](dist/aws-lambda/README.md)               |
| Google Cloud Run   | [dist/gcp-cloud-run](dist/gcp-cloud-run/README.md)         |
| Azure Functions    | [dist/azure-function](dist/azure-function/README.md)       |

## How it works

Each platform implementation authenticates as a GitHub App, discovers the app
installation on the target repository, and dispatches a `repository_dispatch`
event with your configured event type and optional payload.

The target repository can then use `on: repository_dispatch` in any workflow to
respond to the event.

## Configuration

See the [platform guides](dist/README.md) for full configuration details.
