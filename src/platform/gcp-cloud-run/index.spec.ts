import type { Request, Response } from "@google-cloud/functions-framework";
import { http } from "@google-cloud/functions-framework";
import { beforeEach, expect, it, vi } from "vitest";
import { dispatch } from "../../common/dispatch.js";

vi.mock("@google-cloud/functions-framework", () => ({
  http: vi.fn(),
}));

vi.mock("../../common/dispatch.js", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PK", "fake-key");
  vi.resetModules();
});

it("registers a function named 'schedule'", async () => {
  await import("./index.js");

  expect(http).toHaveBeenCalledWith("schedule", expect.any(Function));
});

it("returns 405 for non-POST requests", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("GET");

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(405);
  expect(res.send).toHaveBeenCalledWith("Method not allowed");
});

it("returns 400 when body is null", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", null);

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith("Invalid input: expected a JSON object");
});

it("returns 400 when body is an array", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", [1, 2, 3]);

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith("Invalid input: expected a JSON object");
});

it("returns 400 when repo is missing from body", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", { eventType: "schedule" });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith("Missing required field: repo");
});

it("returns 400 when eventType is missing from body", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", { repo: "owner/repo" });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith("Missing required field: eventType");
});

it("returns 400 when payload is not a JSON object", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
    payload: "not-an-object",
  });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith("payload must be a JSON object");
});

it("returns 400 when payload is an array", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
    payload: [1, 2, 3],
  });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.send).toHaveBeenCalledWith("payload must be a JSON object");
});

it("calls dispatch with body params and env credentials, returns 200", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
    payload: { key: "value" },
  });

  await handler(req, res);

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: '{"key":"value"}',
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.send).toHaveBeenCalled();
});

it("defaults payload to '{}' when not in body", async () => {
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  await handler(req, res);

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: "{}",
  });
});

it("returns 500 when GITHUB_APP_ID is missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.send).toHaveBeenCalledWith(
    "Missing required environment variable: GITHUB_APP_ID",
  );
});

it("returns 500 when GITHUB_APP_PK is missing", async () => {
  vi.stubEnv("GITHUB_APP_PK", "");
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.send).toHaveBeenCalledWith(
    "Missing required environment variable: GITHUB_APP_PK",
  );
});

it("returns 500 with error message on dispatch failure", async () => {
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.send).toHaveBeenCalledWith("dispatch failed");
});

it("stringifies non-Error rejection values", async () => {
  vi.mocked(dispatch).mockRejectedValue("string-error");
  const handler = await getHandler();
  const [req, res] = makeReqRes("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  await handler(req, res);

  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.send).toHaveBeenCalledWith("string-error");
});

async function getHandler() {
  await import("./index.js");

  return vi.mocked(http).mock.calls[0][1] as (
    req: Request,
    res: Response,
  ) => Promise<void>;
}

function makeReqRes(method: string, body?: unknown): [Request, Response] {
  const req = { method, body } as Request;
  const send = vi.fn();
  const res = { status: vi.fn().mockReturnValue({ send }), send } as unknown as
    Response & {
      status: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
    };

  return [req, res];
}
