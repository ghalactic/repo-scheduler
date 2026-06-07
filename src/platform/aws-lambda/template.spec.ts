import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const templatePath = fileURLToPath(
  new URL("../../../dist/aws-lambda/template.yaml", import.meta.url),
);

it("defines the default schedule with EventBridge Scheduler resources", () => {
  const template = readFileSync(templatePath, "utf8");

  expect(template).toContain("Type: AWS::Scheduler::Schedule");
  expect(template).toContain("Service: scheduler.amazonaws.com");
  expect(template).not.toContain("\n          Type: Schedule\n");
});
