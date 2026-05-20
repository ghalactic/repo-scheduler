import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

const mockListen = vi.hoisted(() => vi.fn());

vi.mock("node:http", () => ({
  createServer: vi.fn(() => ({ listen: mockListen })),
}));

import { createServer } from "node:http";
import { dispatch } from "../dispatch.js";

function makeRes() {
  const end = vi.fn();
  const writeHead = vi.fn().mockReturnValue({ end });

  return { writeHead, end } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function getHandler() {
  return vi.mocked(createServer).mock.calls[0][0] as (
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PK", "fake-key");
  vi.stubEnv("GITHUB_REPO", "owner/repo");
  vi.stubEnv("GITHUB_EVENT_TYPE", "schedule");
  vi.stubEnv("PORT", "9999");
  vi.resetModules();
});

it("starts an HTTP server on the PORT env var", async () => {
  await import("./index.js");

  expect(createServer).toHaveBeenCalled();
  expect(mockListen).toHaveBeenCalledWith(9999);
});

it("defaults to port 8080 when PORT is not set", async () => {
  vi.stubEnv("PORT", "");
  await import("./index.js");

  expect(mockListen).toHaveBeenCalledWith(8080);
});

it("returns 405 for non-POST requests", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "GET" } as IncomingMessage, res);

  expect(res.writeHead).toHaveBeenCalledWith(405);
  expect(res.end).toHaveBeenCalledWith("Method not allowed");
});

it("calls dispatch and returns 200 on success", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "POST" } as IncomingMessage, res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    privateKey: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: {},
  });
  expect(res.writeHead).toHaveBeenCalledWith(200);
});

it("parses GITHUB_PAYLOAD when set", async () => {
  vi.stubEnv("GITHUB_PAYLOAD", '{"run":"123"}');
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "POST" } as IncomingMessage, res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    privateKey: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: { run: "123" },
  });
});

it("returns 500 when GITHUB_PAYLOAD is invalid JSON", async () => {
  vi.stubEnv("GITHUB_PAYLOAD", "bad");
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "POST" } as IncomingMessage, res);

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith("GITHUB_PAYLOAD is not valid JSON");
});

it("returns 500 when env vars are missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "POST" } as IncomingMessage, res);

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith(
    "Missing required environment variables",
  );
});

it("returns 500 with error message on dispatch failure", async () => {
  await import("./index.js");
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "POST" } as IncomingMessage, res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith("dispatch failed");
});

it("stringifies non-Error rejection values", async () => {
  await import("./index.js");
  vi.mocked(dispatch).mockRejectedValue("string-error");
  const handler = getHandler();
  const res = makeRes();

  handler({ method: "POST" } as IncomingMessage, res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith("string-error");
});
