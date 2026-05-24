import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../../common/dispatch.js";
import { parseScheduleInput } from "../../common/parse-schedule-input.js";

export async function handler(event: unknown): Promise<void> {
  const parsed = parseScheduleInput(event);

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const { GITHUB_APP_ID: appId = "", GITHUB_APP_PK: secretId = "" } =
    process.env;

  if (!appId) {
    throw new Error("Missing required environment variable: GITHUB_APP_ID");
  }

  if (!secretId) {
    throw new Error("Missing required environment variable: GITHUB_APP_PK");
  }

  const { SecretString: appPk } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!appPk) throw new Error("Secret value is empty");

  await dispatch({
    appId,
    appPk,
    ...parsed.value,
  });
}

const client = new SecretsManagerClient();
