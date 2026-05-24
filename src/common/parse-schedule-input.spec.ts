import { describe, expect, it } from "vitest";
import { parseScheduleInput } from "./parse-schedule-input.js";

describe("parseScheduleInput", () => {
  it("returns parsed values for valid input with payload", () => {
    expect(
      parseScheduleInput({
        repo: "owner/repo",
        eventType: "schedule",
        payload: { key: "value" },
      }),
    ).toEqual({
      ok: true,
      value: {
        repo: "owner/repo",
        eventType: "schedule",
        payload: '{"key":"value"}',
      },
    });
  });

  it("defaults payload to '{}' for valid input without payload", () => {
    expect(
      parseScheduleInput({
        repo: "owner/repo",
        eventType: "schedule",
      }),
    ).toEqual({
      ok: true,
      value: {
        repo: "owner/repo",
        eventType: "schedule",
        payload: "{}",
      },
    });
  });

  it("rejects null input", () => {
    expect(parseScheduleInput(null)).toEqual({
      ok: false,
      error: "Invalid input: expected a JSON object",
    });
  });

  it("rejects array input", () => {
    expect(parseScheduleInput([1, 2, 3])).toEqual({
      ok: false,
      error: "Invalid input: expected a JSON object",
    });
  });

  it("rejects missing repo", () => {
    expect(parseScheduleInput({ eventType: "schedule" })).toEqual({
      ok: false,
      error: "Missing required field: repo",
    });
  });

  it("rejects non-string repo", () => {
    expect(parseScheduleInput({ repo: 123, eventType: "schedule" })).toEqual({
      ok: false,
      error: "Missing required field: repo",
    });
  });

  it("rejects missing eventType", () => {
    expect(parseScheduleInput({ repo: "owner/repo" })).toEqual({
      ok: false,
      error: "Missing required field: eventType",
    });
  });

  it("rejects non-string eventType", () => {
    expect(parseScheduleInput({ repo: "owner/repo", eventType: 123 })).toEqual({
      ok: false,
      error: "Missing required field: eventType",
    });
  });

  it("rejects string payload", () => {
    expect(
      parseScheduleInput({
        repo: "owner/repo",
        eventType: "schedule",
        payload: "not-an-object",
      }),
    ).toEqual({
      ok: false,
      error: "payload must be a JSON object",
    });
  });

  it("rejects array payload", () => {
    expect(
      parseScheduleInput({
        repo: "owner/repo",
        eventType: "schedule",
        payload: [1, 2, 3],
      }),
    ).toEqual({
      ok: false,
      error: "payload must be a JSON object",
    });
  });
});
