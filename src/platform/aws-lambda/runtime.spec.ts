import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("loads the generated Lambda bundle without init errors", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import("./dist/aws-lambda/dist/index.mjs")',
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
});
