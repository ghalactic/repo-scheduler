import { createServer } from "node:http";
import { text } from "node:stream/consumers";
import { dispatch } from "../../common/dispatch.js";
import { parseScheduleInput } from "../../common/parse-schedule-input.js";

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");

    return;
  }

  (async () => {
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

    const raw = await text(req);

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

    await dispatch({ appId, appPk, ...parsed.value });

    res.writeHead(200).end();
  })().catch((error) => {
    res
      .writeHead(500)
      .end(error instanceof Error ? error.message : String(error));
  });
});

server.listen(Number(process.env.PORT ?? "") || 8080);
