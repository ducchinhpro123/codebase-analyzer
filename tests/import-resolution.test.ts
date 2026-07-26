import assert from "node:assert/strict";
import test from "node:test";
import { readGoModulePath, resolveImportTargets } from "../lib/import-resolution";

function repo(...paths: string[]) {
  return { paths: new Set(paths) };
}

test("a relative javascript import resolves through extensions and index files", () => {
  const context = repo("app/main.ts", "app/store.ts", "app/util/index.ts");

  assert.deepEqual(resolveImportTargets("app/main.ts", "typescript", "./store", context), ["app/store.ts"]);
  assert.deepEqual(resolveImportTargets("app/main.ts", "typescript", "./util", context), ["app/util/index.ts"]);
  assert.deepEqual(resolveImportTargets("app/main.ts", "typescript", "react", context), []);
});

test("a python import resolves dotted module paths and package inits", () => {
  const context = repo("src/app/main.py", "src/app/store.py", "src/app/pkg/__init__.py");

  assert.deepEqual(resolveImportTargets("src/app/main.py", "python", ".store", context), ["src/app/store.py"]);
  assert.deepEqual(resolveImportTargets("src/app/main.py", "python", "app.pkg", context), ["src/app/pkg/__init__.py"]);
});

test("a go import resolves through the module path to every file in the package", () => {
  const context = { ...repo("main.go", "internal/store/store.go", "internal/store/query.go"), goModulePath: "example.com/app" };

  assert.deepEqual(resolveImportTargets("main.go", "go", "example.com/app/internal/store", context).sort(), [
    "internal/store/query.go",
    "internal/store/store.go"
  ]);
});

test("a go package import excludes the package's own test files", () => {
  const context = {
    ...repo("main.go", "internal/store/store.go", "internal/store/store_test.go", "internal/store/export_test.go"),
    goModulePath: "example.com/app"
  };

  assert.deepEqual(resolveImportTargets("main.go", "go", "example.com/app/internal/store", context), [
    "internal/store/store.go"
  ]);
});

test("a go import does not reach into a nested package", () => {
  const context = { ...repo("main.go", "internal/store/store.go", "internal/store/sql/sql.go"), goModulePath: "example.com/app" };

  assert.deepEqual(resolveImportTargets("main.go", "go", "example.com/app/internal/store", context), ["internal/store/store.go"]);
});

test("a go import of an external package resolves to nothing", () => {
  const context = { ...repo("main.go"), goModulePath: "example.com/app" };

  assert.deepEqual(resolveImportTargets("main.go", "go", "github.com/lib/pq", context), []);
});

test("the go module path is read from go.mod", () => {
  assert.equal(readGoModulePath("module example.com/app\n\ngo 1.22\n"), "example.com/app");
  assert.equal(readGoModulePath("// leading comment\nmodule\tgithub.com/org/tool\n"), "github.com/org/tool");
  assert.equal(readGoModulePath("go 1.22\n"), undefined);
});

test("a jvm import resolves a class to its source file under any source root", () => {
  const context = repo("src/main/java/com/foo/App.java", "src/main/java/com/foo/store/Loader.java", "src/main/kotlin/com/foo/Util.kt");

  assert.deepEqual(resolveImportTargets("src/main/java/com/foo/App.java", "java", "com.foo.store.Loader", context), [
    "src/main/java/com/foo/store/Loader.java"
  ]);
  assert.deepEqual(resolveImportTargets("src/main/kotlin/com/foo/App.kt", "kotlin", "com.foo.Util", context), [
    "src/main/kotlin/com/foo/Util.kt"
  ]);
  assert.deepEqual(resolveImportTargets("src/main/java/com/foo/App.java", "java", "java.util.List", context), []);
});

test("a rust use path resolves crate modules and mod declarations", () => {
  const context = repo("src/main.rs", "src/store.rs", "src/worker/mod.rs", "src/parser.rs");

  assert.deepEqual(resolveImportTargets("src/main.rs", "rust", "crate::store", context), ["src/store.rs"]);
  assert.deepEqual(resolveImportTargets("src/main.rs", "rust", "crate::worker", context), ["src/worker/mod.rs"]);
  assert.deepEqual(resolveImportTargets("src/main.rs", "rust", "./parser", context), ["src/parser.rs"]);
  assert.deepEqual(resolveImportTargets("src/main.rs", "rust", "std::collections::HashMap", context), []);
});

test("a rust use path resolves past the item it imports", () => {
  const context = repo("src/main.rs", "src/store.rs");

  assert.deepEqual(resolveImportTargets("src/main.rs", "rust", "crate::store::Loader", context), ["src/store.rs"]);
});

test("a c include resolves beside the file and then anywhere in the repository", () => {
  const context = repo("src/main.c", "src/render.h", "include/engine/core.h");

  assert.deepEqual(resolveImportTargets("src/main.c", "c", "render.h", context), ["src/render.h"]);
  assert.deepEqual(resolveImportTargets("src/main.c", "c", "engine/core.h", context), ["include/engine/core.h"]);
  assert.deepEqual(resolveImportTargets("src/main.c", "c", "stdio.h", context), []);
});

test("a ruby relative require resolves to the required file", () => {
  const context = repo("app/main.rb", "lib/store.rb");

  assert.deepEqual(resolveImportTargets("app/main.rb", "ruby", "../lib/store", context), ["lib/store.rb"]);
  assert.deepEqual(resolveImportTargets("app/main.rb", "ruby", "json", context), []);
});

test("an elixir alias resolves a dotted module to its snake case file", () => {
  const context = repo("lib/app/store.ex", "lib/app/http_client.ex");

  assert.deepEqual(resolveImportTargets("lib/app.ex", "elixir", "App.Store", context), ["lib/app/store.ex"]);
  assert.deepEqual(resolveImportTargets("lib/app.ex", "elixir", "App.HTTPClient", context), ["lib/app/http_client.ex"]);
  assert.deepEqual(resolveImportTargets("lib/app.ex", "elixir", "GenServer", context), []);
});

test("a php namespace resolves to the matching class file", () => {
  const context = repo("src/Store/Loader.php", "src/App.php");

  assert.deepEqual(resolveImportTargets("src/App.php", "php", "App\\Store\\Loader", context), ["src/Store/Loader.php"]);
  assert.deepEqual(resolveImportTargets("src/App.php", "php", "helpers.php", context), []);
});

test("a shell source resolves the sourced script", () => {
  const context = repo("bin/run.sh", "lib/common.sh");

  assert.deepEqual(resolveImportTargets("bin/run.sh", "shell", "../lib/common.sh", context), ["lib/common.sh"]);
});

test("resolution never escapes the repository", () => {
  const context = repo("app/main.ts", "app/store.ts");

  assert.deepEqual(resolveImportTargets("app/main.ts", "typescript", "../../../../etc/passwd", context), []);
});
