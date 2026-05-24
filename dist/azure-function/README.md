# Azure Function repo scheduler

## Deploy via CLI

Prerequisites:

- [Azure CLI]
- [Azure Functions Core Tools]

[azure cli]: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
[azure functions core tools]:
  https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

Deploy the infrastructure:

```sh
az deployment group create \
  --resource-group YOUR_RESOURCE_GROUP \
  --template-file azuredeploy.json \
  --parameters \
    functionAppName=repo-scheduler \
    gitHubAppId=YOUR_APP_ID \
    targetRepo=owner/repo \
    targetEventType=your-event-type
```

Update the Key Vault secret with your GitHub App private key:

```sh
az keyvault secret set \
  --vault-name KEY_VAULT_NAME \
  --name ghalactic-repo-scheduler-pk \
  --file path/to/private-key.pem
```

Publish the function code:

```sh
func azure functionapp publish repo-scheduler
```

## Adding more schedules

Create additional Logic App workflows that POST to the same function URL with
different bodies. The function URL and key are shown in the deployment outputs.

## Configuration

| Parameter           | Description                              | Default                |
| :------------------ | :--------------------------------------- | :--------------------- |
| `functionAppName`   | Name of the Function App                 | (required)             |
| `gitHubAppId`       | GitHub App numeric ID                    | (required)             |
| `targetRepo`        | Target repository in `owner/repo` format | (required)             |
| `targetEventType`   | `repository_dispatch` event type         | (required)             |
| `targetPayload`     | JSON object for `client_payload`         | `{}`                   |
| `scheduleFrequency` | Recurrence frequency                     | `Hour`                 |
| `scheduleInterval`  | Recurrence interval                      | `1`                    |
| `scheduleStartTime` | Start time (controls offset)             | `2026-01-01T00:21:00Z` |
