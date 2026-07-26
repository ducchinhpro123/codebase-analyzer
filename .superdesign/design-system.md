# Tracepath design system

## Product context

Tracepath turns a public GitHub repository into an evidence-backed architecture report. Its primary jobs are:

1. Accept a repository URL and make the analysis feel credible before submission.
2. Communicate progress through clone, index, map, and explain stages.
3. Let a developer understand a codebase at three levels: system overview, dependency map, and individual module evidence.
4. Surface risk without pretending that machine-generated summaries are unquestionable.

The audience is technical: staff engineers, consultants, maintainers, and developers entering an unfamiliar repository.

## Visual direction: survey document

The product's argument is calibrated confidence. It shows where every claim came from and marks the ones it cannot prove. The interface makes the same argument structurally, so the design is a document you would trust rather than a dashboard.

The ground is drafting film: a cool grey-green, never cream and never near-black. Reading surfaces are pale sheets laid on that film, separated by hairline rules and tonal shift rather than shadow. The page does not float.

**One ink, two renderings.** Observed is solid and filled. Inferred is the same ink, dashed and hollow, because an inference is not a different kind of thing — it is the same claim with less support. This pair is the system's core primitive and applies to marks, badges, rules, and graph edges alike.

Avoid: gradient blobs, glassmorphism, oversized rounded cards, fabricated telemetry or invented metrics, decorative numbering on content that is not a sequence, and any accent colour used as brand decoration rather than meaning.

## Signature: the apparatus

The landing page states its claims the way the report does — a two-column apparatus with the source on the left and the claim on the right, divided by a continuous spine. Each claim points at the file and line range in this repository that supports it, and the last claim admits it has no anchor and is marked inferred.

Hovering a row marks its citation with the highlighter, in both directions. This is the one place boldness is spent; everything around it stays quiet.

Citations must be real. A claim whose anchor cannot be verified is either removed or moved to the inferred register.

## Colour

### Light (default)

- `--film`: `#d3dbd4` — page ground
- `--film-deep`: `#c7d0c8` — recessed bands
- `--sheet`: `#f1f3ef` — panels and reading surfaces
- `--sheet-raised`: `#f8faf7` — inputs, graph canvas
- `--ink`: `#15201e` · `--ink-soft`: `#47534f` · `--ink-faint`: `#57625e`
- `--rule`: `#c2cbc4` · `--rule-strong`: `#a3aea6`
- `--observed`: `#14505c` — the one ink; links, actions, evidence, selection
- `--observed-lift`: `#1c6c7c` · `--observed-wash`: `#dbe7e9`
- `--risk`: `#8c2f39` — semantic only, never brand decoration
- `--mark`: `#f5e27a` — highlighter, hover only, never a resting state

Dark mode is the same document on dark stock: token overrides only, no structural change.

Graph edge colours are a muted family derived from the ink (`--graph-edge-0…7`). The compact preview graph uses a single ink; multiple hues are noise below full size.

## Typography

Three voices, each doing one job.

- **Archivo** (`--font-display`), variable width axis. Instrument voice. Display at `wdth` 116–120; controls, tabs, and panel headings at `wdth` 100–108.
- **Spectral** (`--font-read`), serif. Human voice — body prose, claims, module explanations, report narrative. The product turns machine analysis into readable prose, and the type says so.
- **IBM Plex Mono** (`--font-data`). Apparatus voice — paths, line ranges, metrics, eyebrows, legends.

Scale: hero `clamp(40px, 4.7vw, 70px)`; report title `clamp(30px, 3.9vw, 54px)`; thesis `clamp(20px, 2.05vw, 29px)` in Spectral at weight 400; section headings 16–17px; body 14–16px; mono eyebrows 10–10.5px at `.13em` uppercase.

Do not add a fourth family.

## Layout

- Shell max width 1560px, gutters `clamp(20px, 3.4vw, 48px)`.
- Landing: asymmetric two-column hero — argument left, live artifact right. The apparatus spine sits at `--cite-w` (156px desktop, stacked below 620px).
- Report: slim sticky bar, repository identity band, tabs, then the workspace. Module map is rail / canvas / inspector.
- Corners are restrained: 2px for marks, badges, and chips; 3px for controls and panels.
- Prefer borders and tonal shifts over shadows. Use 1px rules to align sections.

## Components

- Primary action: `--observed` fill, sheet text, 3px radius.
- Secondary: sheet fill with a `--rule-strong` border; hover shifts border and text to `--observed`.
- Repository input: an instrument control with the GitHub mark, monospaced URL, and attached action — not a rounded search pill.
- Evidence blocks: 2px `--observed` left rule, mono path, prose reason.
- Risk: `--risk` border and wash with an explicit label, never colour alone.
- Cards are rare. Prefer framed regions, rows, rails, and divided workspaces.

## Motion

- 160ms for hover, selection, and panel transitions.
- One orchestrated moment: apparatus rows arrive in reading order, 60ms apart — the order a reader checks a citation.
- No continuous ambient motion outside an active analysis.
- `prefers-reduced-motion: reduce` collapses all animation and transition.

## Writing

- Never display a metric the product did not measure. No invented version strings, runtimes, or line counts.
- Never claim a capability the code does not implement.
- Name things by what a person recognises, not how the system is built.
- Number a list only when order carries information the reader needs. The user journey is a sequence; two parallel questions are not.
- State limits plainly: graph coverage, unlisted share links, which prose came from a model.

## Accessibility

- Minimum 4.5:1 contrast for body text and controls. `--ink-faint` is the lightest text permitted on `--film`.
- Focus rings: 2px `--observed` outline at 2px offset.
- Provenance is never conveyed by colour alone — the observed and inferred marks differ in fill and border style, and carry text labels in the legend.
- Interactive graph nodes retain keyboard focus and labels.
- Controls are at least 36px tall; dense report rows may be smaller when clearly separated.
