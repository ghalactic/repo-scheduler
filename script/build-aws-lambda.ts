/* eslint-disable no-console */
import { build } from "esbuild";

const [, , outfile] = process.argv;

if (!outfile) {
  console.error("usage: node build-aws-lambda.ts <outfile>");
  process.exit(1);
}

await build({
  entryPoints: ["src/platform/aws-lambda/index.ts"],
  bundle: true,
  packages: "bundle",
  sourcemap: true,
  platform: "node",
  target: "node24",
  format: "esm",
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  outfile,
});
