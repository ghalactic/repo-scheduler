# AWS Lambda repo scheduler

[![Deploy - AWS Serverless App Repository](https://img.shields.io/badge/Deploy-AWS%20Serverless%20App%20Repository-orange?logo=amazonaws)](https://serverlessrepo.aws.amazon.com/applications/ghalactic-repo-scheduler)

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
  --secret-id STACK_NAME/private-key \
  --secret-string "$(cat path/to/private-key.pem)"
```

## Adding more schedules

Create additional EventBridge schedules targeting the same Lambda with different
inputs. Use the `FunctionArn` and `ScheduleRoleArn` stack outputs as
`FUNCTION_ARN` and `EXECUTION_ROLE_ARN`:

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

- `GitHubAppId` (required) — GitHub App numeric ID
- `TargetRepo` (required) — Target repository in `owner/repo` format
- `TargetEventType` (required) — `repository_dispatch` event type
- `TargetPayload` (default: `{}`) — JSON object for `client_payload`
- `Schedule` (default: `cron(21 * * * ? *)`) — EventBridge schedule expression
