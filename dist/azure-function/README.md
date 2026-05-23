# Azure Function repo scheduler

[![Deploy to Azure][deploy-badge]][deploy-url]

[deploy-badge]: https://aka.ms/deploytoazurebutton
[deploy-url]:
  https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fghalactic%2Frepo-scheduler%2Fmain%2Fdist%2Fazure-function%2Fazuredeploy.json

## Usage

1. Click the **Deploy to Azure** button above. Select or create a resource group
   (e.g. `ghalactic-repo-scheduler`), then fill in `functionAppName`,
   `gitHubAppId`, `gitHubRepo`, `gitHubEventType`, and optionally
   `scheduleExpression` (defaults to twice per hour).
2. After deployment completes, open the Key Vault created by the template (its
   name is shown in the deployment outputs). Under **Secrets**, update the
   `ghalactic-repo-scheduler-pk` secret with your GitHub App's PEM-encoded
   private key as the value.
