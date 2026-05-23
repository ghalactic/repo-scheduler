/* eslint-disable no-console */
import { build } from "esbuild";

const [, , outfile] = process.argv;

if (!outfile) {
  console.error("usage: node build-gcp-cloud-run.ts <outfile>");
  process.exit(1);
}

await build({
  entryPoints: ["src/platform/gcp-cloud-run/index.ts"],
  bundle: true,
  packages: "bundle",
  sourcemap: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile,
});
