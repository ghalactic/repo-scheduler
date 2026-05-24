import { beforeEach, expect, it, vi } from "vitest";
import { dispatch } from "../../common/dispatch.js";

const mockHttp = vi.hoisted(() => vi.fn());

vi.mock("@azure/functions", () => ({
  app: { http: mockHttp },
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

interface MockRequest {
  method: string;
  json: () => Promise<unknown>;
}

function makeRequest(method: string, body?: unknown): MockRequest {
  return {
    method,
    json: () => Promise.resolve(body),
  };
}

async function getHandler(): Promise<
  (req: MockRequest) => Promise<{ status: number; body?: string }>
> {
  await import("./index.js");
  const options = mockHttp.mock.calls[0][1] as {
    handler: (req: MockRequest) => Promise<{ status: number; body?: string }>;
  };

  return options.handler;
}

it("registers an HTTP trigger with POST method and function auth", async () => {
  await import("./index.js");

  expect(mockHttp).toHaveBeenCalledWith(
    "scheduler",
    expect.objectContaining({
      methods: ["POST"],
      authLevel: "function",
    }),
  );
});

it("dispatches with body params and env credentials, returns 200", async () => {
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
    payload: { key: "value" },
  });

  const res = await handler(req);

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: '{"key":"value"}',
  });
  expect(res.status).toBe(200);
});

it("defaults payload to '{}' when not in body", async () => {
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  await handler(req);

  expect(dispatch).toHaveBeenCalledWith({
    appId: "12345",
    appPk: "fake-key",
    repo: "owner/repo",
    eventType: "schedule",
    payload: "{}",
  });
});

it("returns 400 when repo is missing", async () => {
  const handler = await getHandler();
  const req = makeRequest("POST", { eventType: "schedule" });

  const res = await handler(req);

  expect(res.status).toBe(400);
  expect(res.body).toBe("Missing required field: repo");
});

it("returns 400 when eventType is missing", async () => {
  const handler = await getHandler();
  const req = makeRequest("POST", { repo: "owner/repo" });

  const res = await handler(req);

  expect(res.status).toBe(400);
  expect(res.body).toBe("Missing required field: eventType");
});

it("returns 400 when body is not valid JSON", async () => {
  const handler = await getHandler();
  const req = {
    method: "POST",
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
  };

  const res = await handler(req);

  expect(res.status).toBe(400);
  expect(res.body).toBe("Invalid JSON");
});

it("returns 400 when payload is not a JSON object", async () => {
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
    payload: "not-an-object",
  });

  const res = await handler(req);

  expect(res.status).toBe(400);
  expect(res.body).toBe("payload must be a JSON object");
});

it("returns 400 when payload is an array", async () => {
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
    payload: [1, 2, 3],
  });

  const res = await handler(req);

  expect(res.status).toBe(400);
  expect(res.body).toBe("payload must be a JSON object");
});

it("returns 500 when GITHUB_APP_ID is missing", async () => {
  vi.stubEnv("GITHUB_APP_ID", "");
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  const res = await handler(req);

  expect(res.status).toBe(500);
  expect(res.body).toBe("Missing required environment variable: GITHUB_APP_ID");
});

it("returns 500 when GITHUB_APP_PK is missing", async () => {
  vi.stubEnv("GITHUB_APP_PK", "");
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  const res = await handler(req);

  expect(res.status).toBe(500);
  expect(res.body).toBe("Missing required environment variable: GITHUB_APP_PK");
});

it("returns 500 with error message on dispatch failure", async () => {
  vi.mocked(dispatch).mockRejectedValue(new Error("dispatch failed"));
  const handler = await getHandler();
  const req = makeRequest("POST", {
    repo: "owner/repo",
    eventType: "schedule",
  });

  const res = await handler(req);

  expect(res.status).toBe(500);
  expect(res.body).toBe("dispatch failed");
});
