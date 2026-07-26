import { parseJavaScriptImports } from "./ast";
import type { DependencyEdge, Language } from "./types";

export type ExtractedImport = { specifier: string; kind: DependencyEdge["kind"]; line: number };

type CommentStyle = { line: string[]; block?: [string, string] };

const C_COMMENTS: CommentStyle = { line: ["//"], block: ["/*", "*/"] };
const PHP_COMMENTS: CommentStyle = { line: ["//", "#"], block: ["/*", "*/"] };
const HASH_COMMENTS: CommentStyle = { line: ["#"] };
const LUA_COMMENTS: CommentStyle = { line: ["--"], block: ["--[[", "]]"] };

/**
 * Blank out comments while preserving every character position.
 *
 * Import extraction is line-anchored, so positions must survive: replacing
 * comment bodies with spaces keeps reported line numbers pointing at the real
 * source. String literals are tracked so a `//` inside a URL is not mistaken
 * for the start of a comment.
 */
function blankComments(source: string, style: CommentStyle): string {
  const out = source.split("");
  const blankRange = (from: number, to: number) => {
    for (let index = from; index < to && index < out.length; index += 1) {
      if (out[index] !== "\n") out[index] = " ";
    }
  };

  let index = 0;
  let quote: string | undefined;
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      if (character === "\\") { index += 2; continue; }
      if (character === quote || character === "\n") quote = undefined;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") { quote = character; index += 1; continue; }

    const blockStart = style.block && source.startsWith(style.block[0], index) ? style.block : undefined;
    if (blockStart) {
      const end = source.indexOf(blockStart[1], index + blockStart[0].length);
      const stop = end === -1 ? source.length : end + blockStart[1].length;
      blankRange(index, stop);
      index = stop;
      continue;
    }
    const lineMarker = style.line.find((marker) => source.startsWith(marker, index));
    if (lineMarker) {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      blankRange(index, stop);
      index = stop;
      continue;
    }
    index += 1;
  }
  return out.join("");
}

/** Build an offset-to-line lookup once, so extracting many imports stays linear. */
function createLineLookup(source: string) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return (offset: number) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

type Extractor = (source: string, lineAt: (offset: number) => number) => ExtractedImport[];

function collect(
  source: string,
  lineAt: (offset: number) => number,
  pattern: RegExp,
  kind: DependencyEdge["kind"],
  pick: (match: RegExpMatchArray) => string | undefined
): ExtractedImport[] {
  const found: ExtractedImport[] = [];
  for (const match of source.matchAll(pattern)) {
    const specifier = pick(match)?.trim();
    if (specifier) found.push({ specifier, kind, line: lineAt(match.index ?? 0) });
  }
  return found;
}

const goExtractor: Extractor = (source, lineAt) => {
  const found: ExtractedImport[] = [];
  for (const group of source.matchAll(/^[ \t]*import[ \t]*\(([\s\S]*?)\)/gm)) {
    const body = group[1];
    const bodyOffset = (group.index ?? 0) + group[0].indexOf(body);
    for (const quoted of body.matchAll(/"([^"\n]+)"/g)) {
      found.push({ specifier: quoted[1], kind: "import", line: lineAt(bodyOffset + (quoted.index ?? 0)) });
    }
  }
  found.push(...collect(source, lineAt, /^[ \t]*import[ \t]+(?:[\w.]+[ \t]+|_[ \t]+)?"([^"\n]+)"/gm, "import", (m) => m[1]));
  return found;
};

const rustExtractor: Extractor = (source, lineAt) => [
  ...collect(source, lineAt, /^[ \t]*(?:pub(?:\([^)]*\))?[ \t]+)?use[ \t]+([^;]+);/gm, "import", (match) => {
    const path = match[1].replace(/\s+as\s+\w+$/, "").trim();
    const braced = path.indexOf("{");
    return (braced === -1 ? path : path.slice(0, braced)).replace(/::$/, "").trim();
  }),
  // `mod name;` declares a child module, which lives beside or below this file.
  ...collect(source, lineAt, /^[ \t]*(?:pub(?:\([^)]*\))?[ \t]+)?mod[ \t]+([A-Za-z_]\w*)[ \t]*;/gm, "import", (m) => `./${m[1]}`)
];

const jvmExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*import[ \t]+(?:static[ \t]+)?([\w.$]+(?:\.\*)?|[\w.$]+(?=\{))/gm, "import", (match) =>
    match[1].replace(/\.[_*]$/, "").replace(/\.$/, ""));

const csharpExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*(?:global[ \t]+)?using[ \t]+(?:static[ \t]+)?(?:[\w.]+[ \t]*=[ \t]*)?([\w.]+)[ \t]*;/gm, "import", (m) => m[1]);

const cExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*#[ \t]*(?:include|import)[ \t]*[<"]([^>"\n]+)[>"]/gm, "require", (m) => m[1]);

const rubyExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*(?:require_relative|require|load)[ \t]*\(?[ \t]*["']([^"'\n]+)["']/gm, "require", (m) => m[1]);

const phpExtractor: Extractor = (source, lineAt) => [
  ...collect(source, lineAt, /^[ \t]*use[ \t]+([\w\\]+)/gm, "import", (m) => m[1]),
  ...collect(source, lineAt, /(?:require_once|include_once|require|include)[ \t]*\(?[ \t]*["']([^"'\n]+)["']/g, "require", (m) => m[1])
];

const elixirExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*(?:alias|import|use|require)[ \t]+([A-Z][\w.]*)/gm, "import", (m) => m[1]);

const swiftExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*import[ \t]+(?:struct[ \t]+|class[ \t]+|func[ \t]+|protocol[ \t]+)?([\w.]+)/gm, "import", (m) => m[1]);

const dartExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*(?:import|export|part)[ \t]+["']([^"'\n]+)["']/gm, "import", (m) => m[1]);

const luaExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /\brequire[ \t]*\(?[ \t]*["']([^"'\n]+)["']/g, "require", (m) => m[1]);

const perlExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*(?:use|require)[ \t]+([A-Za-z][\w:]*)/gm, "import", (m) => m[1]);

const shellExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /^[ \t]*(?:source|\.)[ \t]+["']?([^\s"';|&]+)/gm, "require", (m) => m[1]);

const pythonExtractor: Extractor = (source, lineAt) => [
  ...collect(source, lineAt, /^[ \t]*from[ \t]+([\w.]+)[ \t]+import/gm, "from", (m) => m[1]),
  ...collect(source, lineAt, /^[ \t]*import[ \t]+([\w.]+)/gm, "import", (m) => m[1])
];

/** Imports written in a single-file component's script block. */
const scriptBlockExtractor: Extractor = (source, lineAt) =>
  collect(source, lineAt, /\bimport\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)/g, "import", (m) => m[1] ?? m[2]);

const javascriptExtractor: Extractor = (source, lineAt) => {
  try {
    return parseJavaScriptImports(source);
  } catch {
    return scriptBlockExtractor(source, lineAt);
  }
};

type LanguageSupport = { extract: Extractor; comments?: CommentStyle };

const SUPPORT: Record<string, LanguageSupport> = {
  javascript: { extract: javascriptExtractor },
  typescript: { extract: javascriptExtractor },
  vue: { extract: scriptBlockExtractor, comments: C_COMMENTS },
  svelte: { extract: scriptBlockExtractor, comments: C_COMMENTS },
  astro: { extract: scriptBlockExtractor, comments: C_COMMENTS },
  python: { extract: pythonExtractor, comments: HASH_COMMENTS },
  go: { extract: goExtractor, comments: C_COMMENTS },
  rust: { extract: rustExtractor, comments: C_COMMENTS },
  java: { extract: jvmExtractor, comments: C_COMMENTS },
  kotlin: { extract: jvmExtractor, comments: C_COMMENTS },
  scala: { extract: jvmExtractor, comments: C_COMMENTS },
  groovy: { extract: jvmExtractor, comments: C_COMMENTS },
  csharp: { extract: csharpExtractor, comments: C_COMMENTS },
  c: { extract: cExtractor, comments: C_COMMENTS },
  cpp: { extract: cExtractor, comments: C_COMMENTS },
  "objective-c": { extract: cExtractor, comments: C_COMMENTS },
  "objective-cpp": { extract: cExtractor, comments: C_COMMENTS },
  ruby: { extract: rubyExtractor, comments: HASH_COMMENTS },
  php: { extract: phpExtractor, comments: PHP_COMMENTS },
  elixir: { extract: elixirExtractor, comments: HASH_COMMENTS },
  swift: { extract: swiftExtractor, comments: C_COMMENTS },
  dart: { extract: dartExtractor, comments: C_COMMENTS },
  lua: { extract: luaExtractor, comments: LUA_COMMENTS },
  perl: { extract: perlExtractor, comments: HASH_COMMENTS },
  shell: { extract: shellExtractor, comments: HASH_COMMENTS },
  fish: { extract: shellExtractor, comments: HASH_COMMENTS }
};

/**
 * Whether imports can be read for a language at all.
 *
 * A language without an extractor contributes no dependency edges, so the
 * report can tell a reader that part of the graph is missing rather than
 * presenting an empty graph as a finding.
 */
export function hasImportSupport(language: Language): boolean {
  return language in SUPPORT;
}

export const IMPORT_SUPPORTED_LANGUAGES = Object.keys(SUPPORT).sort();

/** Read the modules a source file imports, in the order they are written. */
export function extractImports(language: Language, source: string): ExtractedImport[] {
  const support = SUPPORT[language];
  if (!support) return [];
  const scanned = support.comments ? blankComments(source, support.comments) : source;
  const found = support.extract(scanned, createLineLookup(scanned));
  return found
    .filter((item) => item.specifier.length > 0)
    .sort((a, b) => a.line - b.line);
}
