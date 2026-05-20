# Google Cloud Run scheduler

[![Run on Google Cloud][deploy-badge]][deploy-url]

Use Cloud Run and Cloud Scheduler to dispatch a `repository_dispatch` event on a
configurable schedule.

[deploy-badge]: https://deploy.cloud.run/button.svg
[deploy-url]:
  https://deploy.cloud.run/?git_repo=https://github.com/ghalactic/repo-scheduler&dir=dist/gcp-cloud-run

## Prerequisites

- GCP project
- [gcloud CLI]

[gcloud cli]: https://cloud.google.com/sdk/docs/install

## Usage

Create the private key secret in Secret Manager:

```sh
gcloud secrets create ghalactic-repo-scheduler-github-app-pk \
  --replication-policy=automatic
gcloud secrets versions add ghalactic-repo-scheduler-github-app-pk \
  --data-file=github-app.pem
```

The secret name is prefixed with the service name because Secret Manager is
project-global.

Deploy the Cloud Run service from this directory:

```sh
gcloud run deploy ghalactic-repo-scheduler \
  --source=. \
  --region=<region> \
  --no-allow-unauthenticated \
  --set-env-vars=GITHUB_APP_ID=<app-id>,GITHUB_REPO=<owner/repo>,GITHUB_EVENT_TYPE=<event-type> \
  --set-secrets=GITHUB_APP_PK=ghalactic-repo-scheduler-github-app-pk:latest
```

Create a Cloud Scheduler job that sends an HTTP POST:

```sh
gcloud scheduler jobs create http ghalactic-repo-scheduler \
  --location=<region> \
  --schedule='*/30 * * * *' \
  --uri="$(gcloud run services describe ghalactic-repo-scheduler --region=<region> --format='value(status.url)')" \
  --http-method=POST \
  --oidc-service-account-email=<scheduler-service-account> \
  --max-retry-attempts=3
```

Use a service account that has the Cloud Run Invoker role. Adjust the
`--schedule` cron expression as needed.
