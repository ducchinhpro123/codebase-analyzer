# 6. Per-language import extraction

Date: 2026-07-26

## Status

Accepted

## Context

The dependency graph was built from two extractors: a Babel parse for
JavaScript and TypeScript, and a regular expression for Python. Every other
language fell through to the Babel branch, where it failed to parse, and then
to a fallback regular expression that only matched quoted JavaScript
specifiers.

The result was that `import ("fmt")`, `import java.util.List;`, and
`use crate::store::Loader;` produced no imports at all. A Go, Java, or Rust
repository was indexed, scored, and explained, but every module reported a fan
in and fan out of zero. Hotspot ranking lost its coupling term, the module graph
rendered as disconnected nodes, and the internal edges passed to the Big
Picture, concept map, and system-design prompts were an empty list. The report
presented this as an architecture finding rather than as a limit of the
analysis.

## Decision

Imports are extracted per language by matchers that are aware of that
language's comment and string syntax, and resolved per language to repository
files.

Full syntax trees were considered and rejected. Import statements are lexically
simple in every language we support, so a grammar buys accuracy only on macro
generated and other unusual forms. The genuinely difficult half of the problem
is resolving a specifier to a file — Go module paths, JVM package roots, Rust
module trees, PSR-4 namespaces — which a grammar does not help with. A grammar
per language would add a WASM asset per language, bundler configuration, and
image size for that narrow gain.

Resolution is conservative. A specifier that names something outside the
repository is recorded as an `unresolved` edge rather than guessed at, and a
language with no extractor produces no edges rather than approximate ones.

Because coverage is now uneven by design, the report measures it: the share of
files whose imports could be read, and the languages that contributed none. The
architecture map states this whenever some of the repository could not
contribute, so a thin graph is legible as a limit of the analysis.

## Consequences

A Go, Java, Rust, C, Ruby, PHP, Elixir, or shell repository now produces a
connected graph, and its coupling metrics and system-design context carry real
signal.

Imports written by macros or code generation are still missed, and languages
outside the supported set still contribute no edges. Both are now visible in
the report instead of silent.

A Go package import resolves to every non-test file in that package directory,
so one import can produce several edges. This is what a package import means,
but it makes Go fan-in numbers larger than a language where one import names
one file.

Adding a language means adding an extractor and a resolver, and both are
covered by tests that state the syntax they accept.
