import assert from "node:assert/strict";
import test from "node:test";
import { buildDependencyEdges } from "../lib/dependency-graph";

function edgesBetween(edges: { source: string; target: string }[], source: string) {
  return edges.filter((edge) => edge.source === source).map((edge) => edge.target).sort();
}

test("a go repository produces a connected dependency graph", () => {
  const files = [
    {
      path: "cmd/server/main.go",
      language: "go",
      source: [
        "package main",
        "",
        "import (",
        '\t"fmt"',
        '\t"example.com/app/internal/store"',
        ")",
        "",
        "func main() { fmt.Println(store.Load()) }"
      ].join("\n")
    },
    {
      path: "internal/store/store.go",
      language: "go",
      source: 'package store\n\nimport "example.com/app/internal/db"\n\nfunc Load() string { return db.Query() }\n'
    },
    { path: "internal/db/db.go", language: "go", source: "package db\n\nfunc Query() string { return \"\" }\n" },
    { path: "go.mod", language: "unknown", source: "module example.com/app\n\ngo 1.22\n" }
  ];

  const edges = buildDependencyEdges(files, { goModulePath: "example.com/app" });

  assert.deepEqual(edgesBetween(edges, "cmd/server/main.go"), ["fmt", "internal/store/store.go"]);
  assert.deepEqual(edgesBetween(edges, "internal/store/store.go"), ["internal/db/db.go"]);
  assert.equal(edges.find((edge) => edge.target === "fmt")?.kind, "unresolved");
  assert.equal(edges.find((edge) => edge.target === "internal/store/store.go")?.kind, "import");
});

test("a java repository produces a connected dependency graph", () => {
  const files = [
    {
      path: "src/main/java/com/foo/App.java",
      language: "java",
      source: "package com.foo;\n\nimport java.util.List;\nimport com.foo.store.Loader;\n\npublic class App {}\n"
    },
    { path: "src/main/java/com/foo/store/Loader.java", language: "java", source: "package com.foo.store;\n\npublic class Loader {}\n" }
  ];

  const edges = buildDependencyEdges(files, {});

  assert.deepEqual(edgesBetween(edges, "src/main/java/com/foo/App.java"), [
    "java.util.List",
    "src/main/java/com/foo/store/Loader.java"
  ]);
});

test("a rust repository produces a connected dependency graph", () => {
  const files = [
    { path: "src/main.rs", language: "rust", source: "mod store;\n\nuse crate::store::Loader;\nuse std::fmt;\n\nfn main() {}\n" },
    { path: "src/store.rs", language: "rust", source: "pub struct Loader;\n" }
  ];

  const edges = buildDependencyEdges(files, {});

  assert.deepEqual(edgesBetween(edges, "src/main.rs"), ["src/store.rs", "src/store.rs", "std::fmt"]);
});

test("a module never depends on itself", () => {
  const files = [
    { path: "src/store.rs", language: "rust", source: "use crate::store::Inner;\npub struct Inner;\n" }
  ];

  assert.deepEqual(buildDependencyEdges(files, {}), []);
});

test("a repository in a language without an extractor produces no false edges", () => {
  const files = [
    { path: "schema.sql", language: "sql", source: "SELECT * FROM users;\n" },
    { path: "config.yaml", language: "yaml", source: "import: not-code\n" }
  ];

  assert.deepEqual(buildDependencyEdges(files, {}), []);
});

test("mixed-language repositories keep each language's edges", () => {
  const files = [
    { path: "web/app.ts", language: "typescript", source: "import { api } from './api';\n" },
    { path: "web/api.ts", language: "typescript", source: "export const api = 1;\n" },
    { path: "worker/main.go", language: "go", source: 'package main\n\nimport "example.com/app/worker/task"\n' },
    { path: "worker/task/task.go", language: "go", source: "package task\n" }
  ];

  const edges = buildDependencyEdges(files, { goModulePath: "example.com/app" });

  assert.deepEqual(edgesBetween(edges, "web/app.ts"), ["web/api.ts"]);
  assert.deepEqual(edgesBetween(edges, "worker/main.go"), ["worker/task/task.go"]);
});
