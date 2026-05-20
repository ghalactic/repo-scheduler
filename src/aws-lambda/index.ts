import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../dispatch.js";

export async function handler(): Promise<void> {
  const appId = process.env.GITHUB_APP_ID;
  const secretArn = process.env.GITHUB_APP_PK_SECRET_ARN;
  const repo = process.env.GITHUB_REPO;
  const eventType = process.env.GITHUB_EVENT_TYPE;

  if (!appId || !secretArn || !repo || !eventType) {
    throw new Error("Missing required environment variables");
  }

  const client = new SecretsManagerClient({});
  const secret = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  const privateKey = secret.SecretString;

  if (!privateKey) {
    throw new Error("Secret value is empty");
  }

  await dispatch({
    appId,
    privateKey,
    repo,
    eventType,
    payload: parsePayload(process.env.GITHUB_PAYLOAD),
  });
}

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }
}
