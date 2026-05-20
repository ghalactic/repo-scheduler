import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

import { dispatch } from "../dispatch.js";
import worker, { type Env } from "./index.js";

const env: Env = {
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PK:
    "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
  GITHUB_REPO: "owner/repo",
  GITHUB_EVENT_TYPE: "schedule",
};

const event = { cron: "*/30 * * * *", scheduledTime: Date.now() };

beforeEach(() => {
  vi.clearAllMocks();
});

it("calls dispatch with config from env bindings", async () => {
  await worker.scheduled(event, env);

  expect(dispatch).toHaveBeenCalledWith({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PK,
    repo: env.GITHUB_REPO,
    eventType: "schedule",
    payload: {},
  });
});

it("parses GITHUB_PAYLOAD when set", async () => {
  const envWithPayload = { ...env, GITHUB_PAYLOAD: '{"key":"value"}' };

  await worker.scheduled(event, envWithPayload);

  expect(dispatch).toHaveBeenCalledWith({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PK,
    repo: env.GITHUB_REPO,
    eventType: "schedule",
    payload: { key: "value" },
  });
});

it("throws on invalid JSON in GITHUB_PAYLOAD", async () => {
  const envWithBadPayload = { ...env, GITHUB_PAYLOAD: "not-json" };

  await expect(worker.scheduled(event, envWithBadPayload)).rejects.toThrow(
    "GITHUB_PAYLOAD is not valid JSON",
  );
});

it("propagates errors from dispatch", async () => {
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));

  await expect(worker.scheduled(event, env)).rejects.toThrow("dispatch failed");
});
