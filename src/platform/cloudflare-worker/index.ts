import { dispatch } from "../../common/dispatch.js";

export default {
  async scheduled(_: ScheduledEvent, env: Env): Promise<void> {
    await dispatch({
      appId: env.GITHUB_APP_ID,
      appPk: await env.GITHUB_APP_PK.get(),
      repo: env.GITHUB_REPO,
      eventType: env.GITHUB_EVENT_TYPE,
      payload: env.GITHUB_PAYLOAD,
    });
  },
};
