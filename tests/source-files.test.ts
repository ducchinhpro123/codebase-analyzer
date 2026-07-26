import assert from "node:assert/strict";
import test from "node:test";
import { isAnalyzableSourceFile, isProbablyText, languageFor } from "../lib/source-files";

test("recognizes source files across common programming languages", () => {
  const samples = new Map([
    ["main.go", "go"],
    ["lib.rs", "rust"],
    ["Application.java", "java"],
    ["Program.cs", "csharp"],
    ["worker.ex", "elixir"],
    ["component.vue", "vue"],
    ["main.tf", "terraform"]
  ]);

  for (const [filePath, language] of samples) {
    const content = Buffer.from("example source");
    assert.equal(isAnalyzableSourceFile(filePath, content), true, filePath);
    assert.equal(languageFor(filePath, content.toString()), language, filePath);
  }
});

test("accepts unfamiliar text source extensions instead of using an allowlist", () => {
  const content = Buffer.from("widget doSomething() {\n  return 42\n}\n");
  assert.equal(isAnalyzableSourceFile("src/widget.customlang", content), true);
  assert.equal(languageFor("src/widget.customlang", content.toString()), "customlang");
});

test("recognizes extensionless source files by filename or shebang", () => {
  assert.equal(isAnalyzableSourceFile("Dockerfile", Buffer.from("FROM node:20\n")), true);
  assert.equal(languageFor("Dockerfile"), "dockerfile");

  const script = Buffer.from("#!/usr/bin/env ruby\nputs 'hello'\n");
  assert.equal(isAnalyzableSourceFile("bin/start", script), true);
  assert.equal(languageFor("bin/start", script.toString()), "ruby");
});

test("keeps binary assets, prose, and generated lockfiles out of analysis", () => {
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0x1a, 0x0a]);
  assert.equal(isProbablyText(binary), false);
  assert.equal(isAnalyzableSourceFile("icon.png", binary), false);
  assert.equal(isAnalyzableSourceFile("README.md", Buffer.from("# Documentation")), false);
  assert.equal(isAnalyzableSourceFile("package-lock.json", Buffer.from("{}")), false);
  assert.equal(isAnalyzableSourceFile(".env.production", Buffer.from("SECRET=value")), false);
});
