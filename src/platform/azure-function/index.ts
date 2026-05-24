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

    if (body == null || typeof body !== "object" || Array.isArray(body)) {
      return { status: 400, body: "Invalid JSON: expected an object" };
    }

    const { repo, eventType, payload } = body as Record<string, unknown>;

    if (!repo || typeof repo !== "string") {
      return { status: 400, body: "Missing required field: repo" };
    }

    if (!eventType || typeof eventType !== "string") {
      return { status: 400, body: "Missing required field: eventType" };
    }

    if (
      payload != null &&
      (typeof payload !== "object" || Array.isArray(payload))
    ) {
      return { status: 400, body: "payload must be a JSON object" };
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
