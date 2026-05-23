# Google Cloud Run repo scheduler

[![Run on Google Cloud][deploy-badge]][deploy-url]

[deploy-badge]: https://deploy.cloud.run/button.svg
[deploy-url]:
  https://deploy.cloud.run/?git_repo=https://github.com/ghalactic/repo-scheduler&dir=dist/gcp-cloud-run

## Usage

1. Click the **Run on Google Cloud** button above. Fill in `GITHUB_APP_ID`,
   `GITHUB_REPO`, and `GITHUB_EVENT_TYPE` when prompted.
2. After deployment, open the Cloud Run service in the console. Under
   **Variables & Secrets**, replace the generated `GITHUB_APP_PK` value with
   your GitHub App's PEM-encoded private key.
3. Create a **Cloud Scheduler** job that sends an HTTP POST to the service URL
   on your desired schedule (e.g. `21,51 * * * *`). Use a service account with
   the **Cloud Run Invoker** role and configure OIDC authentication.
