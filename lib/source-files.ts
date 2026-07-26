import path from "node:path";
import type { Language } from "./types";

const LANGUAGE_BY_EXTENSION: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyw": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".sc": "scala",
  ".c": "c",
  ".h": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".hh": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  ".m": "objective-c",
  ".mm": "objective-cpp",
  ".cs": "csharp",
  ".fs": "fsharp",
  ".fsx": "fsharp",
  ".vb": "visual-basic",
  ".swift": "swift",
  ".rb": "ruby",
  ".php": "php",
  ".php3": "php",
  ".php4": "php",
  ".php5": "php",
  ".phtml": "php",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hrl": "erlang",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".edn": "clojure",
  ".hs": "haskell",
  ".lhs": "haskell",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".re": "reason",
  ".res": "rescript",
  ".r": "r",
  ".jl": "julia",
  ".lua": "lua",
  ".pl": "perl",
  ".pm": "perl",
  ".raku": "raku",
  ".dart": "dart",
  ".groovy": "groovy",
  ".gvy": "groovy",
  ".gy": "groovy",
  ".gsh": "groovy",
  ".coffee": "coffeescript",
  ".sol": "solidity",
  ".move": "move",
  ".zig": "zig",
  ".nim": "nim",
  ".cr": "crystal",
  ".d": "d",
  ".pas": "pascal",
  ".pp": "pascal",
  ".cob": "cobol",
  ".cbl": "cobol",
  ".asm": "assembly",
  ".s": "assembly",
  ".v": "verilog",
  ".vh": "verilog",
  ".sv": "systemverilog",
  ".svh": "systemverilog",
  ".vhd": "vhdl",
  ".vhdl": "vhdl",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "fish",
  ".ps1": "powershell",
  ".bat": "batch",
  ".cmd": "batch",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".proto": "protobuf",
  ".thrift": "thrift",
  ".vue": "vue",
  ".svelte": "svelte",
  ".astro": "astro",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".json": "json",
  ".jsonc": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".gradle": "gradle",
  ".tf": "terraform",
  ".tfvars": "terraform",
  ".hcl": "hcl",
  ".nix": "nix",
  ".cmake": "cmake",
  ".feature": "gherkin",
  ".wat": "webassembly"
};

const NON_SOURCE_EXTENSIONS = new Set([
  ".adoc",
  ".avif",
  ".bmp",
  ".csv",
  ".doc",
  ".docx",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".lock",
  ".log",
  ".map",
  ".md",
  ".mov",
  ".mp3",
  ".mp4",
  ".otf",
  ".pdf",
  ".png",
  ".rst",
  ".snap",
  ".svg",
  ".tar",
  ".tgz",
  ".tsv",
  ".ttf",
  ".txt",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".zip"
]);

const NON_SOURCE_FILENAMES = new Set([
  "license",
  "license.md",
  "license.txt",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "composer.lock",
  "poetry.lock",
  "gemfile.lock"
]);

function languageFromSpecialFilename(filePath: string): Language | undefined {
  const name = path.basename(filePath).toLowerCase();
  if (/^dockerfile(?:\..+)?$/.test(name)) return "dockerfile";
  if (/^(makefile|gnumakefile)(?:\..+)?$/.test(name)) return "makefile";
  if (name === "cmakelists.txt") return "cmake";
  if (/^(jenkinsfile|vagrantfile|gemfile|rakefile)(?:\..+)?$/.test(name)) return "ruby";
  if (/^(build|workspace)(?:\.bazel)?$/.test(name) || name.endsWith(".bzl")) return "starlark";
  return undefined;
}

function languageFromShebang(source: string): Language | undefined {
  const firstLine = source.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  if (!firstLine.startsWith("#!")) return undefined;
  if (/\bpython(?:\d+(?:\.\d+)*)?\b/.test(firstLine)) return "python";
  if (/\b(?:node|deno|bun)\b/.test(firstLine)) return "javascript";
  if (/\bruby\b/.test(firstLine)) return "ruby";
  if (/\bperl\b/.test(firstLine)) return "perl";
  if (/\bphp\b/.test(firstLine)) return "php";
  if (/\belixir\b/.test(firstLine)) return "elixir";
  if (/\b(?:bash|zsh|dash|ksh|sh)\b/.test(firstLine)) return "shell";
  if (/\bfish\b/.test(firstLine)) return "fish";
  if (/\bpwsh\b|\bpowershell\b/.test(firstLine)) return "powershell";
  return undefined;
}

export function languageFor(filePath: string, source = ""): Language {
  const special = languageFromSpecialFilename(filePath);
  if (special) return special;
  const extension = path.extname(filePath).toLowerCase();
  const known = LANGUAGE_BY_EXTENSION[extension];
  if (known) return known;
  const shebang = languageFromShebang(source);
  if (shebang) return shebang;
  const inferred = extension.slice(1).replace(/[^a-z0-9+#.-]/g, "").slice(0, 32);
  return inferred || "unknown";
}

export function isProbablyText(content: Buffer): boolean {
  if (content.includes(0)) return false;
  const sample = content.subarray(0, Math.min(content.length, 8_192));
  let suspiciousBytes = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 13 && byte < 32)) suspiciousBytes += 1;
  }
  return sample.length === 0 || suspiciousBytes / sample.length < 0.02;
}

export function isAnalyzableSourceFile(filePath: string, content: Buffer): boolean {
  const name = path.basename(filePath).toLowerCase();
  const extension = path.extname(name).toLowerCase();
  if (name === ".env" || name.startsWith(".env.") || NON_SOURCE_FILENAMES.has(name) || NON_SOURCE_EXTENSIONS.has(extension) || !isProbablyText(content)) return false;
  if (extension) return true;
  const source = content.subarray(0, 512).toString("utf8");
  return languageFromSpecialFilename(filePath) !== undefined || languageFromShebang(source) !== undefined;
}
