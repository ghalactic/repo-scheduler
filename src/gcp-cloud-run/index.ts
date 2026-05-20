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
