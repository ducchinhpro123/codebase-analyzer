import path from "node:path";
import type { Language } from "./types";

export type ResolutionContext = {
  /** Every analyzable file path in the repository, repository-relative. */
  paths: Set<string>;
  /** The module path declared in go.mod, when the repository is a Go module. */
  goModulePath?: string;
};

/** File extensions a language's own modules are written in, tried in order. */
const EXTENSIONS: Record<string, string[]> = {
  typescript: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  javascript: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"],
  vue: [".vue", ".ts", ".js"],
  svelte: [".svelte", ".ts", ".js"],
  astro: [".astro", ".ts", ".js"],
  python: [".py"],
  go: [".go"],
  rust: [".rs"],
  java: [".java"],
  kotlin: [".kt", ".java"],
  scala: [".scala", ".java"],
  groovy: [".groovy", ".java"],
  ruby: [".rb"],
  php: [".php"],
  dart: [".dart"],
  elixir: [".ex", ".exs"],
  shell: [".sh", ".bash", ""],
  fish: [".fish", ""],
  c: [".h", ".c"],
  cpp: [".hpp", ".hh", ".h", ".cpp", ".cc"],
  "objective-c": [".h", ".m"],
  "objective-cpp": [".h", ".mm"]
};

/** Index files that stand in for a directory when it is imported as a module. */
const DIRECTORY_ENTRIES: Record<string, string[]> = {
  typescript: ["index.ts", "index.tsx", "index.js", "index.jsx"],
  javascript: ["index.js", "index.jsx", "index.ts", "index.tsx"],
  vue: ["index.ts", "index.js"],
  svelte: ["index.ts", "index.js"],
  astro: ["index.ts", "index.js"],
  python: ["__init__.py"],
  rust: ["mod.rs"]
};

const JVM_LANGUAGES = new Set(["java", "kotlin", "scala", "groovy"]);

function joinWithin(fromDirectory: string, specifier: string): string | undefined {
  const joined = path.posix.normalize(path.posix.join(fromDirectory, specifier));
  // A specifier that climbs out of the repository root resolves to nothing.
  if (joined.startsWith("..") || path.posix.isAbsolute(joined)) return undefined;
  return joined.replace(/^\.\//, "");
}

function candidatesFor(base: string, language: Language): string[] {
  const extensions = EXTENSIONS[language] ?? [];
  const entries = DIRECTORY_ENTRIES[language] ?? [];
  return [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...entries.map((entry) => `${base}/${entry}`)
  ];
}

function firstExisting(base: string, language: Language, paths: Set<string>): string | undefined {
  return candidatesFor(base, language).find((candidate) => candidate !== "" && paths.has(candidate));
}

function resolveRelative(sourcePath: string, specifier: string, language: Language, paths: Set<string>): string[] {
  const base = joinWithin(path.posix.dirname(sourcePath), specifier);
  if (!base) return [];
  const found = firstExisting(base, language, paths);
  return found ? [found] : [];
}

/** Read the module path a Go repository declares, which prefixes its own imports. */
export function readGoModulePath(goModSource: string): string | undefined {
  return goModSource.match(/^[ \t]*module[ \t]+(\S+)/m)?.[1];
}

function resolveGo(specifier: string, context: ResolutionContext): string[] {
  const modulePath = context.goModulePath;
  if (!modulePath) return [];
  if (specifier !== modulePath && !specifier.startsWith(`${modulePath}/`)) return [];
  const directory = specifier.slice(modulePath.length).replace(/^\//, "");
  const prefix = directory ? `${directory}/` : "";
  // A Go import names a package, which is every non-test Go file directly in
  // that directory. Test files are not part of the package an importer sees,
  // and a nested directory is a different package.
  return [...context.paths].filter((candidate) =>
    candidate.startsWith(prefix)
    && candidate.endsWith(".go")
    && !candidate.endsWith("_test.go")
    && !candidate.slice(prefix.length).includes("/"));
}

function resolveJvm(specifier: string, language: Language, paths: Set<string>): string[] {
  const asPath = specifier.replace(/\./g, "/");
  const extensions = EXTENSIONS[language] ?? [".java"];
  // Class names live under a source root, so match on the package tail.
  for (const extension of extensions) {
    const suffix = `${asPath}${extension}`;
    const match = [...paths].find((candidate) => candidate === suffix || candidate.endsWith(`/${suffix}`));
    if (match) return [match];
  }
  return [];
}

function resolveRust(sourcePath: string, specifier: string, paths: Set<string>): string[] {
  if (specifier.startsWith("./")) return resolveRelative(sourcePath, specifier, "rust", paths);
  const segments = specifier.split("::").filter(Boolean);
  const root = segments[0];
  if (root !== "crate" && root !== "self" && root !== "super") return [];
  const crateRoot = sourcePath.startsWith("src/") ? "src" : path.posix.dirname(sourcePath);
  const base = root === "crate" ? crateRoot : path.posix.dirname(sourcePath);
  // The tail of a use path may name an item rather than a module, so try
  // progressively shorter module paths and keep the longest that exists.
  for (let depth = segments.length; depth > 1; depth -= 1) {
    const candidate = joinWithin(base, segments.slice(1, depth).join("/"));
    if (!candidate) continue;
    const found = firstExisting(candidate, "rust", paths);
    if (found) return [found];
  }
  return [];
}

function resolveInclude(sourcePath: string, specifier: string, language: Language, paths: Set<string>): string[] {
  const beside = joinWithin(path.posix.dirname(sourcePath), specifier);
  if (beside && paths.has(beside)) return [beside];
  const match = [...paths].find((candidate) => candidate === specifier || candidate.endsWith(`/${specifier}`));
  return match ? [match] : [];
}

function toSnakeCase(segment: string): string {
  return segment
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function resolveElixir(specifier: string, paths: Set<string>): string[] {
  const asPath = specifier.split(".").map(toSnakeCase).join("/");
  for (const extension of EXTENSIONS.elixir) {
    const suffix = `${asPath}${extension}`;
    const match = [...paths].find((candidate) => candidate === suffix || candidate.endsWith(`/${suffix}`));
    if (match) return [match];
  }
  return [];
}

function resolvePhp(sourcePath: string, specifier: string, paths: Set<string>): string[] {
  if (!specifier.includes("\\")) return resolveRelative(sourcePath, specifier, "php", paths);
  const segments = specifier.split("\\").filter(Boolean);
  // The leading segments are a namespace root that need not exist on disk, so
  // match on the longest tail of the namespace that does.
  for (let start = 0; start < segments.length; start += 1) {
    const suffix = `${segments.slice(start).join("/")}.php`;
    const match = [...paths].find((candidate) => candidate === suffix || candidate.endsWith(`/${suffix}`));
    if (match) return [match];
  }
  return [];
}

function resolvePython(sourcePath: string, specifier: string, paths: Set<string>): string[] {
  const relativeDepth = specifier.match(/^\.+/)?.[0].length ?? 0;
  if (relativeDepth) {
    let directory = path.posix.dirname(sourcePath);
    for (let level = 1; level < relativeDepth; level += 1) directory = path.posix.dirname(directory);
    const base = joinWithin(directory, specifier.slice(relativeDepth).replace(/\./g, "/"));
    const found = base ? firstExisting(base, "python", paths) : undefined;
    return found ? [found] : [];
  }
  const asPath = specifier.replace(/\./g, "/");
  const direct = firstExisting(asPath, "python", paths);
  if (direct) return [direct];
  const suffixes = candidatesFor(asPath, "python").filter(Boolean);
  const match = [...paths].find((candidate) => suffixes.some((suffix) => candidate.endsWith(`/${suffix}`)));
  return match ? [match] : [];
}

/**
 * Resolve one import specifier to the repository files it refers to.
 *
 * A specifier that names something outside the repository — a package, a
 * standard library module, a system header — resolves to no targets, and the
 * caller records it as an unresolved edge rather than inventing one.
 */
export function resolveImportTargets(
  sourcePath: string,
  language: Language,
  specifier: string,
  context: ResolutionContext
): string[] {
  if (!specifier) return [];
  const paths = context.paths;

  if (language === "python") return resolvePython(sourcePath, specifier, paths);
  if (language === "go") return resolveGo(specifier, context);
  if (language === "rust") return resolveRust(sourcePath, specifier, paths);
  if (JVM_LANGUAGES.has(language)) return resolveJvm(specifier, language, paths);
  if (language === "php") return resolvePhp(sourcePath, specifier, paths);
  if (language === "elixir") return resolveElixir(specifier, paths);
  if (language === "c" || language === "cpp" || language === "objective-c" || language === "objective-cpp") {
    return resolveInclude(sourcePath, specifier, language, paths);
  }
  if (language === "dart" && specifier.startsWith("package:")) return [];

  if (specifier.startsWith(".")) return resolveRelative(sourcePath, specifier, language, paths);
  return [];
}
