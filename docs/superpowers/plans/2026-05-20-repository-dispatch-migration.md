# Repository dispatch migration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the repo scheduler from `workflow_dispatch` to
`repository_dispatch`, clean up stale references, make schedules configurable,
and add CI.

**Architecture:** The core `dispatch()` module calls
`POST /repos/{owner}/{repo}/dispatches` with a configurable `event_type` and
`client_payload`. Platform entrypoints read `GITHUB_EVENT_TYPE` (required) and
`GITHUB_PAYLOAD` (optional JSON) from environment. The default-branch resolution
step is removed.

**Tech Stack:** TypeScript, Vitest, esbuild, GitHub REST API via Octokit

---

### Task 1: Rewrite dispatch module

**Files:**

- Modify: `src/dispatch.ts`
- Modify: `src/dispatch.spec.ts`

- [ ] **Step 1: Rewrite `dispatch.spec.ts` for new interface**

```ts
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    appRequest: vi.fn(),
    installationRequest: vi.fn(),
    getInstallationOctokit: vi.fn(),
    App: vi.fn(),
  };
});

vi.mock("octokit", () => {
  return {
    App: mocks.App,
  };
});

import { App } from "octokit";
import { dispatch, type DispatchConfig } from "./dispatch.js";

const config: DispatchConfig = {
  appId: "12345",
  privateKey:
    "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
  repo: "owner/repo",
  eventType: "schedule",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appRequest.mockResolvedValue({ data: { id: 99 } });
  mocks.installationRequest.mockResolvedValue(undefined);
  mocks.getInstallationOctokit.mockResolvedValue({
    request: mocks.installationRequest,
  });
  vi.mocked(App).mockImplementation(function mockApp() {
    return {
      octokit: {
        request: mocks.appRequest,
      },
      getInstallationOctokit: mocks.getInstallationOctokit,
    } as never;
  });
});

it("creates an App with the configured credentials", async () => {
  await dispatch(config);

  expect(App).toHaveBeenCalledWith({
    appId: config.appId,
    privateKey: config.privateKey,
  });
});

it("discovers the installation for the target repo", async () => {
  await dispatch(config);

  expect(mocks.appRequest).toHaveBeenCalledWith(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner: "owner",
      repo: "repo",
    },
  );
});

it("gets an installation octokit for the discovered installation", async () => {
  await dispatch(config);

  expect(mocks.getInstallationOctokit).toHaveBeenCalledWith(99);
});

it("dispatches a repository_dispatch event with the configured event type", async () => {
  await dispatch(config);

  expect(mocks.installationRequest).toHaveBeenCalledWith(
    "POST /repos/{owner}/{repo}/dispatches",
    {
      owner: "owner",
      repo: "repo",
      event_type: "schedule",
      client_payload: {},
    },
  );
});

it("passes client_payload when payload is provided", async () => {
  await dispatch({ ...config, payload: { key: "value" } });

  expect(mocks.installationRequest).toHaveBeenCalledWith(
    "POST /repos/{owner}/{repo}/dispatches",
    {
      owner: "owner",
      repo: "repo",
      event_type: "schedule",
      client_payload: { key: "value" },
    },
  );
});

it("throws when the app is not installed on the repo", async () => {
  mocks.appRequest.mockRejectedValue(
    Object.assign(new Error("Not Found"), { status: 404 }),
  );

  await expect(dispatch(config)).rejects.toThrow(
    `GitHub App ${config.appId} is not installed on ${config.repo}`,
  );
});

it("rethrows other octokit errors", async () => {
  const error = Object.assign(new Error("Boom"), { status: 500 });
  mocks.appRequest.mockRejectedValue(error);

  await expect(dispatch(config)).rejects.toBe(error);
});

it("throws on invalid repo format with no slash", async () => {
  await expect(dispatch({ ...config, repo: "noslash" })).rejects.toThrow(
    'Invalid repo format: "noslash". Expected "owner/repo".',
  );
});

it("throws on invalid repo format with empty owner", async () => {
  await expect(dispatch({ ...config, repo: "/repo" })).rejects.toThrow(
    'Invalid repo format: "/repo". Expected "owner/repo".',
  );
});

it("throws on invalid repo format with extra segments", async () => {
  await expect(dispatch({ ...config, repo: "a/b/c" })).rejects.toThrow(
    'Invalid repo format: "a/b/c". Expected "owner/repo".',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dispatch.spec.ts` Expected: FAIL — `eventType` does not
exist on `DispatchConfig`, dispatch call signature mismatch.

- [ ] **Step 3: Rewrite `dispatch.ts`**

```ts
import { App } from "octokit";

export interface DispatchConfig {
  appId: string;
  privateKey: string;
  repo: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export async function dispatch(config: DispatchConfig): Promise<void> {
  const { appId, privateKey, repo, eventType, payload = {} } = config;
  const [owner, repoName] = splitRepo(repo);
  const app = new App({ appId, privateKey });

  let installationId: number;

  try {
    const { data } = await app.octokit.request(
      "GET /repos/{owner}/{repo}/installation",
      {
        owner,
        repo: repoName,
      },
    );

    installationId = data.id;
  } catch (error: unknown) {
    if (hasStatus(error, 404)) {
      throw new Error(`GitHub App ${appId} is not installed on ${repo}`, {
        cause: error,
      });
    }

    throw error;
  }

  const octokit = await app.getInstallationOctokit(installationId);

  await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
    owner,
    repo: repoName,
    event_type: eventType,
    client_payload: payload,
  });
}

function splitRepo(repo: string): [owner: string, repo: string] {
  const parts = repo.split("/");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }

  return [parts[0], parts[1]];
}

function hasStatus(
  error: unknown,
  status: number,
): error is { status: number } & Error {
  return error instanceof Error && "status" in error && error.status === status;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dispatch.spec.ts` Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/dispatch.ts src/dispatch.spec.ts
git commit -m "Switch dispatch module to repository_dispatch"
```

---

### Task 2: Update Cloudflare Worker entrypoint

**Files:**

- Modify: `src/cloudflare-worker/index.ts`
- Modify: `src/cloudflare-worker/index.spec.ts`

- [ ] **Step 1: Rewrite `index.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cloudflare-worker/index.spec.ts` Expected: FAIL

- [ ] **Step 3: Rewrite `index.ts`**

```ts
import { dispatch } from "../dispatch.js";

/* eslint-disable @typescript-eslint/naming-convention -- Cloudflare env bindings use uppercase names */
export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PK: string;
  GITHUB_REPO: string;
  GITHUB_EVENT_TYPE: string;
  GITHUB_PAYLOAD?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await dispatch({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PK,
      repo: env.GITHUB_REPO,
      eventType: env.GITHUB_EVENT_TYPE,
      payload: parsePayload(env.GITHUB_PAYLOAD),
    });
  },
};

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/cloudflare-worker/index.spec.ts` Expected: PASS (all 4
tests)

- [ ] **Step 5: Commit**

```bash
git add src/cloudflare-worker/
git commit -m "Update Cloudflare Worker for repository_dispatch"
```

---

### Task 3: Update AWS Lambda entrypoint

**Files:**

- Modify: `src/aws-lambda/index.ts`
- Modify: `src/aws-lambda/index.spec.ts`

- [ ] **Step 1: Rewrite `index.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/aws-lambda/index.spec.ts` Expected: FAIL

- [ ] **Step 3: Rewrite `index.ts`**

```ts
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { dispatch } from "../dispatch.js";

export async function handler(): Promise<void> {
  const appId = process.env.GITHUB_APP_ID;
  const secretArn = process.env.GITHUB_APP_PK_SECRET_ARN;
  const repo = process.env.GITHUB_REPO;
  const eventType = process.env.GITHUB_EVENT_TYPE;

  if (!appId || !secretArn || !repo || !eventType) {
    throw new Error("Missing required environment variables");
  }

  const client = new SecretsManagerClient({});
  const secret = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  const privateKey = secret.SecretString;

  if (!privateKey) {
    throw new Error("Secret value is empty");
  }

  await dispatch({
    appId,
    privateKey,
    repo,
    eventType,
    payload: parsePayload(process.env.GITHUB_PAYLOAD),
  });
}

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/aws-lambda/index.spec.ts` Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/aws-lambda/
git commit -m "Update AWS Lambda for repository_dispatch"
```

---

### Task 4: Update GCP Cloud Run entrypoint

**Files:**

- Modify: `src/gcp-cloud-run/index.ts`
- Modify: `src/gcp-cloud-run/index.spec.ts`

- [ ] **Step 1: Rewrite `index.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/gcp-cloud-run/index.spec.ts` Expected: FAIL

- [ ] **Step 3: Rewrite `index.ts`**

```ts
import { createServer } from "node:http";
import { dispatch } from "../dispatch.js";

const port = Number(process.env.PORT) || 8080;

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");

    return;
  }

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PK;
  const repo = process.env.GITHUB_REPO;
  const eventType = process.env.GITHUB_EVENT_TYPE;

  if (!appId || !privateKey || !repo || !eventType) {
    res.writeHead(500).end("Missing required environment variables");

    return;
  }

  let payload: Record<string, unknown>;

  try {
    payload = parsePayload(process.env.GITHUB_PAYLOAD);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(500).end(message);

    return;
  }

  dispatch({ appId, privateKey, repo, eventType, payload }).then(
    () => {
      res.writeHead(200).end();
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500).end(message);
    },
  );
});

server.listen(port);

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/gcp-cloud-run/index.spec.ts` Expected: PASS (all 9
tests)

- [ ] **Step 5: Commit**

```bash
git add src/gcp-cloud-run/
git commit -m "Update GCP Cloud Run for repository_dispatch"
```

---

### Task 5: Update Azure Function entrypoint

**Files:**

- Modify: `src/azure-function/index.ts`
- Modify: `src/azure-function/index.spec.ts`

- [ ] **Step 1: Rewrite `index.spec.ts`**

```ts
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
    payload: {},
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
    payload: { foo: "bar" },
  });
});

it("throws on invalid JSON in GITHUB_PAYLOAD", async () => {
  vi.stubEnv("GITHUB_PAYLOAD", "oops");
  await import("./index.js");
  const handler = getHandler();

  await expect(handler()).rejects.toThrow("GITHUB_PAYLOAD is not valid JSON");
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/azure-function/index.spec.ts` Expected: FAIL

- [ ] **Step 3: Rewrite `index.ts`**

```ts
import { app } from "@azure/functions";
import { dispatch } from "../dispatch.js";

app.timer("schedulerTimer", {
  schedule: "%SCHEDULE_EXPRESSION%",
  handler: async () => {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PK;
    const repo = process.env.GITHUB_REPO;
    const eventType = process.env.GITHUB_EVENT_TYPE;

    if (!appId || !privateKey || !repo || !eventType) {
      throw new Error("Missing required environment variables");
    }

    await dispatch({
      appId,
      privateKey,
      repo,
      eventType,
      payload: parsePayload(process.env.GITHUB_PAYLOAD),
    });
  },
});

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/azure-function/index.spec.ts` Expected: PASS (all 6
tests)

- [ ] **Step 5: Commit**

```bash
git add src/azure-function/
git commit -m "Update Azure Function for repository_dispatch"
```

---

### Task 6: Update dist files — AWS Lambda

**Files:**

- Modify: `dist/aws-lambda/template.yaml`
- Modify: `dist/aws-lambda/README.md`

- [ ] **Step 1: Rewrite `dist/aws-lambda/template.yaml`**

Replace full content with:

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
  GitHubRepo:
    Type: String
    Description: Target repository in owner/repo format
  GitHubEventType:
    Type: String
    Description: repository_dispatch event type string
  Schedule:
    Type: String
    Default: rate(30 minutes)
    Description: EventBridge schedule expression

Resources:
  GitHubAppPkSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "${AWS::StackName}/github-app-pk"
      Description: GitHub App PEM-encoded private key

  SchedulerFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: dist/index.handler
      Runtime: nodejs20.x
      Timeout: 30
      Environment:
        Variables:
          GITHUB_APP_ID: !Ref GitHubAppId
          GITHUB_APP_PK_SECRET_ARN: !Ref GitHubAppPkSecret
          GITHUB_REPO: !Ref GitHubRepo
          GITHUB_EVENT_TYPE: !Ref GitHubEventType
      Policies:
        - AWSSecretsManagerGetSecretValuePolicy:
            SecretArn: !Ref GitHubAppPkSecret
      Events:
        Schedule:
          Type: Schedule
          Properties:
            Schedule: !Ref Schedule
            RetryPolicy:
              MaximumRetryAttempts: 3

Outputs:
  SecretArn:
    Description:
      ARN of the secret — populate it with your GitHub App private key
    Value: !Ref GitHubAppPkSecret
```

- [ ] **Step 2: Rewrite `dist/aws-lambda/README.md`**

````markdown
# AWS Lambda scheduler

[![Launch Stack][deploy-badge]][deploy-url]

Use Lambda and EventBridge to dispatch a `repository_dispatch` event on a fixed
schedule.

## Prerequisites

- AWS account
- [SAM CLI][sam-cli]

## Configure

The template creates an AWS Secrets Manager secret for the private key. After
deploying, populate the secret with your PEM file:

\```sh aws secretsmanager put-secret-value \
 --secret-id <SecretArn from stack outputs> \
 --secret-string file://github-app.pem \```

`GitHubAppId`, `GitHubRepo`, and `GitHubEventType` are passed as CloudFormation
parameters. The schedule defaults to every 30 minutes but can be overridden with
the `Schedule` parameter.

## Deploy

Run the guided deploy from this directory:

\```sh sam deploy --guided \```

EventBridge retries failed invocations up to 3 times.

## Publish to SAR

To make the deploy button work for others, publish the application to the AWS
Serverless Application Repository:

\```sh sam publish --template template.yaml --region <region> \```

After publishing, the deploy button links to the SAR console page where users
can deploy with one click.

[deploy-badge]:
  https://img.shields.io/badge/Deploy-AWS%20Serverless%20App%20Repository-orange?logo=amazonaws
[deploy-url]:
  https://serverlessrepo.aws.amazon.com/applications/ghalactic-repo-scheduler
[sam-cli]:
  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
````

- [ ] **Step 3: Commit**

```bash
git add dist/aws-lambda/
git commit -m "Update AWS dist for repository_dispatch and configurable schedule"
```

---

### Task 7: Update dist files — Cloudflare Worker

**Files:**

- Modify: `dist/cloudflare-worker/wrangler.toml`
- Modify: `dist/cloudflare-worker/README.md`

- [ ] **Step 1: Rewrite `dist/cloudflare-worker/wrangler.toml`**

```toml
name = "ghalactic-repo-scheduler"
main = "dist/index.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/30 * * * *"]

[vars]
GITHUB_APP_ID = ""
GITHUB_REPO = ""
GITHUB_EVENT_TYPE = ""

# GITHUB_APP_PK must be set via: wrangler secret put GITHUB_APP_PK
```

- [ ] **Step 2: Rewrite `dist/cloudflare-worker/README.md`**

````markdown
# Cloudflare Worker scheduler

[![Deploy to Cloudflare Workers][deploy-badge]][deploy-url]

Use a Worker Cron Trigger to dispatch a `repository_dispatch` event on a fixed
schedule.

## Prerequisites

- Cloudflare account
- [Wrangler CLI][wrangler]

## Configure

Edit `wrangler.toml` and set the non-sensitive values:

\```toml [vars] GITHUB_APP_ID = "<app-id>" GITHUB_REPO = "<owner/repo>"
GITHUB_EVENT_TYPE = "<event-type>" \```

To adjust the schedule, edit the `crons` array in `wrangler.toml`.

Store the private key as a Wrangler secret:

\```sh wrangler secret put GITHUB_APP_PK \```

## Deploy

Run the deploy from this directory:

\```sh wrangler deploy \```

[deploy-badge]: https://deploy.workers.cloudflare.com/button
[deploy-url]:
  https://deploy.workers.cloudflare.com/?url=https://github.com/ghalactic/repo-scheduler/tree/main/dist/cloudflare-worker
[wrangler]: https://developers.cloudflare.com/workers/wrangler/
````

- [ ] **Step 3: Commit**

```bash
git add dist/cloudflare-worker/
git commit -m "Update Cloudflare dist for repository_dispatch"
```

---

### Task 8: Update dist files — GCP Cloud Run

**Files:**

- Modify: `dist/gcp-cloud-run/README.md`

- [ ] **Step 1: Rewrite `dist/gcp-cloud-run/README.md`**

````markdown
# Google Cloud Run scheduler

[![Run on Google Cloud][deploy-badge]][deploy-url]

Use Cloud Run and Cloud Scheduler to dispatch a `repository_dispatch` event on a
configurable schedule.

## Prerequisites

- GCP project
- [gcloud CLI][gcloud]

## Configure

Use environment variables for non-sensitive settings and Secret Manager for
`GITHUB_APP_PK`.

Create the secret:

\```sh gcloud secrets create github-app-pk --replication-policy=automatic gcloud
secrets versions add github-app-pk --data-file=github-app.pem \```

## Deploy

Deploy the Cloud Run service from this directory:

\```sh gcloud run deploy ghalactic-repo-scheduler \
 --source=. \
 --region=<region> \
 --no-allow-unauthenticated \
 --set-env-vars=GITHUB_APP_ID=<app-id>,GITHUB_REPO=<owner/repo>,GITHUB_EVENT_TYPE=<event-type>
\
 --set-secrets=GITHUB_APP_PK=github-app-pk:latest \```

Create a Cloud Scheduler job that sends an HTTP POST:

\```sh gcloud scheduler jobs create http ghalactic-repo-scheduler \
 --location=<region> \
 --schedule='_/30 _ \* \* \*' \
 --uri="$(gcloud run services describe ghalactic-repo-scheduler
--region=<region> --format='value(status.url)')" \
 --http-method=POST \
 --oidc-service-account-email=<scheduler-service-account> \
 --max-retry-attempts=3 \```

Use a service account that has the Cloud Run Invoker role. Adjust the
`--schedule` cron expression as needed.

[deploy-badge]: https://deploy.cloud.run/button.svg
[deploy-url]:
  https://deploy.cloud.run/?git_repo=https://github.com/ghalactic/repo-scheduler&dir=dist/gcp-cloud-run
[gcloud]: https://cloud.google.com/sdk/docs/install
````

- [ ] **Step 2: Commit**

```bash
git add dist/gcp-cloud-run/README.md
git commit -m "Update GCP dist for repository_dispatch"
```

---

### Task 9: Update dist files — Azure Function

**Files:**

- Modify: `dist/azure-function/azuredeploy.json`
- Modify: `dist/azure-function/README.md`

- [ ] **Step 1: Update `dist/azure-function/azuredeploy.json`**

Replace the `gitHubWorkflow` parameter with `gitHubEventType` and add
`scheduleExpression`:

In the `parameters` section, remove:

```json
"gitHubWorkflow": {
  "type": "string",
  "defaultValue": "provision-tokens.yml",
  "metadata": {
    "description": "Workflow filename or numeric ID"
  }
}
```

Add:

```json
"gitHubEventType": {
  "type": "string",
  "metadata": {
    "description": "repository_dispatch event type string"
  }
},
"scheduleExpression": {
  "type": "string",
  "defaultValue": "0 */30 * * * *",
  "metadata": {
    "description": "Timer trigger NCRONTAB expression"
  }
}
```

In the Function App `appSettings` array, replace:

```json
{ "name": "GITHUB_WORKFLOW", "value": "[parameters('gitHubWorkflow')]" }
```

with:

```json
{ "name": "GITHUB_EVENT_TYPE", "value": "[parameters('gitHubEventType')]" },
{ "name": "SCHEDULE_EXPRESSION", "value": "[parameters('scheduleExpression')]" }
```

Also update `gitHubRepo` description from "owner/repo of the token-provider
workflow" to "Target repository in owner/repo format".

- [ ] **Step 2: Rewrite `dist/azure-function/README.md`**

````markdown
# Azure Function scheduler

[![Deploy to Azure][deploy-badge]][deploy-url]

Use an Azure Functions timer trigger to dispatch a `repository_dispatch` event
on a configurable schedule.

## Prerequisites

- Azure account
- [Azure Functions Core Tools][functions-core-tools]

## Configure

The ARM template creates a Key Vault with an empty `github-app-pk` secret. After
deploying, update the secret with your PEM key:

\```sh az keyvault secret set \
 --vault-name <keyVaultName from deployment outputs> \
 --name github-app-pk \
 --file github-app.pem \```

The Function App uses a system-assigned managed identity with the Key Vault
Secrets User role, so the Key Vault reference resolves automatically.

The schedule defaults to every 30 minutes and can be changed via the
`scheduleExpression` parameter (NCRONTAB format).

## Deploy

Click the button above, or deploy from the CLI:

\```sh az deployment group create \
 --resource-group <resource-group> \
 --template-file azuredeploy.json \
 --parameters functionAppName=<name> gitHubAppId=<app-id>
gitHubRepo=<owner/repo> gitHubEventType=<event-type> \```

After deployment, update the Key Vault secret as described above, then publish
the function code:

\```sh func azure functionapp publish <function-app> \```

[deploy-badge]: https://aka.ms/deploytoazurebutton
[deploy-url]:
  https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fghalactic%2Frepo-scheduler%2Fmain%2Fdist%2Fazure-function%2Fazuredeploy.json
[functions-core-tools]:
  https://learn.microsoft.com/azure/azure-functions/functions-run-local
````

- [ ] **Step 3: Commit**

```bash
git add dist/azure-function/
git commit -m "Update Azure dist for repository_dispatch and configurable schedule"
```

---

### Task 10: Update top-level dist README

**Files:**

- Modify: `dist/README.md`

- [ ] **Step 1: Rewrite `dist/README.md`**

```markdown
# Repo scheduler platform guides

GitHub Actions cron can drift, skip runs, or start late. If you need a more
predictable schedule, deploy an external scheduler that dispatches
`repository_dispatch` events to your target repo.

## How it works

Each platform runs a scheduled serverless function. On every invocation, it
authenticates as your GitHub App and calls `repository_dispatch` on the target
repository with your configured event type.

Install your GitHub App on the target repository and grant `contents:write` so
it can dispatch events.

## Configuration

| Variable            | Required | Sensitive | Description                                         |
| ------------------- | -------- | --------- | --------------------------------------------------- |
| `GITHUB_APP_ID`     | Yes      | No        | Numeric GitHub App ID                               |
| `GITHUB_APP_PK`     | Yes      | Yes       | PEM-encoded private key (via secret store)          |
| `GITHUB_REPO`       | Yes      | No        | Target repository in `owner/repo` form              |
| `GITHUB_EVENT_TYPE` | Yes      | No        | `repository_dispatch` event type string             |
| `GITHUB_PAYLOAD`    | No       | No        | JSON string for `client_payload` (defaults to `{}`) |

Each platform stores the private key in its native secret manager. See the
individual platform guide for details.

## Platform guides

- [Cloudflare Worker scheduler][cloudflare-worker]
- [AWS Lambda scheduler][aws-lambda]
- [Google Cloud Run scheduler][gcp-cloud-run]
- [Azure Function scheduler][azure-function]

[cloudflare-worker]: ./cloudflare-worker/README.md
[aws-lambda]: ./aws-lambda/README.md
[gcp-cloud-run]: ./gcp-cloud-run/README.md
[azure-function]: ./azure-function/README.md
```

- [ ] **Step 2: Commit**

```bash
git add dist/README.md
git commit -m "Update top-level dist README for repository_dispatch"
```

---

### Task 11: Update top-level README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Rewrite `README.md`**

```markdown
# Repo scheduler

_Dispatch `repository_dispatch` events to GitHub repositories on a reliable
schedule_

GitHub Actions cron schedules are unreliable — they can drift, skip, or start
late. This project provides serverless scheduler implementations for multiple
cloud platforms that dispatch `repository_dispatch` events on a fixed schedule
using a GitHub App for authentication.

## Platforms

| Platform           | Guide                                                      |
| ------------------ | ---------------------------------------------------------- |
| Cloudflare Workers | [dist/cloudflare-worker](dist/cloudflare-worker/README.md) |
| AWS Lambda         | [dist/aws-lambda](dist/aws-lambda/README.md)               |
| Google Cloud Run   | [dist/gcp-cloud-run](dist/gcp-cloud-run/README.md)         |
| Azure Functions    | [dist/azure-function](dist/azure-function/README.md)       |

## How it works

Each platform implementation authenticates as a GitHub App, discovers the app
installation on the target repository, and dispatches a `repository_dispatch`
event with your configured event type and optional payload.

The target repository can then use `on: repository_dispatch` in any workflow to
respond to the event.

## Configuration

See the [platform guides](dist/README.md) for full configuration details.
```

- [ ] **Step 2: Run prettier**

```bash
npx prettier --write README.md
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Rewrite top-level README for standalone repo"
```

---

### Task 12: Add CI workflow

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up pnpm
        uses: pnpm/action-setup@v6

      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: make link-dependencies

      - name: Make
        run: make ci
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI workflow"
```

---

### Task 13: Regenerate dist bundles and verify

- [ ] **Step 1: Run `make regenerate`**

```bash
make regenerate
```

- [ ] **Step 2: Run `make precommit`**

```bash
make precommit
```

Expected: All tests pass, generated files up to date.

- [ ] **Step 3: Stage and commit generated files if changed**

```bash
git add dist/*/dist/
git commit -m "Regenerate dist bundles"
```
