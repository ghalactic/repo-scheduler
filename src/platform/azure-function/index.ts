import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { dispatch } from "../../common/dispatch.js";
import { parseScheduleInput } from "../../common/parse-schedule-input.js";

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

    const parsed = parseScheduleInput(body);

    if (!parsed.ok) {
      return { status: 400, body: parsed.error };
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
        ...parsed.value,
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
