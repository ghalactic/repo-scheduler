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

## Deploy

Run the guided deploy from this directory:

```sh
sam deploy --guided
```

EventBridge retries failed invocations up to 3 times.

## Configure

The template creates an AWS Secrets Manager secret for the private key. After
deploying, populate the secret with your PEM file:

```sh
aws secretsmanager put-secret-value \
  --secret-id <SecretArn from stack outputs> \
  --secret-string file://github-app.pem
```

`GitHubAppId`, `GitHubRepo`, and `GitHubEventType` are passed as CloudFormation
parameters. The schedule defaults to every 30 minutes but can be overridden with
the `Schedule` parameter.
