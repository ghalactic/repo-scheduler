/* eslint-disable no-console */
import { build } from "esbuild";

const [, , outfile] = process.argv;

if (!outfile) {
  console.error("usage: node build-azure-function.ts <outfile>");
  process.exit(1);
}

await build({
  entryPoints: ["src/azure-function/index.ts"],
  bundle: true,
  packages: "bundle",
  sourcemap: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile,
  external: ["@azure/functions"],
});
