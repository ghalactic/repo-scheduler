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
      payload: process.env.GITHUB_PAYLOAD,
    });
  },
});
