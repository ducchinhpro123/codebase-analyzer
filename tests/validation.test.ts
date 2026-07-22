import assert from "node:assert/strict";
import test from "node:test";
import { repositoryUrlSchema } from "../lib/validation";

test("normalizes a scheme-less GitHub repository URL", () => {
  const result = repositoryUrlSchema.safeParse("github.com/ducchinhpro123/ai_translator");
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data, "https://github.com/ducchinhpro123/ai_translator");
});

test("rejects non-GitHub and ambiguous repository URLs without throwing", () => {
  for (const input of ["example.com/user/repo", "github.com/user/repo/issues", "https://github.com/user/repo?ref=main"]) {
    assert.doesNotThrow(() => repositoryUrlSchema.safeParse(input));
    assert.equal(repositoryUrlSchema.safeParse(input).success, false);
  }
});
