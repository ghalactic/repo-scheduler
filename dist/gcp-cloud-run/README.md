# Google Cloud Run scheduler

[![Run on Google Cloud][deploy-badge]][deploy-url]

Use Cloud Run and Cloud Scheduler to dispatch a `repository_dispatch` event on a
configurable schedule.

[deploy-badge]: https://deploy.cloud.run/button.svg
[deploy-url]:
  https://deploy.cloud.run/?git_repo=https://github.com/ghalactic/repo-scheduler&dir=dist/gcp-cloud-run

## Usage

1. Create a secret in **Secret Manager** named
   `ghalactic-repo-scheduler-github-app-pk` containing your GitHub App's
   PEM-encoded private key. The name is prefixed because Secret Manager is
   project-global.
2. Click the **Run on Google Cloud** button above. The Cloud Shell wizard
   deploys the Cloud Run service. Set the environment variables `GITHUB_APP_ID`,
   `GITHUB_REPO`, and `GITHUB_EVENT_TYPE` when prompted, and mount the secret as
   `GITHUB_APP_PK`.
3. Create a **Cloud Scheduler** job that sends an HTTP POST to the Cloud Run
   service URL on your desired schedule (e.g. every 30 minutes). Use a service
   account with the **Cloud Run Invoker** role and configure OIDC
   authentication.
