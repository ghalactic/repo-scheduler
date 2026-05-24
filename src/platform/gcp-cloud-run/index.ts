import { createServer, type IncomingMessage } from "node:http";
import { dispatch } from "../../common/dispatch.js";
import { parseScheduleInput } from "../../common/parse-schedule-input.js";

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");

    return;
  }

  (async () => {
    let raw: string;

    try {
      raw = await readBody(req);
    } catch (error) {
      if (error instanceof RangeError) {
        res.writeHead(413).end("Body too large");

        return;
      }

      throw error;
    }

    let body: unknown;

    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      res.writeHead(400).end("Invalid JSON");

      return;
    }

    const parsed = parseScheduleInput(body);

    if (!parsed.ok) {
      res.writeHead(400).end(parsed.error);

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
      ...parsed.value,
    });

    res.writeHead(200).end();
  })().catch((error) => {
    res
      .writeHead(500)
      .end(error instanceof Error ? error.message : String(error));
  });
});

server.listen(Number(process.env.PORT ?? "") || 8080);

const MAX_BODY_BYTES = 1_048_576; // 1 MB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new RangeError("Body too large"));

        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
