import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
import { dispatch } from "../../common/dispatch.js";

const mockListen = vi.hoisted(() => vi.fn());

vi.mock("node:http", () => ({
  createServer: vi.fn(() => ({ listen: mockListen })),
}));

vi.mock("../../common/dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PK", "fake-key");
  vi.stubEnv("PORT", "9999");
  vi.resetModules();
});

it("starts an HTTP server on the PORT env var", async () => {
  await import("./index.js");

  expect(createServer).toHaveBeenCalled();
  expect(mockListen).toHaveBeenCalledWith(9999);
});

it("defaults to port 8080 when PORT is empty", async () => {
  vi.stubEnv("PORT", "");
  await import("./index.js");

  expect(mockListen).toHaveBeenCalledWith(8080);
});

it("returns 405 for non-POST requests", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler(makeReq("GET"), res);

  expect(res.writeHead).toHaveBeenCalledWith(405);
  expect(res.end).toHaveBeenCalledWith("Method not allowed");
});

it("returns 400 when request body is not valid JSON", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler(makeReq("POST", "not json"), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("Invalid JSON");
});

it("returns 400 when body is a JSON null", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler(makeReq("POST", "null"), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("Invalid input: expected a JSON object");
});

it("returns 400 when body is a JSON array", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler(makeReq("POST", "[1,2,3]"), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("Invalid input: expected a JSON object");
});

it("returns 400 when repo is missing from body", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler(makeReq("POST", '{"eventType":"schedule"}'), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("Missing required field: repo");
});

it("returns 400 when eventType is missing from body", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();

  handler(makeReq("POST", '{"repo":"owner/repo"}'), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("Missing required field: eventType");
});

it("calls dispatch with body params and env credentials, returns 200", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({
    repo: "owner/repo",
    eventType: "schedule",
    payload: { key: "value" },
  });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: '{"key":"value"}',
  });
  expect(res.writeHead).toHaveBeenCalledWith(200);
});

it("defaults payload to '{}' when not in body", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({ repo: "owner/repo", eventType: "schedule" });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: "{}",
  });
});

it("returns 413 when request body exceeds 1 MB", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const largeBody = "x".repeat(1_048_577);

  handler(makeReq("POST", largeBody), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(413);
  expect(res.end).toHaveBeenCalledWith("Body too large");
});

it("returns 400 when payload is not a JSON object", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({
    repo: "owner/repo",
    eventType: "schedule",
    payload: "not-an-object",
  });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("payload must be a JSON object");
});

it("returns 400 when payload is an array", async () => {
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({
    repo: "owner/repo",
    eventType: "schedule",
    payload: [1, 2, 3],
  });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(400);
  expect(res.end).toHaveBeenCalledWith("payload must be a JSON object");
});

it("returns 500 when GITHUB_APP_ID is missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({ repo: "owner/repo", eventType: "schedule" });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith(
    "Missing required environment variable: GITHUB_APP_ID",
  );
});

it("returns 500 when GITHUB_APP_PK is missing", async () => {
  vi.stubEnv("GITHUB_APP_PK", "");
  await import("./index.js");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({ repo: "owner/repo", eventType: "schedule" });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith(
    "Missing required environment variable: GITHUB_APP_PK",
  );
});

it("returns 500 with error message on dispatch failure", async () => {
  await import("./index.js");
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({ repo: "owner/repo", eventType: "schedule" });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith("dispatch failed");
});

it("stringifies non-Error rejection values", async () => {
  await import("./index.js");
  vi.mocked(dispatch).mockRejectedValue("string-error");
  const handler = getHandler();
  const res = makeRes();
  const body = JSON.stringify({ repo: "owner/repo", eventType: "schedule" });

  handler(makeReq("POST", body), res);
  await vi.waitFor(() => expect(res.writeHead).toHaveBeenCalled());

  expect(res.writeHead).toHaveBeenCalledWith(500);
  expect(res.end).toHaveBeenCalledWith("string-error");
});

function getHandler() {
  return vi.mocked(createServer).mock.calls[0][0] as (
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
}

function makeRes() {
  const end = vi.fn();
  const writeHead = vi.fn().mockReturnValue({ end });

  return { writeHead, end } as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function makeReq(method: string, body?: string): IncomingMessage {
  const req = new Readable({
    read() {
      if (body != null) this.push(body);
      this.push(null);
    },
  }) as IncomingMessage;
  req.method = method;

  return req;
}
