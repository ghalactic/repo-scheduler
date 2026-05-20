import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = mockSend;
  },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { dispatch } from "../dispatch.js";
import { handler } from "./index.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockSend.mockResolvedValue({ SecretString: "fake-pem-key" });
});

it("fetches the private key from Secrets Manager and dispatches", async () => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PK_SECRET_ARN",
    "arn:aws:secretsmanager:us-east-1:123:secret:pk",
  );
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");

  await handler();

  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      input: { SecretId: "arn:aws:secretsmanager:us-east-1:123:secret:pk" },
    }),
  );
  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    privateKey: "fake-pem-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: {},
  });
});

it("parses GITHUB_PAYLOAD when set", async () => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PK_SECRET_ARN",
    "arn:aws:secretsmanager:us-east-1:123:secret:pk",
  );
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");
  vi.stubEnv("GITHUB_PAYLOAD", '{"run_id":"abc"}');

  await handler();

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    privateKey: "fake-pem-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: { run_id: "abc" },
  });
});

it("throws on invalid JSON in GITHUB_PAYLOAD", async () => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PK_SECRET_ARN",
    "arn:aws:secretsmanager:us-east-1:123:secret:pk",
  );
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");
  vi.stubEnv("GITHUB_PAYLOAD", "bad-json");

  await expect(handler()).rejects.toThrow("GITHUB_PAYLOAD is not valid JSON");
});

it("throws when environment variables are missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");
  vi.stubEnv("GITHUB_APP_PK_SECRET_ARN", "");
  vi.stubEnv("GITHUB_REPO", "");
  vi.stubEnv("GITHUB_EVENT_TYPE", "");

  await expect(handler()).rejects.toThrow(
    "Missing required environment variables",
  );
});

it("throws when secret value is empty", async () => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PK_SECRET_ARN",
    "arn:aws:secretsmanager:us-east-1:123:secret:pk",
  );
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");
  mockSend.mockResolvedValue({ SecretString: undefined });

  await expect(handler()).rejects.toThrow("Secret value is empty");
});

it("propagates errors from dispatch", async () => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PK_SECRET_ARN",
    "arn:aws:secretsmanager:us-east-1:123:secret:pk",
  );
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));

  await expect(handler()).rejects.toThrow("dispatch failed");
});
