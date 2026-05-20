# AWS Lambda scheduler

[![Launch Stack][deploy-badge]][deploy-url]

Use Lambda and EventBridge to dispatch a `repository_dispatch` event on a fixed
schedule.

[deploy-badge]:
  https://img.shields.io/badge/Deploy-AWS%20Serverless%20App%20Repository-orange?logo=amazonaws
[deploy-url]:
  https://serverlessrepo.aws.amazon.com/applications/ghalactic-repo-scheduler

## Prerequisites

- AWS account
- [SAM CLI]

[sam cli]:
  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

## Usage

Run the guided deploy from this directory:

```sh
sam deploy --guided
```

The guided flow prompts for `GitHubAppId`, `GitHubRepo`, `GitHubEventType`, and
an optional `Schedule` (defaults to every 30 minutes). EventBridge retries
failed invocations up to 3 times.

After the stack is created, populate the private key secret:

```sh
aws secretsmanager put-secret-value \
  --secret-id <SecretArn from stack outputs> \
  --secret-string file://github-app.pem
```
