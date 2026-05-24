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
