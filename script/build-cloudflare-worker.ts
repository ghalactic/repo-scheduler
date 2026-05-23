/* eslint-disable no-console */
import { build } from "esbuild";

const [, , outfile] = process.argv;

if (!outfile) {
  console.error("usage: node build-cloudflare-worker.ts <outfile>");
  process.exit(1);
}

await build({
  entryPoints: ["src/platform/cloudflare-worker/index.ts"],
  bundle: true,
  packages: "bundle",
  sourcemap: true,
  platform: "browser",
  target: "es2022",
  format: "esm",
  outfile,
});
