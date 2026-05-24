# AWS Lambda repo scheduler

[![Launch Stack][deploy-badge]][deploy-url]

[deploy-badge]:
  https://img.shields.io/badge/Deploy-AWS%20Serverless%20App%20Repository-orange?logo=amazonaws
[deploy-url]:
  https://serverlessrepo.aws.amazon.com/applications/ghalactic-repo-scheduler

## Deploy via CLI

Prerequisites:

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

```sh
sam deploy \
  --stack-name repo-scheduler \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    GitHubAppId=YOUR_APP_ID \
    TargetRepo=owner/repo \
    TargetEventType=your-event-type
```

After deployment, populate the private key secret (ARN shown in stack outputs):

```sh
aws secretsmanager put-secret-value \
  --secret-id STACK_NAME/ghalactic-repo-scheduler-pk \
  --secret-string "$(cat path/to/private-key.pem)"
```

## Adding more schedules

Create additional EventBridge schedules targeting the same Lambda with different
inputs:

```sh
aws scheduler create-schedule \
  --name repo-scheduler-other \
  --schedule-expression "cron(45 * * * ? *)" \
  --target '{
    "Arn": "FUNCTION_ARN",
    "RoleArn": "EXECUTION_ROLE_ARN",
    "Input": "{\"repo\":\"owner/other-repo\",\"eventType\":\"other-event\"}"
  }' \
  --flexible-time-window '{"Mode":"OFF"}'
```

## Configuration

| Parameter         | Description                              | Default              |
| :---------------- | :--------------------------------------- | :------------------- |
| `GitHubAppId`     | GitHub App numeric ID                    | (required)           |
| `TargetRepo`      | Target repository in `owner/repo` format | (required)           |
| `TargetEventType` | `repository_dispatch` event type         | (required)           |
| `TargetPayload`   | JSON object for `client_payload`         | `{}`                 |
| `Schedule`        | EventBridge schedule expression          | `cron(21 * * * ? *)` |
