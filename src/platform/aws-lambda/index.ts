import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../../common/dispatch.js";

export interface ScheduleEvent {
  repo?: unknown;
  eventType?: unknown;
  payload?: unknown;
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

  if (!repo || typeof repo !== "string") {
    throw new Error("Missing required event field: repo");
  }

  if (!eventType || typeof eventType !== "string") {
    throw new Error("Missing required event field: eventType");
  }

  if (
    payload != null &&
    (typeof payload !== "object" || Array.isArray(payload))
  ) {
    throw new Error("payload must be a JSON object");
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
