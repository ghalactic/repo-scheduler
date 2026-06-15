# Google Cloud Run repo scheduler

## Deploy via CLI

Prerequisites:

- [Google Cloud CLI]

[google cloud cli]: https://cloud.google.com/sdk/docs/install

Deploy the Cloud Run service:

```sh
# Create the secret for the private key
gcloud secrets create repo-scheduler-pk \
  --data-file path/to/private-key.pem

# Create a service account for the function runtime
gcloud iam service-accounts create repo-scheduler \
  --display-name "Repo scheduler"

# Grant it access to the private key secret
gcloud secrets add-iam-policy-binding repo-scheduler-pk \
  --member "serviceAccount:repo-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/secretmanager.secretAccessor"

gcloud run deploy repo-scheduler \
  --source . \
  --region YOUR_REGION \
  --set-env-vars "GITHUB_APP_ID=YOUR_APP_ID" \
  --set-secrets "GITHUB_APP_PK=repo-scheduler-pk:latest" \
  --no-allow-unauthenticated \
  --service-account repo-scheduler@PROJECT_ID.iam.gserviceaccount.com \
  --memory 256Mi \
  --max-instances 1
```

Create a service account for Cloud Scheduler to invoke the function:

```sh
gcloud iam service-accounts create repo-scheduler-invoker \
  --display-name "Repo scheduler invoker"

gcloud run services add-iam-policy-binding repo-scheduler \
  --region YOUR_REGION \
  --member "serviceAccount:repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/run.invoker"
```

Create a Cloud Scheduler job:

```sh
gcloud scheduler jobs create http repo-scheduler-example-a \
  --location YOUR_REGION \
  --schedule "21 * * * *" \
  --uri "$(gcloud run services describe repo-scheduler --region YOUR_REGION --format 'value(status.url)')" \
  --http-method POST \
  --headers "Content-Type=application/json" \
  --message-body '{"repo":"owner/repo","eventType":"your-event-type"}' \
  --oidc-service-account-email "repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com"
```

## Adding more schedules

Create additional Cloud Scheduler jobs targeting the same service URL with
different message bodies:

```sh
gcloud scheduler jobs create http repo-scheduler-example-b \
  --location YOUR_REGION \
  --schedule "45 * * * *" \
  --uri "$(gcloud run services describe repo-scheduler --region YOUR_REGION --format 'value(status.url)')" \
  --http-method POST \
  --headers "Content-Type=application/json" \
  --message-body '{"repo":"owner/other-repo","eventType":"other-event"}' \
  --oidc-service-account-email "repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com"
```

## Configuration

The function reads these from environment variables (set at deploy time):

| Input           | Description                        |
| :-------------- | :--------------------------------- |
| `GITHUB_APP_ID` | GitHub App numeric ID              |
| `GITHUB_APP_PK` | PEM-encoded GitHub App private key |

Each Cloud Scheduler job passes these in the HTTP body:

| Input       | Description                                 |
| :---------- | :------------------------------------------ |
| `repo`      | Target repository in `owner/repo` format    |
| `eventType` | `repository_dispatch` event type            |
| `payload`   | JSON object for `client_payload` (optional) |
