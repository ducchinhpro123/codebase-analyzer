import assert from "node:assert/strict";
import test from "node:test";
import { extractImports, hasImportSupport } from "../lib/imports";

function specifiers(language: string, source: string) {
  return extractImports(language, source).map((item) => item.specifier);
}

test("go reads both grouped and single import forms", () => {
  const source = [
    "package main",
    "",
    "import (",
    '\t"fmt"',
    '\t_ "github.com/lib/pq"',
    '\tstore "example.com/app/internal/store"',
    ")",
    "",
    'import "os"',
    "",
    "func main() { fmt.Println(os.Args) }"
  ].join("\n");

  assert.deepEqual(specifiers("go", source), ["fmt", "github.com/lib/pq", "example.com/app/internal/store", "os"]);
});

test("rust reads use paths, brace groups, and module declarations", () => {
  const source = [
    "use std::collections::HashMap;",
    "use crate::store::{load, save};",
    "pub use self::config::Config;",
    "mod parser;",
    "pub mod worker;"
  ].join("\n");

  assert.deepEqual(specifiers("rust", source), [
    "std::collections::HashMap",
    "crate::store",
    "self::config::Config",
    "./parser",
    "./worker"
  ]);
});

test("jvm languages read imports with and without semicolons", () => {
  assert.deepEqual(specifiers("java", "package a.b;\nimport java.util.List;\nimport static org.junit.Assert.assertEquals;\n"), [
    "java.util.List",
    "org.junit.Assert.assertEquals"
  ]);
  assert.deepEqual(specifiers("kotlin", "package a.b\nimport kotlin.io.println\nimport com.foo.Bar as Baz\n"), [
    "kotlin.io.println",
    "com.foo.Bar"
  ]);
  assert.deepEqual(specifiers("scala", "import scala.collection.mutable\nimport com.foo._\n"), [
    "scala.collection.mutable",
    "com.foo"
  ]);
});

test("csharp reads plain, static, aliased, and global using directives", () => {
  const source = "global using System;\nusing System.Text.Json;\nusing static System.Math;\nusing Json = System.Text.Json;\n";

  assert.deepEqual(specifiers("csharp", source), ["System", "System.Text.Json", "System.Math", "System.Text.Json"]);
});

test("c and cpp read quoted and angle-bracket includes", () => {
  assert.deepEqual(specifiers("c", '#include "store.h"\n#include <stdio.h>\n'), ["store.h", "stdio.h"]);
  assert.deepEqual(specifiers("cpp", '#include "engine/render.hpp"\n'), ["engine/render.hpp"]);
});

test("ruby distinguishes relative requires from gem requires", () => {
  const imports = extractImports("ruby", "require 'json'\nrequire_relative '../lib/store'\n");

  assert.deepEqual(imports.map((item) => item.specifier), ["json", "../lib/store"]);
});

test("php reads namespace use statements and file includes", () => {
  const source = "<?php\nnamespace App;\nuse App\\Store\\Loader;\nrequire_once __DIR__ . '/bootstrap.php';\ninclude 'helpers.php';\n";

  assert.deepEqual(specifiers("php", source), ["App\\Store\\Loader", "helpers.php"]);
});

test("elixir reads alias, import, and use declarations", () => {
  assert.deepEqual(specifiers("elixir", "defmodule A do\n  alias App.Store\n  import App.Helpers\n  use GenServer\nend\n"), [
    "App.Store",
    "App.Helpers",
    "GenServer"
  ]);
});

test("swift and dart read their module and package imports", () => {
  assert.deepEqual(specifiers("swift", "import Foundation\nimport UIKit\n"), ["Foundation", "UIKit"]);
  assert.deepEqual(specifiers("dart", "import 'package:flutter/material.dart';\npart 'home.dart';\n"), [
    "package:flutter/material.dart",
    "home.dart"
  ]);
});

test("shell reads sourced files", () => {
  assert.deepEqual(specifiers("shell", "#!/bin/bash\nsource ./lib/common.sh\n. ./lib/env.sh\n"), ["./lib/common.sh", "./lib/env.sh"]);
});

test("python reads plain, aliased, and relative imports", () => {
  const source = "import os\nimport numpy as np\nfrom .store import load\nfrom ..lib.helpers import clean\nfrom pkg import a, b\n";

  assert.deepEqual(specifiers("python", source), ["os", "numpy", ".store", "..lib.helpers", "pkg"]);
});

test("typescript still reads imports through the parser", () => {
  const imports = extractImports("typescript", "import { a } from './a';\nconst b = require('./b');\nexport * from './c';\n");

  assert.deepEqual(imports.map((item) => item.specifier).sort(), ["./a", "./b", "./c"]);
});

test("single-file components read the imports in their script block", () => {
  const source = "<script>\nimport Button from './Button.svelte';\n</script>\n<div />\n";

  assert.deepEqual(specifiers("svelte", source), ["./Button.svelte"]);
});

test("an import written inside a comment is not a dependency", () => {
  const go = ['package main', '', '// import "github.com/ghost/pkg"', '/* import "github.com/other/pkg" */', 'import "fmt"'].join("\n");
  assert.deepEqual(specifiers("go", go), ["fmt"]);

  const ruby = "# require 'ghost'\nrequire 'json'\n";
  assert.deepEqual(specifiers("ruby", ruby), ["json"]);
});

test("a URL inside a string does not truncate the rest of the file", () => {
  const source = ['package main', '', 'const endpoint = "https://example.com/api"', '', 'import "fmt"'].join("\n");

  assert.deepEqual(specifiers("go", source), ["fmt"]);
});

test("every import carries the line it was written on", () => {
  const source = "package main\n\nimport (\n\t\"fmt\"\n\t\"os\"\n)\n";

  assert.deepEqual(extractImports("go", source).map((item) => ({ s: item.specifier, line: item.line })), [
    { s: "fmt", line: 4 },
    { s: "os", line: 5 }
  ]);
});

test("import support is reported honestly per language", () => {
  for (const supported of ["go", "rust", "java", "kotlin", "csharp", "ruby", "php", "c", "cpp", "swift", "elixir", "dart", "python", "typescript", "javascript"]) {
    assert.equal(hasImportSupport(supported), true, `${supported} should report import support`);
  }
  for (const unsupported of ["json", "yaml", "css", "html", "markdown", "sql", "unknown"]) {
    assert.equal(hasImportSupport(unsupported), false, `${unsupported} should not claim import support`);
  }
});

test("a language without an extractor yields no imports rather than guesses", () => {
  assert.deepEqual(specifiers("yaml", "image: node\nimport: not-code\n"), []);
  assert.deepEqual(specifiers("sql", "SELECT * FROM users;\n"), []);
});
