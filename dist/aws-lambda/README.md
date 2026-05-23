# AWS Lambda scheduler

[![Launch Stack][deploy-badge]][deploy-url]

Use Lambda and EventBridge to dispatch a `repository_dispatch` event on a fixed
schedule.

[deploy-badge]:
  https://img.shields.io/badge/Deploy-AWS%20Serverless%20App%20Repository-orange?logo=amazonaws
[deploy-url]:
  https://serverlessrepo.aws.amazon.com/applications/ghalactic-repo-scheduler

## Usage

1. Click the button above to deploy via the AWS Serverless Application
   Repository. Fill in `GitHubAppId`, `GitHubRepo`, `GitHubEventType`, and
   optionally `Schedule` (defaults to twice per hour).
2. After the stack is created, open the secret created by the template in the
   **AWS Secrets Manager** console (the ARN is in the stack outputs). Set the
   secret value to your GitHub App's PEM-encoded private key.
