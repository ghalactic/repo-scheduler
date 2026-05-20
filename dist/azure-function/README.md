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

[azure cli]: https://learn.microsoft.com/cli/azure/install-azure-cli

## Usage

Click the button above to deploy. The deployment form prompts for
`functionAppName`, `gitHubAppId`, `gitHubRepo`, `gitHubEventType`, and an
optional `scheduleExpression` (defaults to every 30 minutes). The template
deploys both infrastructure and function code from this repository.

After deployment, populate the Key Vault secret with your PEM key:

```sh
az keyvault secret set \
  --vault-name <keyVaultName from deployment outputs> \
  --name github-app-pk \
  --file github-app.pem
```

The Function App uses a system-assigned managed identity with the Key Vault
Secrets User role, so the Key Vault reference resolves automatically.
