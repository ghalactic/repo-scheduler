import { app } from "@azure/functions";
import { dispatch } from "../../common/dispatch.js";

app.timer("schedulerTimer", {
  schedule: "%SCHEDULE_EXPRESSION%",

  handler: async () => {
    const {
      GITHUB_APP_ID: appId = "",
      GITHUB_APP_PK: appPk = "",
      GITHUB_REPO: repo = "",
      GITHUB_EVENT_TYPE: eventType = "",
      GITHUB_PAYLOAD: payload = "{}",
    } = process.env;

    if (!appId || !appPk || !repo || !eventType) {
      throw new Error("Missing required environment variables");
    }

    await dispatch({
      appId,
      appPk,
      repo,
      eventType,
      payload,
    });
  },
});
