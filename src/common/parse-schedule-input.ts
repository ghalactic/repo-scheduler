export interface ScheduleInput {
  repo: string;
  eventType: string;
  payload: string;
}

export type ParseResult =
  { ok: true; value: ScheduleInput } | { ok: false; error: string };

export function parseScheduleInput(input: unknown): ParseResult {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid input: expected a JSON object" };
  }

  const { repo, eventType, payload } = input as Record<string, unknown>;

  if (!repo || typeof repo !== "string") {
    return { ok: false, error: "Missing required field: repo" };
  }

  if (!eventType || typeof eventType !== "string") {
    return { ok: false, error: "Missing required field: eventType" };
  }

  if (
    payload != null &&
    (typeof payload !== "object" || Array.isArray(payload))
  ) {
    return { ok: false, error: "payload must be a JSON object" };
  }

  return {
    ok: true,
    value: { repo, eventType, payload: JSON.stringify(payload ?? {}) },
  };
}
