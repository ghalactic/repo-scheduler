# Azure Function scheduler

[![Deploy to Azure][deploy-badge]][deploy-url]

[deploy-badge]: https://aka.ms/deploytoazurebutton
[deploy-url]:
  https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fghalactic%2Frepo-scheduler%2Fmain%2Fdist%2Fazure-function%2Fazuredeploy.json

Use an Azure Functions timer trigger to dispatch a `repository_dispatch` event
on a configurable schedule.

## Usage

1. Click the **Deploy to Azure** button above. Fill in `functionAppName`,
   `gitHubAppId`, `gitHubRepo`, `gitHubEventType`, and optionally
   `scheduleExpression` (defaults to twice per hour).
2. After deployment completes, open the Key Vault created by the template (named
   `<functionAppName>-kv`). Under **Secrets**, create a secret named
   `github-app-pk` with your GitHub App's PEM-encoded private key as the value.
