# Azure Function scheduler

[![Deploy to Azure][deploy-badge]][deploy-url]

[deploy-badge]: https://aka.ms/deploytoazurebutton
[deploy-url]:
  https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fghalactic%2Frepo-scheduler%2Fmain%2Fdist%2Fazure-function%2Fazuredeploy.json

Use an Azure Functions timer trigger to dispatch a `repository_dispatch` event
on a configurable schedule.

## Prerequisites

- Azure account
- [Azure Functions Core Tools]

[azure functions core tools]:
  https://learn.microsoft.com/azure/azure-functions/functions-run-local

## Usage

Click the button above, or deploy from the CLI:

```sh
az deployment group create \
  --resource-group <resource-group> \
  --template-file azuredeploy.json \
  --parameters functionAppName=<name> gitHubAppId=<app-id> gitHubRepo=<owner/repo> gitHubEventType=<event-type>
```

Then publish the function code:

```sh
func azure functionapp publish <function-app>
```

After deployment, populate the Key Vault secret with your PEM key:

```sh
az keyvault secret set \
  --vault-name <keyVaultName from deployment outputs> \
  --name github-app-pk \
  --file github-app.pem
```

The Function App uses a system-assigned managed identity with the Key Vault
Secrets User role, so the Key Vault reference resolves automatically.

The schedule defaults to every 30 minutes and can be changed via the
`scheduleExpression` parameter (NCRONTAB format).
