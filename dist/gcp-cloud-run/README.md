# Google Cloud Run Repo Scheduler

## Deploy via CLI

Prerequisites: [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)

Deploy the Cloud Run service:

```sh
cd dist/gcp-cloud-run

gcloud run deploy repo-scheduler \
  --source . \
  --region YOUR_REGION \
  --set-env-vars "GITHUB_APP_ID=YOUR_APP_ID,GITHUB_APP_PK=$(cat path/to/private-key.pem)" \
  --no-allow-unauthenticated \
  --memory 256Mi \
  --max-instances 1
```

Create a service account for Cloud Scheduler:

```sh
gcloud iam service-accounts create repo-scheduler-invoker \
  --display-name "Repo Scheduler Invoker"

gcloud run services add-iam-policy-binding repo-scheduler \
  --region YOUR_REGION \
  --member "serviceAccount:repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/run.invoker"
```

Create a Cloud Scheduler job:

```sh
gcloud scheduler jobs create http repo-scheduler-job \
  --location YOUR_REGION \
  --schedule "21 * * * *" \
  --uri "$(gcloud run services describe repo-scheduler --region YOUR_REGION --format 'value(status.url)')" \
  --http-method POST \
  --headers "Content-Type=application/json" \
  --message-body '{"repo":"owner/repo","eventType":"your-event-type"}' \
  --oidc-service-account-email "repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com"
```

## Adding More Schedules

Create additional Cloud Scheduler jobs targeting the same service URL with
different message bodies:

```sh
gcloud scheduler jobs create http repo-scheduler-other \
  --location YOUR_REGION \
  --schedule "45 * * * *" \
  --uri SERVICE_URL \
  --http-method POST \
  --headers "Content-Type=application/json" \
  --message-body '{"repo":"owner/other-repo","eventType":"other-event"}' \
  --oidc-service-account-email "repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com"
```

## Configuration

The function reads these from environment variables (set at deploy time):

| Variable        | Description                        |
| --------------- | ---------------------------------- |
| `GITHUB_APP_ID` | GitHub App numeric ID              |
| `GITHUB_APP_PK` | PEM-encoded GitHub App private key |

Each Cloud Scheduler job passes these in the HTTP body:

| Field       | Description                                 |
| ----------- | ------------------------------------------- |
| `repo`      | Target repository in `owner/repo` format    |
| `eventType` | `repository_dispatch` event type            |
| `payload`   | JSON object for `client_payload` (optional) |
