import { App } from "octokit";

export interface DispatchConfig {
  appId: string;
  privateKey: string;
  repo: string;
  eventType: string;
  payload?: string;
}

export async function dispatch(config: DispatchConfig): Promise<void> {
  const { appId, privateKey, repo, eventType, payload: rawPayload } = config;
  const clientPayload = parsePayload(rawPayload);
  const [owner, repoName] = splitRepo(repo);
  const app = new App({ appId, privateKey });

  let installationId: number;

  try {
    const { data } = await app.octokit.request(
      "GET /repos/{owner}/{repo}/installation",
      {
        owner,
        repo: repoName,
      },
    );

    installationId = data.id;
  } catch (error: unknown) {
    if (hasStatus(error, 404)) {
      throw new Error(`GitHub App ${appId} is not installed on ${repo}`, {
        cause: error,
      });
    }

    throw error;
  }

  const octokit = await app.getInstallationOctokit(installationId);

  await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
    owner,
    repo: repoName,
    event_type: eventType,
    client_payload: clientPayload,
  });
}

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("GITHUB_PAYLOAD must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function splitRepo(repo: string): [owner: string, repo: string] {
  const parts = repo.split("/");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }

  return [parts[0], parts[1]];
}

function hasStatus(
  error: unknown,
  status: number,
): error is { status: number } & Error {
  return error instanceof Error && "status" in error && error.status === status;
}
