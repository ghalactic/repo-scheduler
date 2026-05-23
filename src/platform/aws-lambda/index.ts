import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../../common/dispatch.js";

export async function handler(): Promise<void> {
  const {
    GITHUB_APP_ID: appId = "",
    GITHUB_APP_PK: secretId = "",
    GITHUB_REPO: repo = "",
    GITHUB_EVENT_TYPE: eventType = "",
    GITHUB_PAYLOAD: payload = "{}",
  } = process.env;

  if (!appId || !secretId || !repo || !eventType) {
    throw new Error("Missing required environment variables");
  }

  const client = new SecretsManagerClient();
  const { SecretString: appPk } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!appPk) throw new Error("Secret value is empty");

  await dispatch({ appId, appPk, repo, eventType, payload });
}
