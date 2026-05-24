# Multi-Schedule Deployment Redesign

## Problem

The repo scheduler works well (GitHub Actions cron reliability is solved), but
the deployment experience is poor on Azure and GCP. The "Deploy to Azure" and
"Run on Google Cloud" buttons produce unreliable, frustrating setup flows.
Additionally, the current 1:1 model (one deployment per repo/event) doesn't
scale — users who want to schedule multiple repos need separate deployments for
each.

## Goals

1. A single deployment can serve multiple repos/event types via separate
   scheduler entries
2. CLI-first deployment with no file editing required
3. Remove broken deploy buttons (Azure, GCP); keep working ones (Cloudflare, AWS
   SAR)
4. Consistent "clone → deploy" UX across all platforms
5. Default schedule moves to once per hour (at `:21` past the hour)

## Architecture

### Core Layer (Unchanged)

`src/common/dispatch.ts` — takes `DispatchConfig` (appId, appPk, repo,
eventType, payload) and fires a `repository_dispatch` event via GitHub App auth.
No changes needed.

`src/common/pkcs.ts` — PKCS8 key format helper. No changes needed.

### Invocation Model

**Deployment-level config (stored once as secrets/env vars):**

- `GITHUB_APP_ID` — GitHub App numeric ID
- `GITHUB_APP_PK` — private key (in platform-native secret store)

**Per-invocation config (passed by each scheduler entry):**

- `repo` — target repository in `owner/repo` format
- `eventType` — the `repository_dispatch` event type string
- `payload` — JSON object for `client_payload` (optional, defaults to `{}`)

A single GitHub App is installed on all target repos. The App credentials are
configured once at deployment time. Each scheduler entry tells the function
which repo/event to target.

### Platform Adapters

#### Cloudflare Workers

- **Trigger:** Cron trigger (native `scheduled()` handler)
- **Per-invocation params:** Not supported natively — all crons share the same
  env
- **Multi-schedule model:** Deploy one Worker per target (Cloudflare's deploy
  button makes this trivial)
- **Config source:** Environment variables + Secrets Store binding (same as
  today)
- **Changes:** Default cron moves to `21 * * * *`. CLI docs added alongside
  button.
- **Deployment:** Button (retained) or `wrangler deploy` with `--var` flags

#### AWS Lambda

- **Trigger:** EventBridge Scheduler rule
- **Per-invocation params:** EventBridge `Input` field → Lambda `event` object
- **Multi-schedule model:** Multiple EventBridge schedules targeting the same
  Lambda, each with different `Input` JSON
- **Config source:** App creds from env vars (PK via Secrets Manager ARN).
  Target details from the `event` object.
- **Changes:** Adapter reads `repo`, `eventType`, `payload` from `event` instead
  of env vars. SAM template updated accordingly.
- **Deployment:** SAR button (retained) or `sam deploy` from local clone
- **Default schedule:** `cron(21 * * * ? *)`

#### GCP Cloud Run

- **Trigger:** HTTP POST (from Cloud Scheduler)
- **Per-invocation params:** Request JSON body
- **Multi-schedule model:** Multiple Cloud Scheduler jobs POSTing to the same
  Cloud Run service URL with different bodies
- **Config source:** App creds from env vars (PK via Secret Manager). Target
  details from HTTP request body.
- **Changes:** Adapter validates POST method + JSON body (returns 405/400/500).
  Deploy button and `app.json` removed.
- **Deployment:** `gcloud run deploy` + `gcloud scheduler jobs create http`
- **Default schedule:** `21 * * * *`
- **Auth:** Cloud Scheduler job uses OIDC token for Cloud Run Invoker

#### Azure Functions

- **Trigger:** HTTP POST (from Azure Logic Apps)
- **Per-invocation params:** Request JSON body
- **Multi-schedule model:** Multiple Logic App workflows POSTing to the same
  Function URL with different bodies
- **Config source:** App creds from app settings (PK via Key Vault reference).
  Target details from HTTP request body.
- **Changes:** Complete rewrite from timer trigger to HTTP trigger. Deploy
  button removed. ARM template redesigned to provision HTTP-triggered Function
  App + Key Vault + Logic App.
- **Deployment:**
  `az deployment group create --template-file azuredeploy.json --parameters ...`
  from local clone
- **Default schedule:** Hourly at `:21` (Logic App recurrence)
- **Auth:** Function key or AAD on the HTTP endpoint

### Request Body Schema (GCP + Azure)

```json
{
  "repo": "owner/repo",
  "eventType": "my-event",
  "payload": {}
}
```

- `repo` (required): target repository in `owner/repo` format
- `eventType` (required): `repository_dispatch` event type
- `payload` (optional): JSON object, defaults to `{}`

### AWS Event Schema

Same shape as the HTTP body — passed as EventBridge `Input`:

```json
{
  "repo": "owner/repo",
  "eventType": "my-event",
  "payload": {}
}
```

## Error Handling

### HTTP Endpoints (GCP, Azure)

- Non-POST requests: 405 Method Not Allowed
- Missing/invalid `repo` or `eventType`: 400 Bad Request with descriptive
  message
- Dispatch failure: 500 Internal Server Error with error message
- Success: 200 OK

### AWS Lambda

- Missing `repo` or `eventType` in event: throw Error (EventBridge retries up to
  3x)
- Dispatch failure: throw Error (EventBridge retries)

### Cloudflare

- Missing env vars: throw Error (logged, Cloudflare retries)

### Secrets

- Private key stays in platform-native secret stores (no change)
- Per-invocation params are not secrets — they travel in scheduler payloads

## Deployment UX

### Principles

1. No file editing in the cloned repo — all config via CLI args
2. CLI-first documentation for every platform
3. Deploy buttons as optional shortcuts (Cloudflare, AWS only)

### User Flow (All Platforms)

```
1. Create a GitHub App (documented in root README)
2. Clone this repo
3. Run platform CLI commands to deploy (passing config as arguments)
4. Store private key in platform's secret manager
5. (Optional) Add more scheduler entries for additional repos/events
```

### Deploy Buttons Retained

- Cloudflare Workers deploy button
- AWS Serverless Application Repository button

### Deploy Buttons Removed

- Azure "Deploy to Azure" button
- GCP "Run on Google Cloud" button

## What Gets Removed

- `dist/azure-function/azuredeploy.json` (current ARM template — rewritten for
  HTTP trigger + Logic App)
- `dist/gcp-cloud-run/app.json` (Cloud Run button manifest)
- GCP and Azure deploy button badges/links from READMEs
- `GITHUB_REPO`, `GITHUB_EVENT_TYPE`, `GITHUB_PAYLOAD` as deployment-time env
  vars on AWS, GCP, and Azure (these become per-invocation params)
- Azure release ZIP workflow and `WEBSITE_RUN_FROM_PACKAGE` reference

## Testing

- Existing vitest infrastructure stays
- `src/common/dispatch.spec.ts` and `pkcs.spec.ts` — no changes
- AWS `index.spec.ts` — update to test reading from event object
- Azure `index.spec.ts` — rewrite for HTTP trigger (mock request/response)
- GCP `index.spec.ts` — update to test JSON body parsing and HTTP error codes
- Cloudflare `index.spec.ts` — minimal changes (schedule default)

## Scope

This spec covers:

- Adapter code changes for all four platforms
- Updated deployment templates (SAM for AWS, new ARM for Azure)
- Removal of GCP `app.json` and Azure deploy button artifacts
- Updated per-platform README documentation
- Updated root README
- Test updates

This spec does NOT cover:

- Changes to the GitHub App creation process
- Changes to the core `dispatch()` function
- Adding new platforms
- Monitoring/alerting/observability
