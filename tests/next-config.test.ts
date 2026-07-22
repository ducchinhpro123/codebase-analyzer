import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";

test("development and production builds use isolated Next.js caches", async () => {
  const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs")).href;
  const { default: nextConfig } = await import(configUrl);

  assert.equal(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir, ".next-dev");
  assert.equal(nextConfig(PHASE_PRODUCTION_BUILD).distDir, ".next");
});
