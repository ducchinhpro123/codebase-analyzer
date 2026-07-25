# Tracepath design system

## Product context

Tracepath turns a public GitHub repository into an evidence-backed architecture report. Its primary jobs are:

1. Accept a repository URL and make the analysis feel credible before submission.
2. Communicate progress through clone, index, map, and explain stages.
3. Let a developer understand a codebase at three levels: system overview, dependency map, and individual module evidence.
4. Surface risk without pretending that machine-generated summaries are unquestionable.

The audience is technical: staff engineers, consultants, maintainers, and developers entering an unfamiliar repository. The interface should feel like a serious analysis instrument, not a generic SaaS landing page.

## Visual direction: technical field instrument

Use a precise, editorial developer-tool aesthetic: dark graphite workspace, paper-white reading surfaces, thin structural rules, compact monospace metadata, and a single high-visibility signal color. The product should evoke a well-made oscilloscope, source browser, and printed engineering field guide.

Avoid glossy gradient blobs, glassmorphism, oversized rounded cards, purple/blue startup gradients, decorative 3D art, fake terminal chrome, and generic dashboard card grids.

## Color

### Core

- `canvas`: `#0B0D0E`
- `canvas-raised`: `#111416`
- `panel`: `#171B1E`
- `panel-hover`: `#1D2226`
- `paper`: `#F1F0EA`
- `paper-muted`: `#E4E2D9`
- `ink-on-paper`: `#111315`
- `text-primary`: `#F2F1EC`
- `text-secondary`: `#A4ADB2`
- `text-faint`: `#6F797F`
- `rule`: `#2B3236`
- `rule-strong`: `#465157`

### Signal

- `signal`: `#C7FF3D` — primary action, selected nodes, progress, and important counts
- `signal-hover`: `#D7FF72`
- `signal-ink`: `#10120C`
- `warning`: `#FF6B4A`
- `info`: `#65B8FF`
- `success`: `#63D69B`

Graph relationships may use `#65B8FF`, `#63D69B`, `#C6A7FF`, `#FF9B66`, and `#E7D56B`, always against graphite and never as decorative gradients.

## Typography

- Interface and display: Geist Sans only.
- Code, repository paths, metrics, labels, and eyebrow text: Geist Mono only.
- Hero display: 72–104px desktop, weight 560, line-height 0.92, letter-spacing `-0.07em`.
- Page title: 42–64px, weight 560, line-height 1.
- Section title: 22–32px, weight 580.
- Body: 15–18px, line-height 1.55.
- UI text: 12–14px.
- Metadata: 10–12px Geist Mono, uppercase only for short system labels.

Do not introduce serif, handwriting, display, or additional web fonts.

## Layout

- Desktop canvas max width: 1520px with 28–40px outer gutters.
- Use hard-working split layouts, not centered stacks.
- Landing page: asymmetric 12-column composition. The value proposition and repository input own the left 5 columns; a live analysis artifact owns the right 7 columns and may bleed toward the viewport edge.
- Report: persistent slim command bar, a compact repository identity band, then an analysis workspace. Use a rail / primary canvas / evidence inspector hierarchy.
- Prefer borders and tonal shifts over floating shadows.
- Use 1px structural rules to align sections across the page.
- Dense areas may use 6px, 8px, 12px, and 16px spacing; narrative areas use 24px, 32px, 48px, 64px, and 96px.

## Components

- Corners are restrained: 2px for labels and graph nodes, 4px for controls, 6px maximum for major panels.
- Primary action: signal fill, dark ink, 44–52px tall, square-ish 4px radius, strong 650 label.
- Secondary action: transparent or panel fill, 1px rule border, primary text.
- Repository input: integrated command surface with GitHub icon, monospaced URL, and attached action. It should feel like an instrument control, not a rounded search pill.
- Cards are rare. Prefer framed regions, rows, tables, rails, and clearly divided workspaces.
- Selected states use signal color plus a visible border; never rely on a faint background alone.
- Risk uses warm warning color and an explicit label.
- Graph nodes use concise path labels, cluster/score metadata, and thin routed connectors.

## Motion

- 140–220ms for hover, selection, and panel transitions.
- Analysis progress may use a traveling scan line, stepped counters, and subtle node activation.
- Graph hover may strengthen connected edges and lift the active node by 1–2px.
- No continuous ambient motion outside an active analysis.
- Respect reduced motion; all state changes remain understandable without animation.

## Landing requirements

- Keep the Tracepath name and braces mark recognizable.
- Keep the exact product promise: “Map the code. Find the risk.”
- Keep a repository URL field and a dominant Analyze action above the fold.
- Keep a path to the sample report.
- Show a believable interactive architecture artifact, not an abstract illustration.
- Make supported languages/limits available without competing with the main action.
- Maintain clear mobile stacking and a usable repository input at 360px.

## Report requirements

- Preserve both “Big picture” and “Module map” views.
- Keep repository identity, branch, commit, modules, edges, and line totals prominent.
- Preserve module filtering, architecture graph, hotspot ranking, evidence inspector, diagram exports, share, and new-analysis actions.
- Keep evidence and confidence visible so generated explanations remain auditable.

## Accessibility

- Minimum 4.5:1 contrast for body text and controls.
- Signal green is never used as small text on paper-white.
- Focus rings use a 2px signal outline with 2px offset.
- Interactive graph nodes retain keyboard focus and labels.
- Target size is at least 40px for controls; dense report rows may be 36px when clearly separated.
