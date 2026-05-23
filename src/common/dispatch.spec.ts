import { App } from "octokit";
import { beforeEach, expect, it, vi } from "vitest";
import { dispatch, type DispatchConfig } from "./dispatch.js";

const mocks = vi.hoisted(() => {
  return {
    appRequest: vi.fn(),
    installationRequest: vi.fn(),
    getInstallationOctokit: vi.fn(),
    App: vi.fn(),
  };
});

vi.mock("octokit", () => {
  return {
    App: mocks.App,
  };
});

const config: DispatchConfig = {
  appId: "12345",
  appPk: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
  repo: "owner/repo",
  eventType: "schedule",
  payload: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appRequest.mockResolvedValue({ data: { id: 99 } });
  mocks.installationRequest.mockResolvedValue(undefined);
  mocks.getInstallationOctokit.mockResolvedValue({
    request: mocks.installationRequest,
  });
  vi.mocked(App).mockImplementation(function mockApp() {
    return {
      octokit: { request: mocks.appRequest },
      getInstallationOctokit: mocks.getInstallationOctokit,
    } as never;
  });
});

it("creates an App with the configured credentials", async () => {
  await dispatch(config);

  expect(App).toHaveBeenCalledWith({
    appId: config.appId,
    privateKey: config.appPk,
  });
});

it("discovers the installation for the target repo", async () => {
  await dispatch(config);

  expect(mocks.appRequest).toHaveBeenCalledWith(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner: "owner",
      repo: "repo",
    },
  );
});

it("gets an installation octokit for the discovered installation", async () => {
  await dispatch(config);

  expect(mocks.getInstallationOctokit).toHaveBeenCalledWith(99);
});

it("dispatches a repository_dispatch event with the configured event type", async () => {
  await dispatch(config);

  expect(mocks.installationRequest).toHaveBeenCalledWith(
    "POST /repos/{owner}/{repo}/dispatches",
    {
      owner: "owner",
      repo: "repo",
      event_type: "schedule",
      client_payload: {},
    },
  );
});

it("passes client_payload when payload is provided", async () => {
  await dispatch({ ...config, payload: '{"key":"value"}' });

  expect(mocks.installationRequest).toHaveBeenCalledWith(
    "POST /repos/{owner}/{repo}/dispatches",
    {
      owner: "owner",
      repo: "repo",
      event_type: "schedule",
      client_payload: { key: "value" },
    },
  );
});

it("throws when payload is not valid JSON", async () => {
  await expect(dispatch({ ...config, payload: "bad" })).rejects.toThrow(
    "GITHUB_PAYLOAD is not valid JSON",
  );
});

it("throws when payload is a JSON array", async () => {
  await expect(dispatch({ ...config, payload: "[1,2]" })).rejects.toThrow(
    "GITHUB_PAYLOAD must be a JSON object",
  );
});

it("throws when payload is JSON null", async () => {
  await expect(dispatch({ ...config, payload: "null" })).rejects.toThrow(
    "GITHUB_PAYLOAD must be a JSON object",
  );
});

it("throws when payload is a JSON string", async () => {
  await expect(dispatch({ ...config, payload: '"hello"' })).rejects.toThrow(
    "GITHUB_PAYLOAD must be a JSON object",
  );
});

it("throws when the app is not installed on the repo", async () => {
  mocks.appRequest.mockRejectedValue(
    Object.assign(new Error("Not Found"), { status: 404 }),
  );

  await expect(dispatch(config)).rejects.toThrow(
    `GitHub App ${config.appId} is not installed on ${config.repo}`,
  );
});

it("rethrows other octokit errors", async () => {
  const error = Object.assign(new Error("Boom"), { status: 500 });
  mocks.appRequest.mockRejectedValue(error);

  await expect(dispatch(config)).rejects.toBe(error);
});

it("throws on invalid repo format with no slash", async () => {
  await expect(dispatch({ ...config, repo: "noslash" })).rejects.toThrow(
    'Invalid repo format: "noslash". Expected "owner/repo".',
  );
});

it("throws on invalid repo format with empty owner", async () => {
  await expect(dispatch({ ...config, repo: "/repo" })).rejects.toThrow(
    'Invalid repo format: "/repo". Expected "owner/repo".',
  );
});

it("throws on invalid repo format with extra segments", async () => {
  await expect(dispatch({ ...config, repo: "a/b/c" })).rejects.toThrow(
    'Invalid repo format: "a/b/c". Expected "owner/repo".',
  );
});
