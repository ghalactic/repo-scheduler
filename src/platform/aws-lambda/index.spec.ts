import { beforeEach, expect, it, vi } from "vitest";
import { dispatch } from "../../common/dispatch.js";
import { handler } from "./index.js";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = mockSend;
  },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("../../common/dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockSend.mockResolvedValue({ SecretString: "fake-pem-key" });
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PK", "arn:aws:secretsmanager:us-east-1:123:secret:pk");
});

it("reads repo, eventType, and payload from the event object", async () => {
  await handler({
    repo: "owner/repo",
    eventType: "schedule",
    payload: { run_id: "abc" },
  });

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-pem-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: '{"run_id":"abc"}',
  });
});

it("defaults payload to '{}' when not provided in event", async () => {
  await handler({
    repo: "owner/repo",
    eventType: "schedule",
  });

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-pem-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: "{}",
  });
});

it("fetches the private key from Secrets Manager", async () => {
  await handler({ repo: "owner/repo", eventType: "schedule" });

  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      input: { SecretId: "arn:aws:secretsmanager:us-east-1:123:secret:pk" },
    }),
  );
});

it("throws when GITHUB_APP_ID env var is missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");

  await expect(
    handler({ repo: "owner/repo", eventType: "schedule" }),
  ).rejects.toThrow("Missing required environment variable: GITHUB_APP_ID");
});

it("throws when GITHUB_APP_PK env var is missing", async () => {
  vi.stubEnv("GITHUB_APP_PK", "");

  await expect(
    handler({ repo: "owner/repo", eventType: "schedule" }),
  ).rejects.toThrow("Missing required environment variable: GITHUB_APP_PK");
});

it("throws when repo is missing from event", async () => {
  await expect(handler({ eventType: "schedule" })).rejects.toThrow(
    "Missing required event field: repo",
  );
});

it("throws when eventType is missing from event", async () => {
  await expect(handler({ repo: "owner/repo" })).rejects.toThrow(
    "Missing required event field: eventType",
  );
});

it("throws when secret value is empty", async () => {
  mockSend.mockResolvedValue({ SecretString: undefined });

  await expect(
    handler({ repo: "owner/repo", eventType: "schedule" }),
  ).rejects.toThrow("Secret value is empty");
});

it("propagates errors from dispatch", async () => {
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));

  await expect(
    handler({ repo: "owner/repo", eventType: "schedule" }),
  ).rejects.toThrow("dispatch failed");
});
