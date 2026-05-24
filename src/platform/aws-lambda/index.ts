import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../../common/dispatch.js";

export interface ScheduleEvent {
  repo?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
}

export async function handler(event: ScheduleEvent): Promise<void> {
  const { GITHUB_APP_ID: appId = "", GITHUB_APP_PK: secretId = "" } =
    process.env;

  if (!appId) {
    throw new Error("Missing required environment variable: GITHUB_APP_ID");
  }

  if (!secretId) {
    throw new Error("Missing required environment variable: GITHUB_APP_PK");
  }

  const { repo, eventType, payload } = event;

  if (!repo) {
    throw new Error("Missing required event field: repo");
  }

  if (!eventType) {
    throw new Error("Missing required event field: eventType");
  }

  const client = new SecretsManagerClient();
  const { SecretString: appPk } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!appPk) throw new Error("Secret value is empty");

  await dispatch({
    appId,
    appPk,
    repo,
    eventType,
    payload: JSON.stringify(payload ?? {}),
  });
}
