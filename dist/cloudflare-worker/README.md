# Cloudflare Worker Repo Scheduler

[![Deploy to Cloudflare Workers][deploy-badge]][deploy-url]

[deploy-badge]: https://deploy.workers.cloudflare.com/button
[deploy-url]:
  https://deploy.workers.cloudflare.com/?url=https://github.com/ghalactic/repo-scheduler/tree/main/dist/cloudflare-worker

## Deploy via Button

Click the button above. The setup page prompts for the required environment
variables and provisions a Secrets Store binding for the private key.

## Deploy via CLI

Prerequisites:
[Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```sh
cd dist/cloudflare-worker

wrangler deploy \
  --var GITHUB_APP_ID:YOUR_APP_ID \
  --var GITHUB_REPO:owner/repo \
  --var GITHUB_EVENT_TYPE:your-event-type \
  --var GITHUB_PAYLOAD:'{}'
```

Then store the private key in Cloudflare Secrets Store (or use `wrangler secret`
if not using the Secrets Store binding):

```sh
wrangler secret put GITHUB_APP_PK
# Paste your PEM-encoded private key when prompted
```

## Adding More Schedules

Deploy another Worker with different configuration. Each Worker handles one
target repository/event combination. Cloudflare's deploy button makes this
straightforward.

## Configuration

| Variable            | Description                                     |
| ------------------- | ----------------------------------------------- |
| `GITHUB_APP_ID`     | GitHub App numeric ID                           |
| `GITHUB_APP_PK`     | PEM-encoded private key (Secrets Store binding) |
| `GITHUB_REPO`       | Target repository in `owner/repo` format        |
| `GITHUB_EVENT_TYPE` | `repository_dispatch` event type                |
| `GITHUB_PAYLOAD`    | JSON object for `client_payload`                |

To customize the schedule, edit `crons` in `wrangler.toml` before deploying
(default: hourly at `:21`).
