import { http } from "@google-cloud/functions-framework";
import { dispatch } from "../../common/dispatch.js";
import { parseScheduleInput } from "../../common/parse-schedule-input.js";

http("schedule", async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");

    return;
  }

  const { GITHUB_APP_ID: appId = "", GITHUB_APP_PK: appPk = "" } = process.env;

  if (!appId) {
    res
      .status(500)
      .send("Missing required environment variable: GITHUB_APP_ID");

    return;
  }

  if (!appPk) {
    res
      .status(500)
      .send("Missing required environment variable: GITHUB_APP_PK");

    return;
  }

  const parsed = parseScheduleInput(req.body);

  if (!parsed.ok) {
    res.status(400).send(parsed.error);

    return;
  }

  try {
    await dispatch({ appId, appPk, ...parsed.value });
    res.status(200).send();
  } catch (error) {
    res
      .status(500)
      .send(error instanceof Error ? error.message : String(error));
  }
});
