import { createServer } from "node:http";
import { dispatch } from "../../common/dispatch.js";

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");

    return;
  }

  const {
    GITHUB_APP_ID: appId = "",
    GITHUB_APP_PK: appPk = "",
    GITHUB_REPO: repo = "",
    GITHUB_EVENT_TYPE: eventType = "",
    GITHUB_PAYLOAD: payload = "{}",
  } = process.env;

  if (!appId || !appPk || !repo || !eventType) {
    res.writeHead(500).end("Missing required environment variables");

    return;
  }

  (async () => {
    await dispatch({ appId, appPk, repo, eventType, payload });
    res.writeHead(200).end();
  })().catch((error) => {
    res
      .writeHead(500)
      .end(error instanceof Error ? error.message : String(error));
  });
});

server.listen(Number(process.env.PORT ?? "") || 8080);
