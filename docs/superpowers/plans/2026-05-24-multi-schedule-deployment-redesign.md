# Multi-Schedule Deployment Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign platform adapters so a single deployment serves multiple
repos/events via external schedulers passing per-invocation parameters.

**Architecture:** Core `dispatch()` unchanged. AWS Lambda reads target from
EventBridge event object. GCP and Azure switch to HTTP endpoints reading target
from POST body. Cloudflare stays as-is (one Worker per target). Deploy buttons
removed for GCP/Azure; CLI-first docs for all platforms.

**Tech Stack:** TypeScript, esbuild, vitest, Node.js 24, Cloudflare Workers, AWS
SAM, Azure Functions, GCP Cloud Run

---

## File Map

| File                                           | Action    | Responsibility                                                          |
| ---------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `src/platform/aws-lambda/index.ts`             | Modify    | Read `repo`/`eventType`/`payload` from event object instead of env vars |
| `src/platform/aws-lambda/index.spec.ts`        | Rewrite   | Test event-based input + env-var credentials                            |
| `src/platform/gcp-cloud-run/index.ts`          | Modify    | Parse JSON POST body for target details                                 |
| `src/platform/gcp-cloud-run/index.spec.ts`     | Rewrite   | Test HTTP body parsing, 400/405/500 responses                           |
| `src/platform/azure-function/index.ts`         | Rewrite   | HTTP trigger reading JSON body                                          |
| `src/platform/azure-function/index.spec.ts`    | Rewrite   | Test HTTP trigger with mock request/response                            |
| `src/platform/cloudflare-worker/index.ts`      | No change | —                                                                       |
| `src/platform/cloudflare-worker/index.spec.ts` | No change | —                                                                       |
| `dist/cloudflare-worker/wrangler.toml`         | Modify    | Update default cron to `21 * * * *`                                     |
| `dist/aws-lambda/template.yaml`                | Modify    | Remove repo/event/payload params, update schedule                       |
| `dist/azure-function/azuredeploy.json`         | Rewrite   | HTTP Function + Key Vault + Logic App                                   |
| `dist/azure-function/host.json`                | Keep      | —                                                                       |
| `dist/azure-function/package.json`             | Keep      | —                                                                       |
| `dist/gcp-cloud-run/app.json`                  | Delete    | No longer needed (deploy button removed)                                |
| `dist/gcp-cloud-run/Dockerfile`                | Keep      | —                                                                       |
| `dist/aws-lambda/README.md`                    | Rewrite   | CLI-first docs with `sam deploy`                                        |
| `dist/azure-function/README.md`                | Rewrite   | CLI-first docs with `az` commands                                       |
| `dist/gcp-cloud-run/README.md`                 | Rewrite   | CLI-first docs with `gcloud` commands                                   |
| `dist/cloudflare-worker/README.md`             | Modify    | Add CLI instructions alongside button                                   |
| `README.md`                                    | Modify    | Update configuration table, remove per-invocation vars from top-level   |

---

## Task 1: AWS Lambda Adapter — Switch to Event-Based Input

**Files:**

- Modify: `src/platform/aws-lambda/index.ts`
- Rewrite: `src/platform/aws-lambda/index.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/platform/aws-lambda/index.spec.ts` with:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/platform/aws-lambda/index.spec.ts` Expected: Multiple
failures because `handler()` currently takes no arguments.

- [ ] **Step 3: Implement the new adapter**

Replace `src/platform/aws-lambda/index.ts` with:

```typescript
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../../common/dispatch.js";

export interface ScheduleEvent {
  repo?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
}

export async function handler(event: ScheduleEvent): Promise<void> {
  const { GITHUB_APP_ID: appId = "", GITHUB_APP_PK: secretId = "" } =
    process.env;

  if (!appId) {
    throw new Error("Missing required environment variable: GITHUB_APP_ID");
  }

  if (!secretId) {
    throw new Error("Missing required environment variable: GITHUB_APP_PK");
  }

  const { repo, eventType, payload } = event;

  if (!repo) {
    throw new Error("Missing required event field: repo");
  }

  if (!eventType) {
    throw new Error("Missing required event field: eventType");
  }

  const client = new SecretsManagerClient();
  const { SecretString: appPk } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!appPk) throw new Error("Secret value is empty");

  await dispatch({
    appId,
    appPk,
    repo,
    eventType,
    payload: JSON.stringify(payload ?? {}),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/platform/aws-lambda/index.spec.ts` Expected: All tests
pass.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b` Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/platform/aws-lambda/index.ts src/platform/aws-lambda/index.spec.ts
git commit -m "feat(aws): read target details from EventBridge event input"
```

---

## Task 2: GCP Cloud Run Adapter — Parse JSON Body

**Files:**

- Modify: `src/platform/gcp-cloud-run/index.ts`
- Rewrite: `src/platform/gcp-cloud-run/index.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/platform/gcp-cloud-run/index.spec.ts` with:

```typescript
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
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
  const { Readable } = require("node:stream");
  const req = new Readable({
    read() {
      if (body != null) this.push(body);
      this.push(null);
    },
  }) as IncomingMessage;
  req.method = method;

  return req;
}

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/platform/gcp-cloud-run/index.spec.ts` Expected:
Failures because the current handler reads from env vars, not body.

- [ ] **Step 3: Implement the new adapter**

Replace `src/platform/gcp-cloud-run/index.ts` with:

```typescript
import { createServer, type IncomingMessage } from "node:http";
import { dispatch } from "../../common/dispatch.js";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");

    return;
  }

  (async () => {
    const raw = await readBody(req);

    let body: unknown;

    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      res.writeHead(400).end("Invalid JSON");

      return;
    }

    const { repo, eventType, payload } = body as Record<string, unknown>;

    if (!repo || typeof repo !== "string") {
      res.writeHead(400).end("Missing required field: repo");

      return;
    }

    if (!eventType || typeof eventType !== "string") {
      res.writeHead(400).end("Missing required field: eventType");

      return;
    }

    const { GITHUB_APP_ID: appId = "", GITHUB_APP_PK: appPk = "" } =
      process.env;

    if (!appId) {
      res
        .writeHead(500)
        .end("Missing required environment variable: GITHUB_APP_ID");

      return;
    }

    if (!appPk) {
      res
        .writeHead(500)
        .end("Missing required environment variable: GITHUB_APP_PK");

      return;
    }

    await dispatch({
      appId,
      appPk,
      repo,
      eventType,
      payload: JSON.stringify(payload ?? {}),
    });

    res.writeHead(200).end();
  })().catch((error) => {
    res
      .writeHead(500)
      .end(error instanceof Error ? error.message : String(error));
  });
});

server.listen(Number(process.env.PORT ?? "") || 8080);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/platform/gcp-cloud-run/index.spec.ts` Expected: All
tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b` Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/platform/gcp-cloud-run/index.ts src/platform/gcp-cloud-run/index.spec.ts
git commit -m "feat(gcp): read target details from HTTP POST body"
```

---

## Task 3: Azure Functions Adapter — Switch to HTTP Trigger

**Files:**

- Rewrite: `src/platform/azure-function/index.ts`
- Rewrite: `src/platform/azure-function/index.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/platform/azure-function/index.spec.ts` with:

```typescript
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
    json: async () => body,
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

it("registers an HTTP trigger with POST method and anonymous auth", async () => {
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
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
  };

  const res = await handler(req);

  expect(res.status).toBe(400);
  expect(res.body).toBe("Invalid JSON");
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/platform/azure-function/index.spec.ts` Expected:
Failures because current adapter uses `app.timer`, not `app.http`.

- [ ] **Step 3: Implement the new adapter**

Replace `src/platform/azure-function/index.ts` with:

```typescript
import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { dispatch } from "../../common/dispatch.js";

app.http("scheduler", {
  methods: ["POST"],
  authLevel: "function",

  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return { status: 400, body: "Invalid JSON" };
    }

    const { repo, eventType, payload } = body as Record<string, unknown>;

    if (!repo || typeof repo !== "string") {
      return { status: 400, body: "Missing required field: repo" };
    }

    if (!eventType || typeof eventType !== "string") {
      return { status: 400, body: "Missing required field: eventType" };
    }

    const { GITHUB_APP_ID: appId = "", GITHUB_APP_PK: appPk = "" } =
      process.env;

    if (!appId) {
      return {
        status: 500,
        body: "Missing required environment variable: GITHUB_APP_ID",
      };
    }

    if (!appPk) {
      return {
        status: 500,
        body: "Missing required environment variable: GITHUB_APP_PK",
      };
    }

    try {
      await dispatch({
        appId,
        appPk,
        repo,
        eventType,
        payload: JSON.stringify(payload ?? {}),
      });
    } catch (error) {
      return {
        status: 500,
        body: error instanceof Error ? error.message : String(error),
      };
    }

    return { status: 200 };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/platform/azure-function/index.spec.ts` Expected: All
tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b` Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/platform/azure-function/index.ts src/platform/azure-function/index.spec.ts
git commit -m "feat(azure): switch to HTTP trigger with per-invocation body params"
```

---

## Task 4: Update Cloudflare Default Schedule

**Files:**

- Modify: `dist/cloudflare-worker/wrangler.toml`

- [ ] **Step 1: Update the cron schedule**

In `dist/cloudflare-worker/wrangler.toml`, change line 8:

```toml
crons = ["21 * * * *"]
```

- [ ] **Step 2: Regenerate the worker types**

Run: `make dist/cloudflare-worker/worker-configuration.d.ts` Expected: Succeeds
(types file regenerated).

- [ ] **Step 3: Run Cloudflare tests to confirm no breakage**

Run: `npx vitest run src/platform/cloudflare-worker/index.spec.ts` Expected: All
tests pass (the test uses a custom cron, not the default).

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write dist/cloudflare-worker/wrangler.toml
git add dist/cloudflare-worker/wrangler.toml dist/cloudflare-worker/worker-configuration.d.ts
git commit -m "chore(cf): change default schedule to once per hour at :21"
```

---

## Task 5: Update AWS SAM Template

**Files:**

- Modify: `dist/aws-lambda/template.yaml`

- [ ] **Step 1: Rewrite the SAM template**

Replace `dist/aws-lambda/template.yaml` with:

```yaml
AWSTemplateFormatVersion: 2010-09-09
Transform: AWS::Serverless-2016-10-31
Description: Ghalactic repo scheduler

Metadata:
  AWS::ServerlessRepo::Application:
    Name: ghalactic-repo-scheduler
    Description: >-
      External scheduler for GitHub repos that triggers a repository dispatch
      event on a configurable schedule.
    Author: ghalactic
    SpdxLicenseId: MIT
    HomePageUrl: https://github.com/ghalactic/repo-scheduler
    SourceCodeUrl: https://github.com/ghalactic/repo-scheduler
    SemanticVersion: 0.0.0

Parameters:
  GitHubAppId:
    Type: String
    Description: GitHub App numeric ID
  Schedule:
    Type: String
    Default: cron(21 * * * ? *)
    Description: EventBridge schedule expression
  TargetRepo:
    Type: String
    Description: Target repository in owner/repo format
  TargetEventType:
    Type: String
    Description: repository_dispatch event type string
  TargetPayload:
    Type: String
    Default: "{}"
    Description: JSON object to include in the dispatch event

Resources:
  GitHubAppPkSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "${AWS::StackName}/ghalactic-repo-scheduler-pk"
      Description: GitHub App PEM-encoded private key

  SchedulerFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: dist/index.handler
      Runtime: nodejs24.x
      Timeout: 30
      Environment:
        Variables:
          GITHUB_APP_ID: !Ref GitHubAppId
          GITHUB_APP_PK: !Ref GitHubAppPkSecret
      Policies:
        - AWSSecretsManagerGetSecretValuePolicy:
            SecretArn: !Ref GitHubAppPkSecret
      Events:
        Schedule:
          Type: Schedule
          Properties:
            Schedule: !Ref Schedule
            Input: !Sub '{"repo":"${TargetRepo}","eventType":"${TargetEventType}","payload":${TargetPayload}}'
            RetryPolicy:
              MaximumRetryAttempts: 3

Outputs:
  SecretArn:
    Description:
      ARN of the secret — populate it with your GitHub App private key
    Value: !Ref GitHubAppPkSecret
  FunctionArn:
    Description:
      ARN of the Lambda function — use as target for additional schedules
    Value: !GetAtt SchedulerFunction.Arn
```

- [ ] **Step 2: Format with Prettier**

Run: `npx prettier --write dist/aws-lambda/template.yaml`

- [ ] **Step 3: Commit**

```bash
git add dist/aws-lambda/template.yaml
git commit -m "feat(aws): update SAM template for event-based invocation model"
```

---

## Task 6: Rewrite Azure ARM Template

**Files:**

- Rewrite: `dist/azure-function/azuredeploy.json`

- [ ] **Step 1: Rewrite the ARM template**

Replace `dist/azure-function/azuredeploy.json` with a template that provisions:

- Storage Account (for Function App)
- App Service Plan (Consumption tier)
- Key Vault (for GitHub App private key)
- Function App (HTTP-triggered, Node 22, Linux)
- Logic App (Recurrence workflow that POSTs to the Function)
- Role assignment (Function App → Key Vault Secrets User)

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "functionAppName": {
      "type": "string",
      "metadata": {
        "description": "Name of the Function App"
      }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]",
      "metadata": {
        "description": "Azure region for resources"
      }
    },
    "gitHubAppId": {
      "type": "string",
      "metadata": {
        "description": "GitHub App numeric ID"
      }
    },
    "targetRepo": {
      "type": "string",
      "metadata": {
        "description": "Target repository in owner/repo format"
      }
    },
    "targetEventType": {
      "type": "string",
      "metadata": {
        "description": "repository_dispatch event type string"
      }
    },
    "targetPayload": {
      "type": "string",
      "defaultValue": "{}",
      "metadata": {
        "description": "JSON object to include in every dispatch event"
      }
    },
    "scheduleInterval": {
      "type": "int",
      "defaultValue": 1,
      "metadata": {
        "description": "Recurrence interval"
      }
    },
    "scheduleFrequency": {
      "type": "string",
      "defaultValue": "Hour",
      "allowedValues": ["Minute", "Hour", "Day", "Week", "Month"],
      "metadata": {
        "description": "Recurrence frequency"
      }
    },
    "scheduleStartTime": {
      "type": "string",
      "defaultValue": "2026-01-01T00:21:00Z",
      "metadata": {
        "description": "Start time for recurrence (controls offset within the interval)"
      }
    }
  },
  "variables": {
    "storageAccountName": "[concat('fn', uniqueString(resourceGroup().id))]",
    "hostingPlanName": "[concat(parameters('functionAppName'), '-plan')]",
    "keyVaultName": "[concat('kv-', uniqueString(resourceGroup().id))]",
    "logicAppName": "[concat(parameters('functionAppName'), '-schedule')]"
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2025-01-01",
      "name": "[variables('storageAccountName')]",
      "location": "[parameters('location')]",
      "sku": {
        "name": "Standard_LRS"
      },
      "kind": "StorageV2"
    },
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2024-04-01",
      "name": "[variables('hostingPlanName')]",
      "location": "[parameters('location')]",
      "sku": {
        "name": "Y1",
        "tier": "Dynamic"
      },
      "properties": {
        "reserved": true
      }
    },
    {
      "type": "Microsoft.KeyVault/vaults",
      "apiVersion": "2024-11-01",
      "name": "[variables('keyVaultName')]",
      "location": "[parameters('location')]",
      "properties": {
        "sku": {
          "family": "A",
          "name": "standard"
        },
        "tenantId": "[subscription().tenantId]",
        "enableRbacAuthorization": true
      }
    },
    {
      "type": "Microsoft.KeyVault/vaults/secrets",
      "apiVersion": "2024-11-01",
      "name": "[concat(variables('keyVaultName'), '/ghalactic-repo-scheduler-pk')]",
      "dependsOn": [
        "[resourceId('Microsoft.KeyVault/vaults', variables('keyVaultName'))]"
      ],
      "properties": {
        "value": "REPLACE_WITH_PEM_PRIVATE_KEY"
      }
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2024-04-01",
      "name": "[parameters('functionAppName')]",
      "location": "[parameters('location')]",
      "kind": "functionapp,linux",
      "identity": {
        "type": "SystemAssigned"
      },
      "dependsOn": [
        "[resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName'))]",
        "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
        "[resourceId('Microsoft.KeyVault/vaults/secrets', variables('keyVaultName'), 'ghalactic-repo-scheduler-pk')]"
      ],
      "properties": {
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
        "siteConfig": {
          "linuxFxVersion": "NODE|22",
          "appSettings": [
            {
              "name": "AzureWebJobsStorage",
              "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', variables('storageAccountName'), ';EndpointSuffix=', environment().suffixes.storage, ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName')), '2025-01-01').keys[0].value)]"
            },
            {
              "name": "FUNCTIONS_EXTENSION_VERSION",
              "value": "~4"
            },
            {
              "name": "FUNCTIONS_WORKER_RUNTIME",
              "value": "node"
            },
            {
              "name": "WEBSITE_NODE_DEFAULT_VERSION",
              "value": "~22"
            },
            {
              "name": "GITHUB_APP_ID",
              "value": "[parameters('gitHubAppId')]"
            },
            {
              "name": "GITHUB_APP_PK",
              "value": "[concat('@Microsoft.KeyVault(SecretUri=https://', variables('keyVaultName'), '.vault.azure.net/secrets/ghalactic-repo-scheduler-pk/)')]"
            }
          ]
        }
      }
    },
    {
      "type": "Microsoft.Authorization/roleAssignments",
      "apiVersion": "2022-04-01",
      "name": "[guid(resourceId('Microsoft.KeyVault/vaults', variables('keyVaultName')), resourceId('Microsoft.Web/sites', parameters('functionAppName')), '4633458b-17de-408a-b874-0445c86b69e6')]",
      "scope": "[resourceId('Microsoft.KeyVault/vaults', variables('keyVaultName'))]",
      "dependsOn": [
        "[resourceId('Microsoft.Web/sites', parameters('functionAppName'))]",
        "[resourceId('Microsoft.KeyVault/vaults', variables('keyVaultName'))]"
      ],
      "properties": {
        "roleDefinitionId": "[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')]",
        "principalId": "[reference(resourceId('Microsoft.Web/sites', parameters('functionAppName')), '2024-04-01', 'Full').identity.principalId]",
        "principalType": "ServicePrincipal"
      }
    },
    {
      "type": "Microsoft.Logic/workflows",
      "apiVersion": "2019-05-01",
      "name": "[variables('logicAppName')]",
      "location": "[parameters('location')]",
      "dependsOn": [
        "[resourceId('Microsoft.Web/sites', parameters('functionAppName'))]"
      ],
      "properties": {
        "state": "Enabled",
        "definition": {
          "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
          "contentVersion": "1.0.0.0",
          "triggers": {
            "Recurrence": {
              "type": "Recurrence",
              "recurrence": {
                "frequency": "[parameters('scheduleFrequency')]",
                "interval": "[parameters('scheduleInterval')]",
                "startTime": "[parameters('scheduleStartTime')]"
              }
            }
          },
          "actions": {
            "Dispatch": {
              "type": "Http",
              "inputs": {
                "method": "POST",
                "uri": "[concat('https://', parameters('functionAppName'), '.azurewebsites.net/api/scheduler')]",
                "headers": {
                  "Content-Type": "application/json",
                  "x-functions-key": "[listKeys(concat(resourceId('Microsoft.Web/sites', parameters('functionAppName')), '/host/default'), '2024-04-01').functionKeys.default]"
                },
                "body": {
                  "repo": "[parameters('targetRepo')]",
                  "eventType": "[parameters('targetEventType')]",
                  "payload": "[json(parameters('targetPayload'))]"
                }
              }
            }
          }
        }
      }
    }
  ],
  "outputs": {
    "keyVaultName": {
      "type": "string",
      "value": "[variables('keyVaultName')]",
      "metadata": {
        "description": "Name of the Key Vault — update the ghalactic-repo-scheduler-pk secret with your PEM key"
      }
    },
    "functionUrl": {
      "type": "string",
      "value": "[concat('https://', parameters('functionAppName'), '.azurewebsites.net/api/scheduler')]",
      "metadata": {
        "description": "URL of the scheduler HTTP function"
      }
    }
  }
}
```

- [ ] **Step 2: Format with Prettier**

Run: `npx prettier --write dist/azure-function/azuredeploy.json`

- [ ] **Step 3: Commit**

```bash
git add dist/azure-function/azuredeploy.json
git commit -m "feat(azure): rewrite ARM template for HTTP trigger + Logic App scheduler"
```

---

## Task 7: Remove GCP Deploy Button Manifest

**Files:**

- Delete: `dist/gcp-cloud-run/app.json`

- [ ] **Step 1: Delete the file**

```bash
git rm dist/gcp-cloud-run/app.json
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore(gcp): remove Cloud Run button manifest"
```

---

## Task 8: Rebuild All Dist Bundles

**Files:**

- Regenerate: `dist/aws-lambda/dist/index.mjs`
- Regenerate: `dist/azure-function/dist/index.mjs`
- Regenerate: `dist/gcp-cloud-run/dist/index.mjs`
- Regenerate: `dist/cloudflare-worker/dist/index.js`

- [ ] **Step 1: Run the full build**

Run: `make` Expected: All dist bundles regenerated successfully.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run` Expected: All tests pass.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b` Expected: No errors.

- [ ] **Step 4: Run lint**

Run: `npx eslint .` Expected: No errors.

- [ ] **Step 5: Commit the rebuilt bundles**

```bash
git add dist/*/dist/
git commit -m "chore: rebuild all platform dist bundles"
```

---

## Task 9: Update Platform READMEs

**Files:**

- Rewrite: `dist/aws-lambda/README.md`
- Rewrite: `dist/azure-function/README.md`
- Rewrite: `dist/gcp-cloud-run/README.md`
- Modify: `dist/cloudflare-worker/README.md`

- [ ] **Step 1: Rewrite AWS README**

Replace `dist/aws-lambda/README.md` with:

````markdown
# AWS Lambda Repo Scheduler

[![Launch Stack][deploy-badge]][deploy-url]

[deploy-badge]:
  https://img.shields.io/badge/Deploy-AWS%20Serverless%20App%20Repository-orange?logo=amazonaws
[deploy-url]:
  https://serverlessrepo.aws.amazon.com/applications/ghalactic-repo-scheduler

## Deploy via CLI

Prerequisites:
[AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

```sh
cd dist/aws-lambda

sam deploy \
  --stack-name repo-scheduler \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    GitHubAppId=YOUR_APP_ID \
    TargetRepo=owner/repo \
    TargetEventType=your-event-type
```
````

After deployment, populate the private key secret (ARN shown in stack outputs):

```sh
aws secretsmanager put-secret-value \
  --secret-id STACK_NAME/ghalactic-repo-scheduler-pk \
  --secret-string "$(cat path/to/private-key.pem)"
```

## Adding More Schedules

Create additional EventBridge schedules targeting the same Lambda with different
inputs:

```sh
aws scheduler create-schedule \
  --name repo-scheduler-other \
  --schedule-expression "cron(45 * * * ? *)" \
  --target '{
    "Arn": "FUNCTION_ARN",
    "RoleArn": "EXECUTION_ROLE_ARN",
    "Input": "{\"repo\":\"owner/other-repo\",\"eventType\":\"other-event\"}"
  }' \
  --flexible-time-window '{"Mode":"OFF"}'
```

## Configuration

| Parameter         | Description                              | Default              |
| ----------------- | ---------------------------------------- | -------------------- |
| `GitHubAppId`     | GitHub App numeric ID                    | (required)           |
| `TargetRepo`      | Target repository in `owner/repo` format | (required)           |
| `TargetEventType` | `repository_dispatch` event type         | (required)           |
| `TargetPayload`   | JSON object for `client_payload`         | `{}`                 |
| `Schedule`        | EventBridge schedule expression          | `cron(21 * * * ? *)` |

````

- [ ] **Step 2: Rewrite Azure README**

Replace `dist/azure-function/README.md` with:

```markdown
# Azure Function Repo Scheduler

## Deploy via CLI

Prerequisites: [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)

```sh
cd dist/azure-function

az deployment group create \
  --resource-group YOUR_RESOURCE_GROUP \
  --template-file azuredeploy.json \
  --parameters \
    functionAppName=repo-scheduler \
    gitHubAppId=YOUR_APP_ID \
    targetRepo=owner/repo \
    targetEventType=your-event-type
````

After deployment, update the Key Vault secret with your GitHub App private key:

```sh
az keyvault secret set \
  --vault-name KEY_VAULT_NAME \
  --name ghalactic-repo-scheduler-pk \
  --file path/to/private-key.pem
```

Then publish the function code from the local clone:

```sh
func azure functionapp publish repo-scheduler
```

## Adding More Schedules

Create additional Logic App workflows that POST to the same function URL with
different bodies. The function URL and key are shown in the deployment outputs.

## Configuration

| Parameter           | Description                              | Default                |
| ------------------- | ---------------------------------------- | ---------------------- |
| `functionAppName`   | Name of the Function App                 | (required)             |
| `gitHubAppId`       | GitHub App numeric ID                    | (required)             |
| `targetRepo`        | Target repository in `owner/repo` format | (required)             |
| `targetEventType`   | `repository_dispatch` event type         | (required)             |
| `targetPayload`     | JSON object for `client_payload`         | `{}`                   |
| `scheduleFrequency` | Recurrence frequency                     | `Hour`                 |
| `scheduleInterval`  | Recurrence interval                      | `1`                    |
| `scheduleStartTime` | Start time (controls offset)             | `2026-01-01T00:21:00Z` |

````

- [ ] **Step 3: Rewrite GCP README**

Replace `dist/gcp-cloud-run/README.md` with:

```markdown
# Google Cloud Run Repo Scheduler

## Deploy via CLI

Prerequisites: [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)

Deploy the Cloud Run service:

```sh
cd dist/gcp-cloud-run

gcloud run deploy repo-scheduler \
  --source . \
  --region YOUR_REGION \
  --set-env-vars "GITHUB_APP_ID=YOUR_APP_ID,GITHUB_APP_PK=$(cat path/to/private-key.pem)" \
  --no-allow-unauthenticated \
  --memory 256Mi \
  --max-instances 1
````

Create a service account for Cloud Scheduler:

```sh
gcloud iam service-accounts create repo-scheduler-invoker \
  --display-name "Repo Scheduler Invoker"

gcloud run services add-iam-policy-binding repo-scheduler \
  --region YOUR_REGION \
  --member "serviceAccount:repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/run.invoker"
```

Create a Cloud Scheduler job:

```sh
gcloud scheduler jobs create http repo-scheduler-job \
  --location YOUR_REGION \
  --schedule "21 * * * *" \
  --uri "$(gcloud run services describe repo-scheduler --region YOUR_REGION --format 'value(status.url)')" \
  --http-method POST \
  --headers "Content-Type=application/json" \
  --message-body '{"repo":"owner/repo","eventType":"your-event-type"}' \
  --oidc-service-account-email "repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com"
```

## Adding More Schedules

Create additional Cloud Scheduler jobs targeting the same service URL with
different message bodies:

```sh
gcloud scheduler jobs create http repo-scheduler-other \
  --location YOUR_REGION \
  --schedule "45 * * * *" \
  --uri SERVICE_URL \
  --http-method POST \
  --headers "Content-Type=application/json" \
  --message-body '{"repo":"owner/other-repo","eventType":"other-event"}' \
  --oidc-service-account-email "repo-scheduler-invoker@PROJECT_ID.iam.gserviceaccount.com"
```

## Configuration

The function reads these from environment variables (set at deploy time):

| Variable        | Description                        |
| --------------- | ---------------------------------- |
| `GITHUB_APP_ID` | GitHub App numeric ID              |
| `GITHUB_APP_PK` | PEM-encoded GitHub App private key |

Each Cloud Scheduler job passes these in the HTTP body:

| Field       | Description                                 |
| ----------- | ------------------------------------------- |
| `repo`      | Target repository in `owner/repo` format    |
| `eventType` | `repository_dispatch` event type            |
| `payload`   | JSON object for `client_payload` (optional) |

````

- [ ] **Step 4: Update Cloudflare README**

Replace `dist/cloudflare-worker/README.md` with:

```markdown
# Cloudflare Worker Repo Scheduler

[![Deploy to Cloudflare Workers][deploy-badge]][deploy-url]

[deploy-badge]: https://deploy.workers.cloudflare.com/button
[deploy-url]:
  https://deploy.workers.cloudflare.com/?url=https://github.com/ghalactic/repo-scheduler/tree/main/dist/cloudflare-worker

## Deploy via Button

Click the button above. The setup page prompts for the required environment
variables and provisions a Secrets Store binding for the private key.

## Deploy via CLI

Prerequisites: [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```sh
cd dist/cloudflare-worker

wrangler deploy \
  --var GITHUB_APP_ID:YOUR_APP_ID \
  --var GITHUB_REPO:owner/repo \
  --var GITHUB_EVENT_TYPE:your-event-type \
  --var GITHUB_PAYLOAD:'{}'
````

Then store the private key in Cloudflare Secrets Store (or use `wrangler secret`
if not using the Secrets Store binding):

```sh
wrangler secret put GITHUB_APP_PK
# Paste your PEM-encoded private key when prompted
```

## Adding More Schedules

Deploy another Worker with different configuration. Each Worker handles one
target repository/event combination. Cloudflare's deploy button makes this
straightforward.

## Configuration

| Variable            | Description                                     |
| ------------------- | ----------------------------------------------- |
| `GITHUB_APP_ID`     | GitHub App numeric ID                           |
| `GITHUB_APP_PK`     | PEM-encoded private key (Secrets Store binding) |
| `GITHUB_REPO`       | Target repository in `owner/repo` format        |
| `GITHUB_EVENT_TYPE` | `repository_dispatch` event type                |
| `GITHUB_PAYLOAD`    | JSON object for `client_payload`                |

To customize the schedule, edit `crons` in `wrangler.toml` before deploying
(default: hourly at `:21`).

````

- [ ] **Step 5: Format all READMEs with Prettier**

```bash
npx prettier --write dist/*/README.md
````

- [ ] **Step 6: Commit**

```bash
git add dist/*/README.md
git commit -m "docs: rewrite platform READMEs with CLI-first deployment instructions"
```

---

## Task 10: Update Root README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update the root README**

Replace `README.md` with:

```markdown
# Repo Scheduler

_Schedules repository events for more reliable GitHub Actions workflow runs_

GitHub Actions cron schedules are unreliable — they can drift, skip, or start
late. This project provides serverless scheduler implementations for multiple
cloud platforms that dispatch `repository_dispatch` events on a fixed schedule
using a GitHub App for authentication.

## How It Works

1. Deploy a single serverless function to your chosen cloud platform
2. Configure your GitHub App credentials at the deployment level
3. Create scheduler entries that invoke the function with target details
4. Each invocation dispatches a `repository_dispatch` event to the specified
   repo

A single deployment can serve multiple repositories and event types — each
scheduler entry passes the target repo/event as parameters.

## Platforms

- [AWS Lambda](dist/aws-lambda/README.md)
- [Azure Functions](dist/azure-function/README.md)
- [Cloudflare Workers](dist/cloudflare-worker/README.md)
- [Google Cloud Run](dist/gcp-cloud-run/README.md)

## Deployment-Level Configuration

These are configured once when you deploy the function:

| Input           | Description                            |
| --------------- | -------------------------------------- |
| `GITHUB_APP_ID` | GitHub App ID                          |
| `GITHUB_APP_PK` | GitHub App PEM-encoded private key[^1] |

[^1]: Each platform stores the private key in its native secret manager.

## Per-Invocation Configuration

These are passed by each scheduler entry (how they're passed varies by platform
— see platform docs):

| Input       | Description                                 |
| ----------- | ------------------------------------------- |
| `repo`      | Target repository in `owner/repo` form      |
| `eventType` | `repository_dispatch` event type            |
| `payload`   | JSON object for `client_payload` (optional) |

## Creating a GitHub App

The scheduler authenticates as a [GitHub App] to dispatch events. Create one
with the following settings:

1. Go to your organization or personal **Settings > Developer settings > GitHub
   Apps > New GitHub App**.
2. Fill in the required fields:
   - **GitHub App name:** anything descriptive (e.g. "Repo Scheduler")
   - **Homepage URL:** can be this repository's URL
   - **Webhook:** uncheck "Active" (no webhook is needed)
3. Under **Repository permissions**, set:
   - **Contents:** Read and write
4. Click **Create GitHub App**.
5. Note the **App ID** shown on the app's settings page.
6. Scroll to **Private keys** and click **Generate a private key**. Save the
   downloaded PEM file — you'll provide its contents to your platform's secret
   store.
7. Go to **Install App** in the sidebar and install it on the repositories you
   want to dispatch events to.

[github app]: https://docs.github.com/apps/creating-github-apps
```

- [ ] **Step 2: Format with Prettier**

```bash
npx prettier --write README.md
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update root README for multi-schedule invocation model"
```

---

## Task 11: Remove Azure Release ZIP Workflow Artifact

**Files:**

- Modify: `Makefile` (remove release target if it only builds the Azure ZIP)

- [ ] **Step 1: Remove the Azure ZIP release target from the Makefile**

Remove these lines from `Makefile`:

```makefile
.PHONY: release
release: artifacts/release/azure-function.zip

artifacts/release/azure-function.zip: dist/azure-function/dist/index.mjs dist/azure-function/host.json dist/azure-function/package.json dist/azure-function/package-lock.json
	@mkdir -p "$(@D)"
	cd dist/azure-function && zip -FSr ../../$@ . -x 'azuredeploy.json' 'README.md'
```

- [ ] **Step 2: Remove the `package-lock.json` from Azure dist (no longer needed
      for ZIP)**

```bash
git rm dist/azure-function/package-lock.json
```

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore(azure): remove release ZIP target and package-lock.json"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Clean build from scratch**

```bash
rm -rf artifacts
make
```

Expected: All targets build successfully.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run` Expected: All tests pass.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b` Expected: No errors.

- [ ] **Step 4: Run lint**

Run: `npx eslint .` Expected: No errors.

- [ ] **Step 5: Run Prettier check**

Run: `npx prettier --check .` Expected: All files formatted.

- [ ] **Step 6: Verify generated files are up to date**

Run: `make verify-generated` (if this target exists) Expected: No uncommitted
changes to generated files.
