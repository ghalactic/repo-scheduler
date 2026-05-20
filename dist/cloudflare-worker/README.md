# Cloudflare Worker scheduler

[![Deploy to Cloudflare Workers][deploy-badge]][deploy-url]

Use a Worker Cron Trigger to dispatch a `repository_dispatch` event on a fixed
schedule.

[deploy-badge]: https://deploy.workers.cloudflare.com/button
[deploy-url]:
  https://deploy.workers.cloudflare.com/?url=https://github.com/ghalactic/repo-scheduler/tree/main/dist/cloudflare-worker

## Prerequisites

- Cloudflare account

## Usage

Click the button above to deploy. The setup page prompts for the required
environment variables (`GITHUB_APP_ID`, `GITHUB_REPO`, `GITHUB_EVENT_TYPE`) and
the `GITHUB_APP_PK` secret.

To adjust the schedule, edit the `crons` array in `wrangler.toml` and redeploy.

Optionally set `GITHUB_PAYLOAD` to a JSON object to include in every dispatch.
