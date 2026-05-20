import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    coverage: {
      include: ["src/**/*.ts"],
      reportsDirectory: "artifacts/coverage/vitest",
      reporter: ["html", "lcov", "text"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
        },
      },
    ],
  },
});
