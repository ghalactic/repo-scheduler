# Azure Function repo scheduler

## Deploy via CLI

Prerequisites:

- [Azure CLI] with the `quota` extension (`az extension add --name quota`)
- [Azure Functions Core Tools]
- At least 1 [Y1 (Consumption plan) quota] in your chosen region (fresh
  subscriptions default to 0)

[azure cli]: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
[azure functions core tools]:
  https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local
[y1 (consumption plan) quota]:
  https://portal.azure.com/#view/Microsoft_Azure_Capacity/QuotaMenuBlade/~/myQuotas

Deploy the infrastructure:

```sh
# Register required resource providers (may take a few minutes)
az provider register --namespace Microsoft.Compute
az provider register --namespace Microsoft.Insights
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.Logic
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Web

# Ensure Y1 (Consumption plan) quota is non-zero (fresh subscriptions default to 0)
az quota create \
  --resource-name Y1 \
  --scope "/subscriptions/$(az account show --query id -o tsv)/providers/Microsoft.Web/locations/eastus" \
  --limit-object value=1 \
  --resource-type dedicated

az group create --name ghalactic-repo-scheduler --location eastus

az deployment group create \
  --resource-group ghalactic-repo-scheduler \
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
