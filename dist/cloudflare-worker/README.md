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

## Deploy

Click the button above, or run the deploy from this directory:

```sh
wrangler deploy
```

## Configure

After deploying, set the required variables:

```sh
wrangler vars set GITHUB_APP_ID=<app-id> GITHUB_REPO=<owner/repo> GITHUB_EVENT_TYPE=<event-type>
wrangler secret put GITHUB_APP_PK
```

Optionally set `GITHUB_PAYLOAD` to a JSON object to include in every dispatch:

```sh
wrangler vars set 'GITHUB_PAYLOAD={"key":"value"}'
```

To adjust the schedule, edit the `crons` array in `wrangler.toml` and redeploy.
