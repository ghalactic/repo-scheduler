import { App } from "octokit";

export interface DispatchConfig {
  appId: string;
  appPk: string;
  repo: string;
  eventType: string;
  payload: string;
}

export async function dispatch(config: DispatchConfig): Promise<void> {
  const { appId, appPk, eventType } = config;
  const payload = parsePayload(config.payload);
  const [owner, repo] = splitRepo(config.repo);
  const app = new App({ appId, privateKey: appPk });

  let installationId: number;

  try {
    const { data } = await app.octokit.request(
      "GET /repos/{owner}/{repo}/installation",
      { owner, repo },
    );

    installationId = data.id;
  } catch (error) {
    if (!hasErrorStatus(error, 404)) throw error;

    throw new Error(`GitHub App ${appId} is not installed on ${config.repo}`, {
      cause: error,
    });
  }

  const octokit = await app.getInstallationOctokit(installationId);

  await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
    owner,
    repo,
    event_type: eventType,
    client_payload: payload,
  });
}

function parsePayload(payload: string): Record<string, unknown> {
  if (!payload) return {};

  let parsed: unknown;

  try {
    parsed = JSON.parse(payload) as unknown;
  } catch (error) {
    throw new Error("GITHUB_PAYLOAD is not valid JSON", { cause: error });
  }

  if (isRecord(parsed)) return parsed;

  throw new Error("GITHUB_PAYLOAD must be a JSON object");
}

function splitRepo(repo: string): [owner: string, repo: string] {
  const parts = repo.split("/");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }

  return [parts[0], parts[1]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function hasErrorStatus<T extends number>(
  error: unknown,
  status: T,
): error is Error & { status: T } {
  return error instanceof Error && "status" in error && error.status === status;
}
