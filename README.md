# Repo scheduler

_Schedules repository events for more reliable GitHub Actions workflow runs_

GitHub Actions cron schedules are unreliable — they can drift, skip, or start
late. This project provides serverless scheduler implementations for multiple
cloud platforms that dispatch `repository_dispatch` events on a fixed schedule
using a GitHub App for authentication.

## How it works

1. Deploy a single serverless function to your chosen cloud platform
2. Configure your GitHub App credentials at the deployment level
3. Create scheduler entries that invoke the function with target details
4. Each invocation dispatches a `repository_dispatch` event to the specified
   repo

A single deployment can serve multiple repositories and event types — each
scheduler entry passes the target repo/event as parameters.

## Platforms

- [AWS Lambda](dist/aws-lambda/README.md)
- [Azure Functions](dist/azure-function/README.md)
- [Cloudflare Workers](dist/cloudflare-worker/README.md)
- [Google Cloud Run](dist/gcp-cloud-run/README.md)

## Deployment-level configuration

These are configured once when you deploy the function:

| Input           | Description                            |
| --------------- | -------------------------------------- |
| `GITHUB_APP_ID` | GitHub App ID                          |
| `GITHUB_APP_PK` | GitHub App PEM-encoded private key[^1] |

[^1]: Each platform stores the private key in its native secret manager.

## Per-invocation configuration

These are passed by each scheduler entry (how they're passed varies by platform
— see platform docs):

| Input       | Description                                 |
| ----------- | ------------------------------------------- |
| `repo`      | Target repository in `owner/repo` form      |
| `eventType` | `repository_dispatch` event type            |
| `payload`   | JSON object for `client_payload` (optional) |

## Creating a GitHub App

The scheduler authenticates as a [GitHub App] to dispatch events. Create one
with the following settings:

1. Go to your organization or personal **Settings > Developer settings > GitHub
   Apps > New GitHub App**.
2. Fill in the required fields:
   - **GitHub App name:** anything descriptive (e.g. "Repo Scheduler")
   - **Homepage URL:** can be this repository's URL
   - **Webhook:** uncheck "Active" (no webhook is needed)
3. Under **Repository permissions**, set:
   - **Contents:** Read and write
4. Click **Create GitHub App**.
5. Note the **App ID** shown on the app's settings page.
6. Scroll to **Private keys** and click **Generate a private key**. Save the
   downloaded PEM file — you'll provide its contents to your platform's secret
   store.
7. Go to **Install App** in the sidebar and install it on the repositories you
   want to dispatch events to.

[github app]: https://docs.github.com/apps/creating-github-apps
