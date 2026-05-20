# Cloudflare Worker scheduler

[![Deploy to Cloudflare Workers][deploy-badge]][deploy-url]

Use a Worker Cron Trigger to dispatch a `repository_dispatch` event on a fixed
schedule.

[deploy-badge]: https://deploy.workers.cloudflare.com/button
[deploy-url]:
  https://deploy.workers.cloudflare.com/?url=https://github.com/ghalactic/repo-scheduler/tree/main/dist/cloudflare-worker

## Prerequisites

- Cloudflare account
- [Wrangler CLI]

[wrangler cli]: https://developers.cloudflare.com/workers/wrangler/

## Configure

Edit `wrangler.toml` and set the non-sensitive values:

```toml
[vars]
GITHUB_APP_ID = "<app-id>"
GITHUB_REPO = "<owner/repo>"
GITHUB_EVENT_TYPE = "<event-type>"
```

To adjust the schedule, edit the `crons` array in `wrangler.toml`.

Store the private key as a Wrangler secret:

```sh
wrangler secret put GITHUB_APP_PK
```

## Deploy

Run the deploy from this directory:

```sh
wrangler deploy
```
