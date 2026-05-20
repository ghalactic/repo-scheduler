import { dispatch } from "../dispatch.js";

/* eslint-disable @typescript-eslint/naming-convention -- Cloudflare env bindings use uppercase names */
export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PK: string;
  GITHUB_REPO: string;
  GITHUB_EVENT_TYPE: string;
  GITHUB_PAYLOAD?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await dispatch({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PK,
      repo: env.GITHUB_REPO,
      eventType: env.GITHUB_EVENT_TYPE,
      payload: parsePayload(env.GITHUB_PAYLOAD),
    });
  },
};

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GITHUB_PAYLOAD is not valid JSON");
  }
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}
