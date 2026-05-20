# Azure Function scheduler

[![Deploy to Azure][deploy-badge]][deploy-url]

[deploy-badge]: https://aka.ms/deploytoazurebutton
[deploy-url]:
  https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fghalactic%2Frepo-scheduler%2Fmain%2Fdist%2Fazure-function%2Fazuredeploy.json

Use an Azure Functions timer trigger to dispatch a `repository_dispatch` event
on a configurable schedule.

## Prerequisites

- Azure account
- [Azure CLI]
- [Azure Functions Core Tools]

[azure cli]: https://learn.microsoft.com/cli/azure/install-azure-cli
[azure functions core tools]:
  https://learn.microsoft.com/azure/azure-functions/functions-run-local

## Usage

Click the button above to deploy the infrastructure. The deployment form prompts
for `functionAppName`, `gitHubAppId`, `gitHubRepo`, `gitHubEventType`, and an
optional `scheduleExpression` (defaults to every 30 minutes).

Then publish the function code:

```sh
func azure functionapp publish <function-app>
```

After publishing, populate the Key Vault secret with your PEM key:

```sh
az keyvault secret set \
  --vault-name <keyVaultName from deployment outputs> \
  --name github-app-pk \
  --file github-app.pem
```

The Function App uses a system-assigned managed identity with the Key Vault
Secrets User role, so the Key Vault reference resolves automatically.
