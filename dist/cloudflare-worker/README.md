# Cloudflare Worker scheduler

[![Deploy to Cloudflare Workers][deploy-badge]][deploy-url]

Use a Worker Cron Trigger to dispatch a `repository_dispatch` event on a fixed
schedule.

[deploy-badge]: https://deploy.workers.cloudflare.com/button
[deploy-url]:
  https://deploy.workers.cloudflare.com/?url=https://github.com/ghalactic/repo-scheduler/tree/main/dist/cloudflare-worker

## Usage

1. Click the button above to deploy. The setup page prompts for the required
   environment variables (`GITHUB_APP_ID`, `GITHUB_REPO`, `GITHUB_EVENT_TYPE`)
   and provisions a Secrets Store binding for `GITHUB_APP_PK`.
2. Cloudflare will create a new repository to house your worker. To adjust the
   schedule, edit the `crons` array in `wrangler.toml` and redeploy.
