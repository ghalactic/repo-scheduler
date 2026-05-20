import { dispatch } from "../dispatch.js";

/* eslint-disable @typescript-eslint/naming-convention -- Cloudflare env bindings use uppercase names */
export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PK: SecretsStoreSecret;
  GITHUB_REPO: string;
  GITHUB_EVENT_TYPE: string;
  GITHUB_PAYLOAD?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

interface SecretsStoreSecret {
  get(): Promise<string>;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await dispatch({
      appId: env.GITHUB_APP_ID,
      privateKey: await env.GITHUB_APP_PK.get(),
      repo: env.GITHUB_REPO,
      eventType: env.GITHUB_EVENT_TYPE,
      payload: env.GITHUB_PAYLOAD,
    });
  },
};

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}
