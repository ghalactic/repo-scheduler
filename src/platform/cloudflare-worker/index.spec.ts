import { beforeEach, expect, it, vi } from "vitest";
import { dispatch } from "../../common/dispatch.js";
import worker from "./index.js";

vi.mock("../../common/dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../common/pkcs.js", () => ({
  ensurePkcs8: vi.fn((pem: string) => `<pkcs8>${pem}</pkcs8>`),
}));

const appPk =
  "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----";

const env: Env = {
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PK: { get: () => Promise.resolve(appPk) },
  GITHUB_REPO: "owner/repo",
  GITHUB_EVENT_TYPE: "schedule",
  GITHUB_PAYLOAD: "{}",
};

const event = {
  cron: "*/30 * * * *",
  scheduledTime: Date.now(),
} as ScheduledEvent;

beforeEach(() => {
  vi.clearAllMocks();
});

it("converts the private key to PKCS#8 before dispatching", async () => {
  await worker.scheduled(event, env);

  expect(dispatch).toHaveBeenCalledWith({
    appId: env.GITHUB_APP_ID,
    appPk: `<pkcs8>${appPk}</pkcs8>`,
    repo: env.GITHUB_REPO,
    eventType: "schedule",
    payload: "{}",
  });
});

it("parses GITHUB_PAYLOAD when set", async () => {
  const envWithPayload = { ...env, GITHUB_PAYLOAD: '{"key":"value"}' };

  await worker.scheduled(event, envWithPayload);

  expect(dispatch).toHaveBeenCalledWith({
    appId: env.GITHUB_APP_ID,
    appPk: `<pkcs8>${appPk}</pkcs8>`,
    repo: env.GITHUB_REPO,
    eventType: "schedule",
    payload: '{"key":"value"}',
  });
});

it("propagates errors from dispatch", async () => {
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));

  await expect(worker.scheduled(event, env)).rejects.toThrow("dispatch failed");
});
