import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

const mockTimer = vi.hoisted(() => vi.fn());

vi.mock("@azure/functions", () => ({
  app: { timer: mockTimer },
}));

import { dispatch } from "../dispatch.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PK", "fake-key");
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");
  vi.resetModules();
});

function getHandler(): () => Promise<void> {
  const options = mockTimer.mock.calls[0][1] as {
    handler: () => Promise<void>;
  };

  return options.handler;
}

it("registers a timer trigger using SCHEDULE_EXPRESSION app setting", async () => {
  await import("./index.js");

  expect(mockTimer).toHaveBeenCalledWith(
    "schedulerTimer",
    expect.objectContaining({ schedule: "%SCHEDULE_EXPRESSION%" }),
  );
});

it("calls dispatch with config from environment variables", async () => {
  await import("./index.js");
  const handler = getHandler();

  await handler();

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    privateKey: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: undefined,
  });
});

it("parses GITHUB_PAYLOAD when set", async () => {
  vi.stubEnv("GITHUB_PAYLOAD", '{"foo":"bar"}');
  await import("./index.js");
  const handler = getHandler();

  await handler();

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    privateKey: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: '{"foo":"bar"}',
  });
});

it("throws when environment variables are missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");
  await import("./index.js");
  const handler = getHandler();

  await expect(handler()).rejects.toThrow(
    "Missing required environment variables",
  );
});

it("propagates errors from dispatch", async () => {
  await import("./index.js");
  const handler = getHandler();
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));

  await expect(handler()).rejects.toThrow("dispatch failed");
});
