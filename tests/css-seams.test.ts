import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("graph sizing applies only to the canvas SVG, not toolbar icons", async () => {
  const css = await readFile(path.join(process.cwd(), "app/globals.css"), "utf8");

  assert.doesNotMatch(css, /\.graph-canvas\s+svg\s*\{/);
  assert.match(css, /\.graph-canvas\s*>\s*svg\s*\{/);
});
