import { dispatch } from "../../common/dispatch.js";
import { ensurePkcs8 } from "../../common/pkcs.js";

export default {
  async scheduled(_: ScheduledEvent, env: Env): Promise<void> {
    await dispatch({
      appId: env.GITHUB_APP_ID,
      appPk: ensurePkcs8(await env.GITHUB_APP_PK.get()),
      repo: env.GITHUB_REPO,
      eventType: env.GITHUB_EVENT_TYPE,
      payload: env.GITHUB_PAYLOAD,
    });
  },
};
