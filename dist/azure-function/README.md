# Azure Function repo scheduler

## Deploy via CLI

Prerequisites:

- [Azure CLI]
- [Azure Functions Core Tools]

[azure cli]: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
[azure functions core tools]:
  https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

Pick a globally unique name for the function app (Azure uses it for the
hostname, storage account, and key vault):

```sh
SUFFIX=$(openssl rand -hex 4)
APP_NAME="repo-scheduler-${SUFFIX}"
LOCATION="eastus"
```

Create the resource group and storage account:

```sh
az group create --name ghalactic-repo-scheduler --location "$LOCATION"

az storage account create \
  --name "reposched${SUFFIX}" \
  --resource-group ghalactic-repo-scheduler \
  --location "$LOCATION" \
  --sku Standard_LRS
```

Create the Function App:

```sh
az functionapp create \
  --resource-group ghalactic-repo-scheduler \
  --flexconsumption-location "$LOCATION" \
  --runtime node \
  --runtime-version 22 \
  --functions-version 4 \
  --name "$APP_NAME" \
  --storage-account "reposched${SUFFIX}"
```

Create a Key Vault and store the private key:

```sh
az keyvault create \
  --name "$APP_NAME" \
  --resource-group ghalactic-repo-scheduler \
  --location "$LOCATION" \
  --enable-rbac-authorization

az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --scope "$(az keyvault show --name "$APP_NAME" --query id -o tsv)"

az keyvault secret set \
  --vault-name "$APP_NAME" \
  --name private-key \
  --output none \
  --file path/to/private-key.pem
```

Grant the Function App access to the Key Vault secret:

```sh
az functionapp identity assign \
  --resource-group ghalactic-repo-scheduler \
  --name "$APP_NAME"

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee "$(az functionapp identity show --resource-group ghalactic-repo-scheduler --name "$APP_NAME" --query principalId -o tsv)" \
  --scope "$(az keyvault show --name "$APP_NAME" --query id -o tsv)"
```

Configure app settings:

```sh
az functionapp config appsettings set \
  --resource-group ghalactic-repo-scheduler \
  --name "$APP_NAME" \
  --settings \
    GITHUB_APP_ID=YOUR_APP_ID \
    "GITHUB_APP_PK=@Microsoft.KeyVault(SecretUri=https://${APP_NAME}.vault.azure.net/secrets/private-key/)"
```

Publish the function code:

```sh
npm install
func azure functionapp publish "$APP_NAME"
```

Create a Logic App to trigger the function on a schedule:

```sh
FUNCTION_KEY=$(az functionapp keys list \
  --resource-group ghalactic-repo-scheduler \
  --name "$APP_NAME" \
  --query functionKeys.default -o tsv)

az logic workflow create \
  --resource-group ghalactic-repo-scheduler \
  --location "$LOCATION" \
  --name repo-scheduler-schedule \
  --definition '{
    "definition": {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "1.0.0.0",
      "triggers": {
        "Recurrence": {
          "type": "Recurrence",
          "recurrence": {
            "frequency": "Hour",
            "interval": 1,
            "startTime": "2026-01-01T00:21:00Z"
          }
        }
      },
      "actions": {
        "dispatch": {
          "type": "Http",
          "inputs": {
            "method": "POST",
            "uri": "https://'"$APP_NAME"'.azurewebsites.net/api/scheduler",
            "headers": {
              "Content-Type": "application/json",
              "x-functions-key": "'"$FUNCTION_KEY"'"
            },
            "body": {
              "repo": "owner/repo",
              "eventType": "your-event-type"
            }
          }
        }
      }
    }
  }'
```

## Adding more schedules

Create additional Logic App workflows targeting the same function URL with
different bodies and schedules:

```sh
az logic workflow create \
  --resource-group ghalactic-repo-scheduler \
  --location "$LOCATION" \
  --name repo-scheduler-other \
  --definition '{
    "definition": {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "1.0.0.0",
      "triggers": {
        "Recurrence": {
          "type": "Recurrence",
          "recurrence": {
            "frequency": "Hour",
            "interval": 1,
            "startTime": "2026-01-01T00:45:00Z"
          }
        }
      },
      "actions": {
        "dispatch": {
          "type": "Http",
          "inputs": {
            "method": "POST",
            "uri": "https://'"$APP_NAME"'.azurewebsites.net/api/scheduler",
            "headers": {
              "Content-Type": "application/json",
              "x-functions-key": "'"$FUNCTION_KEY"'"
            },
            "body": {
              "repo": "owner/other-repo",
              "eventType": "other-event"
            }
          }
        }
      }
    }
  }'
```

## Configuration

The function reads these from app settings (configured during deployment):

| Input           | Description                        |
| :-------------- | :--------------------------------- |
| `GITHUB_APP_ID` | GitHub App numeric ID              |
| `GITHUB_APP_PK` | PEM-encoded GitHub App private key |

Each Logic App workflow passes these in the HTTP body:

| Input       | Description                                 |
| :---------- | :------------------------------------------ |
| `repo`      | Target repository in `owner/repo` format    |
| `eventType` | `repository_dispatch` event type            |
| `payload`   | JSON object for `client_payload` (optional) |
