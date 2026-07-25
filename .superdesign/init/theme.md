# Theme

## Compact token summary

- Framework: custom global CSS imported by the Next.js root layout.
- Fonts: Geist Sans for interface and display text; Geist Mono for repository paths, metrics, tags, and graph labels.
- Light palette: page `#f3f5f7`, surfaces `#fafbfc` / `#fdfdfd`, ink `#171a1c`, muted `#5d656c`, borders `#d5dae0` / `#b8c0c8`, accent rust `#c43f2a`, accent soft `#f9e8e3`.
- Dark palette: page `#111315`, raised surface `#1b1f22`, ink `#eef0f2`, muted `#a8b0b7`, borders `#30363b` / `#495158`, accent coral `#ff765b`.
- Graph edges: eight restrained categorical hues stored in `--graph-edge-0` through `--graph-edge-7`.
- Radius: global card radius `12px`; controls commonly use `8–9px`.
- Shadow: large soft panel shadow `0 24px 70px rgba(38,47,54,.12)`, darker equivalent in dark mode.
- Layout: max widths 1440–1600px; landing hero is a 2-column composition; report module view is a 224px / fluid / 330px three-column workspace.
- Breakpoints: 1220px (report inspector stacks), 900px (single-column landing/report), 620px (compact mobile controls).
- Motion: 180ms interaction transitions; progress scan/spin/pulse; skeleton pulse; honors reduced motion and reduced transparency.

## Raw `app/globals.css`

```css
:root {
  color-scheme: light dark;
  --page: #f3f5f7;
  --surface: #fafbfc;
  --surface-raised: #fdfdfd;
  --surface-muted: #eaedf0;
  --ink: #171a1c;
  --muted: #5d656c;
  --faint: #7b848c;
  --line: #d5dae0;
  --line-strong: #b8c0c8;
  --accent: #c43f2a;
  --accent-hover: #a93421;
  --accent-foreground: #f8f8f6;
  --accent-soft: #f9e8e3;
  --graph-edge-0: #4b6f91;
  --graph-edge-1: #397b72;
  --graph-edge-2: #79658e;
  --graph-edge-3: #a05d43;
  --graph-edge-4: #5d7d48;
  --graph-edge-5: #946072;
  --graph-edge-6: #3f7887;
  --graph-edge-7: #8c713a;
  --shadow: 0 24px 70px rgba(38, 47, 54, .12);
  --radius: 12px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --page: #111315;
    --surface: #171a1d;
    --surface-raised: #1b1f22;
    --surface-muted: #22272b;
    --ink: #eef0f2;
    --muted: #a8b0b7;
    --faint: #7f8992;
    --line: #30363b;
    --line-strong: #495158;
    --accent: #ff765b;
    --accent-hover: #ff8b73;
    --accent-foreground: #171a1c;
    --accent-soft: #34221f;
    --graph-edge-0: #79a9d2;
    --graph-edge-1: #6eb7a7;
    --graph-edge-2: #ad91d1;
    --graph-edge-3: #df9574;
    --graph-edge-4: #94bd75;
    --graph-edge-5: #d78da5;
    --graph-edge-6: #76b9c8;
    --graph-edge-7: #d1b06c;
    --shadow: 0 28px 80px rgba(4, 6, 7, .38);
  }
}

* { box-sizing: border-box; }
html { background: var(--page); }
body { min-height: 100%; margin: 0; background: var(--page); color: var(--ink); font-family: var(--font-geist-sans), sans-serif; text-rendering: optimizeLegibility; }
button, input { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .58; }
a { color: inherit; text-decoration: none; }
code { font-family: var(--font-geist-mono), monospace; }
::selection { background: var(--accent); color: var(--accent-foreground); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.brand { display: inline-flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 650; letter-spacing: -.03em; }
.brand-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 8px; background: var(--accent); color: var(--accent-foreground); }
.primary-action, .quiet-action, .sample-link { display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; border-radius: 9px; font-size: 13px; font-weight: 600; transition: background-color .18s ease, color .18s ease, border-color .18s ease, transform .18s ease; }
.primary-action { min-height: 38px; padding: 0 14px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-foreground); }
.primary-action:hover { border-color: var(--accent-hover); background: var(--accent-hover); }
.quiet-action { min-height: 38px; padding: 0 13px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.quiet-action:hover, .sample-link:hover { border-color: var(--line-strong); background: var(--surface-muted); }
.primary-action:active, .quiet-action:active, .sample-link:active, .repository-field button:active { transform: translateY(1px) scale(.99); }

/* Landing */
.landing-page { min-height: 100dvh; overflow: hidden; background: var(--page); }
.site-header, .site-footer { width: min(1440px, calc(100% - 64px)); margin: 0 auto; }
.site-header { display: flex; height: 72px; align-items: center; justify-content: space-between; }
.sample-link { min-height: 38px; padding: 0 12px; border: 1px solid transparent; color: var(--muted); }
.landing-hero { display: grid; width: min(1440px, calc(100% - 64px)); min-height: calc(100dvh - 182px); margin: 0 auto; padding: 52px 0 64px; grid-template-columns: minmax(420px, .86fr) minmax(500px, 1.14fr); gap: clamp(48px, 7vw, 112px); align-items: center; }
.hero-content { max-width: 650px; }
.hero-kicker { margin: 0 0 22px; color: var(--accent); font: 600 12px/1 var(--font-geist-mono), monospace; letter-spacing: .08em; text-transform: uppercase; }
.hero-content h1 { max-width: 650px; margin: 0; font-size: clamp(52px, 6vw, 84px); font-weight: 590; line-height: .98; letter-spacing: -.07em; }
.hero-summary { max-width: 520px; margin: 28px 0 0; color: var(--muted); font-size: clamp(17px, 1.5vw, 20px); line-height: 1.5; letter-spacing: -.015em; }
.repository-form { max-width: 640px; margin-top: 40px; }
.repository-form > label { display: block; margin-bottom: 9px; color: var(--ink); font-size: 13px; font-weight: 600; }
.repository-field { display: grid; min-height: 62px; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 11px; padding: 6px 6px 6px 17px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface-raised); box-shadow: 0 8px 30px rgba(38, 47, 54, .06); }
.repository-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.repository-field > svg { color: var(--faint); }
.repository-field input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-family: var(--font-geist-mono), monospace; font-size: 13px; }
.repository-field input::placeholder { color: var(--faint); opacity: 1; }
.repository-field button { display: inline-flex; min-height: 48px; align-items: center; gap: 9px; padding: 0 18px; border: 1px solid var(--accent); border-radius: 9px; background: var(--accent); color: var(--accent-foreground); font-weight: 650; white-space: nowrap; transition: background-color .18s ease, border-color .18s ease, transform .18s ease; }
.repository-field button:hover:not(:disabled) { border-color: var(--accent-hover); background: var(--accent-hover); }
.form-helper { margin: 9px 0 0; color: var(--faint); font-size: 12px; }
.form-error { display: flex; align-items: flex-start; gap: 7px; margin: 10px 0 0; color: var(--accent); font-size: 13px; line-height: 1.4; }
.form-error svg { flex: 0 0 auto; margin-top: 1px; }
.hero-product { min-width: 0; }
.product-preview, .analysis-progress { overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-raised); box-shadow: var(--shadow); }
.preview-header { display: flex; min-height: 52px; align-items: center; justify-content: space-between; padding: 0 17px; border-bottom: 1px solid var(--line); color: var(--muted); font: 12px/1 var(--font-geist-mono), monospace; }
.preview-header > div { display: flex; align-items: center; gap: 8px; color: var(--ink); font-weight: 550; }
.preview-commit { color: var(--faint); }
.preview-selection { display: grid; min-height: 88px; grid-template-columns: minmax(0, .8fr) minmax(180px, 1.2fr); gap: 24px; align-items: center; padding: 17px; border-top: 1px solid var(--line); }
.preview-selection > div { display: flex; min-width: 0; align-items: center; gap: 8px; color: var(--accent); }
.preview-selection code { overflow: hidden; color: var(--ink); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.preview-selection strong { color: var(--muted); font-size: 12px; font-weight: 480; line-height: 1.45; }

.analysis-progress { position: relative; padding: 28px; }
.analysis-progress::before { position: absolute; top: 0; left: 0; width: 32%; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); content: ""; opacity: .9; transform: translateX(-110%); }
.progress-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.progress-title span { color: var(--accent); font: 600 11px/1 var(--font-geist-mono), monospace; letter-spacing: .06em; text-transform: uppercase; }
.progress-state { display: inline-flex; align-items: center; gap: 7px; }
.progress-state svg { flex: 0 0 auto; }
.progress-title h2 { max-width: 420px; margin: 12px 0 0; font-size: clamp(23px, 3vw, 34px); font-weight: 560; line-height: 1.08; letter-spacing: -.045em; }
.progress-note { max-width: 430px; margin: 12px 0 0; color: var(--faint); font-size: 11px; line-height: 1.45; }
.progress-title > strong { color: var(--accent); font: 500 clamp(36px, 6vw, 58px)/.9 var(--font-geist-mono), monospace; letter-spacing: -.08em; transform-origin: right top; }
.analysis-progress ol { display: grid; margin: 46px 0 0; padding: 0; grid-template-columns: repeat(4, 1fr); list-style: none; }
.analysis-progress li { display: flex; min-width: 0; gap: 10px; padding: 14px 12px; border-top: 1px solid var(--line); color: var(--faint); }
.analysis-progress li > span { display: grid; width: 22px; height: 22px; flex: 0 0 auto; place-items: center; border: 1px solid var(--line); border-radius: 7px; font: 600 10px var(--font-geist-mono), monospace; }
.analysis-progress li.is-active { border-color: var(--accent); color: var(--ink); }
.analysis-progress li.is-active > span, .analysis-progress li svg { border-color: var(--accent); color: var(--accent); }
.analysis-progress li.is-active > span { position: relative; }
.analysis-progress li.is-active > span::after { position: absolute; inset: -5px; border: 1px solid var(--accent); border-radius: 10px; content: ""; opacity: 0; }
.analysis-progress li div { min-width: 0; }
.analysis-progress li strong, .analysis-progress li small { display: block; }
.analysis-progress li strong { color: inherit; font-size: 12px; }
.analysis-progress li small { margin-top: 4px; color: var(--faint); font-size: 10px; }
.progress-error { display: flex; gap: 8px; margin-top: 22px; padding: 12px; border-radius: 9px; background: var(--accent-soft); color: var(--accent); font-size: 12px; }

.capability-band { display: grid; width: min(1440px, calc(100% - 64px)); margin: 0 auto; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.capability-band article { display: flex; min-height: 124px; gap: 16px; align-items: flex-start; padding: 28px 34px; }
.capability-band article + article { border-left: 1px solid var(--line); }
.capability-band svg { flex: 0 0 auto; color: var(--accent); }
.capability-band h2 { margin: 0; font-size: 14px; font-weight: 620; letter-spacing: -.02em; }
.capability-band p { max-width: 250px; margin: 7px 0 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
.site-footer { display: flex; min-height: 92px; align-items: center; justify-content: space-between; color: var(--faint); font-size: 12px; }
.site-footer span:first-child { color: var(--ink); font-weight: 620; }

/* Shared dependency graph */
.graph-canvas { position: relative; overflow: auto; max-height: 680px; background: var(--surface); scrollbar-color: var(--line-strong) transparent; }
.graph-toolbar { display: flex; min-height: 42px; align-items: center; justify-content: space-between; gap: 16px; padding: 0 14px; border-bottom: 1px solid var(--line); color: var(--faint); font: 10px var(--font-geist-mono), monospace; }
.graph-toolbar .quiet-action { min-height: 30px; padding: 0 9px; font-size: 10px; }
.graph-toolbar .quiet-action > svg { width: 15px; height: 15px; min-width: 15px; flex: 0 0 15px; }
.graph-canvas > svg { display: block; width: 100%; min-width: 760px; height: auto; touch-action: none; }
.graph-canvas-compact { max-height: 430px; }
.graph-canvas-compact > svg { min-width: 458px; }
.graph-edge { fill: none; stroke: currentColor; stroke-width: 1.35; opacity: .76; vector-effect: non-scaling-stroke; transition: opacity .16s ease, stroke-width .16s ease; }
.graph-edge:hover { stroke-width: 2; opacity: 1; }
.graph-edge-color-0 { color: var(--graph-edge-0); }
.graph-edge-color-1 { color: var(--graph-edge-1); }
.graph-edge-color-2 { color: var(--graph-edge-2); }
.graph-edge-color-3 { color: var(--graph-edge-3); }
.graph-edge-color-4 { color: var(--graph-edge-4); }
.graph-edge-color-5 { color: var(--graph-edge-5); }
.graph-edge-color-6 { color: var(--graph-edge-6); }
.graph-edge-color-7 { color: var(--graph-edge-7); }
.graph-node { cursor: grab; outline: none; user-select: none; }
.graph-node.is-dragging { cursor: grabbing; }
.graph-node rect { fill: var(--surface-raised); stroke: var(--line-strong); stroke-width: 1; transition: fill .18s ease, stroke .18s ease, transform .18s ease; transform-box: fill-box; transform-origin: center; }
.graph-node:hover rect, .graph-node:focus-visible rect { fill: var(--surface-muted); stroke: var(--ink); transform: translateY(-2px); }
.graph-node.is-dragging rect { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.5; transform: translateY(-2px); }
.graph-node.is-selected rect { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.5; }
.graph-node circle { fill: transparent; }
.graph-node.is-hot circle { fill: var(--accent); }
.graph-node-name { fill: var(--ink); font: 550 11px var(--font-geist-mono), monospace; }
.graph-node-meta { fill: var(--faint); font: 10px var(--font-geist-mono), monospace; }
.graph-limit { position: sticky; right: 12px; bottom: 12px; width: fit-content; margin: -42px 12px 12px auto; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-raised); color: var(--muted); font-size: 11px; box-shadow: 0 8px 24px rgba(38, 47, 54, .08); }
.graph-empty { display: grid; min-height: 360px; place-items: center; align-content: center; gap: 12px; color: var(--faint); }
.graph-empty p { margin: 0; font-size: 13px; }

/* Report */
.report-page { min-height: 100dvh; background: var(--page); }
.report-nav { position: sticky; top: 0; z-index: 10; display: grid; height: 66px; padding: 0 28px; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--page) 92%, transparent); backdrop-filter: blur(14px); }
.report-context { color: var(--faint); font-size: 12px; }
.report-actions { display: flex; gap: 8px; }
.report-overview { display: grid; width: min(1540px, calc(100% - 56px)); margin: 0 auto; padding: 48px 0 38px; grid-template-columns: minmax(0, 1fr) auto; gap: 48px; align-items: end; }
.report-overview h1 { margin: 0; font-size: clamp(36px, 4.5vw, 64px); font-weight: 590; line-height: 1; letter-spacing: -.065em; overflow-wrap: anywhere; }
.repository-meta { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 18px; color: var(--muted); font: 12px var(--font-geist-mono), monospace; }
.repository-meta span { display: inline-flex; align-items: center; gap: 6px; }
.repository-meta span:first-child svg { color: var(--accent); }
.report-overview dl { display: grid; margin: 0; grid-template-columns: repeat(3, minmax(80px, 1fr)); }
.report-overview dl div { min-width: 100px; padding-left: 26px; border-left: 1px solid var(--line); }
.report-overview dt { color: var(--faint); font-size: 11px; }
.report-overview dd { margin: 7px 0 0; font: 520 28px/1 var(--font-geist-mono), monospace; letter-spacing: -.06em; }
.report-tabs { display: flex; width: min(1540px, calc(100% - 56px)); margin: -5px auto 16px; gap: 4px; border-bottom: 1px solid var(--line); }
.report-tabs button { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; padding: 0 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; }
.report-tabs button:hover { color: var(--ink); }
.report-tabs button.is-active { border-bottom-color: var(--accent); color: var(--ink); }
.report-tabs button.is-active svg { color: var(--accent); }
.project-overview-workspace { width: min(1540px, calc(100% - 56px)); margin: 0 auto; padding-bottom: 48px; }
.project-overview-panel { overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-raised); }
.big-picture-intro { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .55fr); }
.project-thesis { padding: clamp(28px, 4vw, 58px); }
.project-thesis > span, .system-flow-heading > div > span { color: var(--accent); font: 600 11px/1 var(--font-geist-mono), monospace; letter-spacing: .07em; text-transform: uppercase; }
.project-thesis h2 { max-width: 980px; margin: 20px 0 0; font-size: clamp(28px, 3vw, 44px); font-weight: 540; line-height: 1.14; letter-spacing: -.045em; }
.project-thesis > p { margin: 28px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.project-thesis > p strong { color: var(--ink); }
.project-capabilities { padding: clamp(28px, 3vw, 44px); border-left: 1px solid var(--line); background: var(--surface); }
.project-capabilities h3, .overview-grounding h3 { margin: 0; font-size: 12px; font-weight: 650; }
.project-capabilities ul { display: grid; gap: 0; margin: 18px 0 0; padding: 0; list-style: none; counter-reset: capability; }
.project-capabilities li { position: relative; min-height: 54px; padding: 13px 0 13px 35px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.45; counter-increment: capability; }
.project-capabilities li::before { position: absolute; top: 15px; left: 0; color: var(--accent); content: counter(capability, decimal-leading-zero); font: 600 10px var(--font-geist-mono), monospace; }
.diagram-section { padding: clamp(28px, 3.5vw, 48px); border-top: 1px solid var(--line); }
.diagram-exports { display: flex; flex-wrap: wrap; gap: 6px; }
.diagram-exports .quiet-action { min-height: 34px; padding: 0 10px; font-size: 11px; }
.diagram-wrap { margin-top: 28px; }
.diagram-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; color: var(--faint); font: 10px var(--font-geist-mono), monospace; }
.diagram-legend span { display: inline-flex; align-items: center; gap: 5px; }
.diagram-legend i { display: inline-block; width: 8px; height: 8px; border: 1px solid var(--line-strong); border-radius: 3px; background: var(--surface-muted); }
.diagram-legend .diagram-kind-actor { border-color: var(--accent); background: var(--accent-soft); }
.diagram-legend .diagram-kind-transform { border-color: #aa604b; background: #f5ede8; }
.diagram-legend .diagram-kind-store { border-color: #4d6772; background: #e9eef0; }
.diagram-legend .diagram-kind-artifact { border-color: #87745e; background: #f4f0e9; }
.diagram-legend .diagram-provenance-inferred { border-style: dashed; background: transparent; }
.diagram-canvas { overflow: auto; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); scrollbar-color: var(--line-strong) transparent; }
.diagram-canvas svg { display: block; width: 100%; min-width: 760px; height: auto; }
.diagram-relationship { color: var(--line-strong); }
.diagram-relationship path { fill: none; stroke: currentColor; stroke-width: 1.5; }
.diagram-relationship text { fill: var(--muted); font: 10px var(--font-geist-mono), monospace; paint-order: stroke; stroke: var(--surface); stroke-width: 5px; stroke-linejoin: round; }
.diagram-edge-label { pointer-events: none; }
.diagram-relationship.is-inferred { color: var(--faint); }
.diagram-relationship.is-inferred path { stroke-dasharray: 5 4; }
.diagram-node { outline: none; }
.diagram-node[role="button"] { cursor: pointer; }
.diagram-node rect { fill: var(--surface-raised); stroke: var(--line-strong); stroke-width: 1.5; transition: fill .18s ease, stroke .18s ease, transform .18s ease; transform-box: fill-box; transform-origin: center; }
.diagram-node[role="button"]:hover rect, .diagram-node[role="button"]:focus-visible rect { fill: var(--surface-muted); stroke: var(--ink); transform: translateY(-2px); }
.diagram-node.is-actor rect { fill: var(--accent-soft); stroke: var(--accent); }
.diagram-node.is-transform rect { fill: color-mix(in srgb, var(--accent-soft) 44%, var(--surface-raised)); stroke: var(--accent); }
.diagram-node.is-store rect { fill: color-mix(in srgb, var(--surface-muted) 65%, var(--surface-raised)); stroke: var(--line-strong); }
.diagram-node.is-inferred rect { stroke-dasharray: 7 4; }
.diagram-node-kind { fill: var(--accent); font: 700 10px var(--font-geist-mono), monospace; letter-spacing: .04em; text-transform: uppercase; }
.diagram-node-label { fill: var(--ink); font: 600 17px var(--font-geist-sans), sans-serif; }
.diagram-node-description { fill: var(--muted); font: 11px var(--font-geist-sans), sans-serif; }
.diagram-node-meta { fill: var(--faint); font: 9px var(--font-geist-mono), monospace; }
.system-flow-section { padding: clamp(28px, 3.5vw, 48px); border-top: 1px solid var(--line); }
.system-flow-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; }
.system-flow-heading h3 { margin: 11px 0 0; font-size: 23px; font-weight: 590; letter-spacing: -.035em; }
.system-flow-heading p { margin: 7px 0 0; color: var(--muted); font-size: 12px; }
.system-flow-heading > span { color: var(--faint); font: 11px var(--font-geist-mono), monospace; }
.system-flow { display: flex; margin: 32px 0 0; padding: 0 0 10px; gap: 34px; overflow-x: auto; list-style: none; scrollbar-color: var(--line-strong) transparent; }
.system-flow > li { position: relative; min-width: 210px; min-height: 238px; flex: 1 0 210px; padding: 18px; border: 1px solid var(--line-strong); border-radius: 9px; background: var(--surface); }
.system-flow > li:not(:last-child)::after { position: absolute; top: 49px; left: 100%; width: 34px; border-top: 1px solid var(--line-strong); content: ""; }
.system-flow > li:not(:last-child)::before { position: absolute; z-index: 1; top: 45px; left: calc(100% + 26px); width: 7px; height: 7px; border-top: 1px solid var(--line-strong); border-right: 1px solid var(--line-strong); content: ""; transform: rotate(45deg); }
.flow-sequence { color: var(--accent); font: 600 11px var(--font-geist-mono), monospace; }
.system-flow h4 { margin: 25px 0 0; font-size: 16px; font-weight: 620; letter-spacing: -.025em; }
.system-flow li > p { min-height: 52px; margin: 9px 0 18px; color: var(--muted); font-size: 11px; line-height: 1.5; }
.flow-modules { display: flex; flex-wrap: wrap; gap: 5px; }
.flow-modules button, .flow-modules > code { display: block; max-width: 100%; padding: 6px 7px; overflow: hidden; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-raised); color: var(--muted); font: 9px var(--font-geist-mono), monospace; text-overflow: ellipsis; white-space: nowrap; }
.flow-modules button { cursor: pointer; }
.flow-modules button:hover { border-color: var(--accent); color: var(--accent); }
.flow-modules button code { font: inherit; }
.overview-grounding { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: var(--surface); }
.overview-grounding > section { padding: 28px clamp(28px, 3.5vw, 48px); }
.overview-grounding > section + section { border-left: 1px solid var(--line); }
.overview-grounding ul { display: grid; gap: 8px; margin: 14px 0 0; padding-left: 17px; }
.overview-grounding section > p, .overview-grounding li, .overview-evidence-list p { color: var(--muted); font-size: 11px; line-height: 1.5; }
.overview-grounding section > p { margin: 14px 0 0; }
.overview-evidence-list { display: grid; margin-top: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.overview-evidence-list > div { padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-raised); }
.overview-evidence-list code { color: var(--accent); font-size: 9px; overflow-wrap: anywhere; }
.overview-evidence-list p { margin: 6px 0 0; }
.overview-confidence { grid-column: 1 / -1; margin: 0; padding: 12px clamp(28px, 3.5vw, 48px); border-top: 1px solid var(--line); color: var(--faint); font-size: 10px; }
.report-workspace { display: grid; width: min(1600px, calc(100% - 32px)); margin: 0 auto; padding-bottom: 48px; grid-template-columns: 224px minmax(480px, 1fr) 330px; gap: 16px; align-items: start; }
.module-browser, .architecture-panel, .module-inspector, .hotspot-panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-raised); }
.module-browser { position: sticky; top: 82px; padding: 17px; }
.module-search label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; }
.module-search > div { display: flex; min-height: 40px; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); }
.module-search > div:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.module-search svg { flex: 0 0 auto; color: var(--faint); }
.module-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 12px; }
.module-search input::placeholder { color: var(--faint); }
.module-browser nav, .language-summary { margin-top: 25px; }
.module-browser h2, .language-summary h2 { margin: 0 0 8px; color: var(--faint); font-size: 11px; font-weight: 600; }
.module-browser nav button { display: flex; width: 100%; min-height: 36px; align-items: center; justify-content: space-between; padding: 0 9px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); text-align: left; }
.module-browser nav button:hover { background: var(--surface-muted); color: var(--ink); }
.module-browser nav button.is-active { background: var(--accent-soft); color: var(--accent); }
.module-browser nav button strong { font: 500 10px var(--font-geist-mono), monospace; }
.language-summary { display: flex; flex-wrap: wrap; gap: 6px; }
.language-summary h2 { width: 100%; }
.language-summary span, .language-badge { border-radius: 7px; background: var(--surface-muted); color: var(--muted); font: 10px/1 var(--font-geist-mono), monospace; }
.language-summary span { padding: 7px 8px; }
.report-main { display: grid; min-width: 0; gap: 16px; }
.architecture-panel { overflow: hidden; }
.panel-heading { display: flex; min-height: 78px; align-items: center; justify-content: space-between; gap: 24px; padding: 15px 18px; border-bottom: 1px solid var(--line); }
.panel-heading h2, .hotspot-panel h2 { margin: 0; font-size: 16px; font-weight: 630; letter-spacing: -.025em; }
.panel-heading p, .hotspot-panel > div:first-child p { margin: 5px 0 0; color: var(--muted); font-size: 12px; }
.panel-heading > span { flex: 0 0 auto; color: var(--faint); font: 11px var(--font-geist-mono), monospace; }
.hotspot-panel { padding: 18px; }
.hotspot-grid { display: grid; margin-top: 17px; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 8px; overflow-x: auto; }
.hotspot-grid button { display: grid; min-width: 150px; min-height: 124px; align-content: start; padding: 13px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--ink); text-align: left; transition: background-color .18s ease, border-color .18s ease, transform .18s ease; }
.hotspot-grid button:hover { border-color: var(--line-strong); background: var(--surface-muted); transform: translateY(-2px); }
.hotspot-grid button.is-selected { border-color: var(--accent); background: var(--accent-soft); }
.hotspot-grid button > strong { color: var(--accent); font: 520 24px/1 var(--font-geist-mono), monospace; }
.hotspot-grid button > span { overflow: hidden; margin-top: 15px; font: 550 11px var(--font-geist-mono), monospace; text-overflow: ellipsis; white-space: nowrap; }
.hotspot-grid button > small { margin-top: 7px; color: var(--faint); font-size: 10px; line-height: 1.4; }
.module-inspector { position: sticky; top: 82px; overflow: hidden; }
.inspector-title { padding: 17px 18px; border-bottom: 1px solid var(--line); }
.inspector-title code { display: block; margin-top: 10px; color: var(--ink); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.language-badge { display: inline-flex; padding: 6px 7px; color: var(--accent); background: var(--accent-soft); }
.module-inspector > h2 { margin: 0; padding: 19px 18px 5px; font-size: 19px; font-weight: 540; line-height: 1.3; letter-spacing: -.03em; }
.module-metrics { display: grid; margin: 18px; grid-template-columns: repeat(2, 1fr); border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
.module-metrics div { padding: 11px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.module-metrics strong, .module-metrics span { display: block; }
.module-metrics strong { font: 530 19px var(--font-geist-mono), monospace; }
.module-metrics span { margin-top: 4px; color: var(--faint); font-size: 10px; }
.inspector-section { margin: 0 18px; padding: 17px 0; border-top: 1px solid var(--line); }
.inspector-section h3 { margin: 0 0 10px; font-size: 11px; font-weight: 650; }
.inspector-section p, .inspector-section li { color: var(--muted); font-size: 12px; line-height: 1.52; }
.inspector-section p { margin: 0; }
.inspector-section ul { display: grid; gap: 7px; margin: 0; padding-left: 17px; }
.evidence-block { padding: 10px; border-radius: 8px; background: var(--surface); }
.evidence-block + .evidence-block { margin-top: 7px; }
.evidence-block code { color: var(--accent); font-size: 10px; overflow-wrap: anywhere; }
.evidence-block p { margin-top: 6px; font-size: 10px; }
.risk-callout { display: flex; gap: 9px; margin: 2px 18px 18px; padding: 12px; border-radius: 9px; background: var(--accent-soft); color: var(--accent); }
.risk-callout svg { flex: 0 0 auto; }
.risk-callout strong { display: block; font-size: 11px; }
.risk-callout p { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
.confidence-note { margin: 0; padding: 0 18px 18px; color: var(--faint); font-size: 10px; }
.inspector-empty { display: grid; min-height: 240px; place-items: center; align-content: center; gap: 8px; color: var(--faint); }
.report-footer { display: flex; width: min(1540px, calc(100% - 56px)); min-height: 72px; margin: 0 auto; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); color: var(--faint); font-size: 11px; }

.report-loading { width: min(1540px, calc(100% - 56px)); margin: 0 auto; padding: 52px 0; }
.skeleton { border-radius: 9px; background: var(--surface-muted); }
.skeleton-title { width: min(480px, 70%); height: 58px; }
.skeleton-meta { width: min(320px, 48%); height: 18px; margin-top: 18px; }
.skeleton-map { width: 100%; height: 560px; margin-top: 48px; }
.report-error { display: grid; max-width: 540px; min-height: calc(100dvh - 66px); margin: 0 auto; place-items: center; align-content: center; padding: 32px; text-align: center; }
.report-error > svg { color: var(--accent); }
.report-error h1 { margin: 18px 0 0; font-size: 38px; letter-spacing: -.055em; }
.report-error p { max-width: 420px; margin: 12px 0 24px; color: var(--muted); line-height: 1.5; }

@media (max-width: 1220px) {
  .report-workspace { grid-template-columns: 210px minmax(0, 1fr); }
  .module-inspector { position: static; grid-column: 2; }
  .module-inspector > h2 { max-width: 720px; }
}

@media (max-width: 900px) {
  .site-header, .site-footer, .landing-hero, .capability-band { width: min(100% - 40px, 720px); }
  .landing-hero { min-height: auto; padding: 64px 0; grid-template-columns: 1fr; gap: 52px; }
  .hero-content h1 { max-width: 700px; font-size: clamp(50px, 10vw, 78px); }
  .hero-product { width: 100%; }
  .report-tabs, .project-overview-workspace { width: calc(100% - 32px); }
  .big-picture-intro { grid-template-columns: 1fr; }
  .project-capabilities { border-top: 1px solid var(--line); border-left: 0; }
  .diagram-section { padding: 28px 20px; }
  .diagram-exports { margin-top: 18px; }
  .overview-grounding { grid-template-columns: 1fr; }
  .overview-grounding > section + section { border-top: 1px solid var(--line); border-left: 0; }
  .overview-confidence { grid-column: auto; }
  .capability-band { grid-template-columns: 1fr; }
  .capability-band article { min-height: 96px; padding: 22px 4px; }
  .capability-band article + article { border-top: 1px solid var(--line); border-left: 0; }
  .report-overview { width: calc(100% - 40px); grid-template-columns: 1fr; align-items: start; }
  .report-overview dl { width: 100%; }
  .report-overview dl div:first-child { padding-left: 0; border-left: 0; }
  .report-workspace { width: calc(100% - 24px); grid-template-columns: 1fr; }
  .module-browser { position: static; }
  .module-browser nav { display: flex; flex-wrap: wrap; gap: 6px; }
  .module-browser nav h2 { width: 100%; }
  .module-browser nav button { width: auto; gap: 16px; padding: 0 12px; border: 1px solid var(--line); }
  .module-inspector { grid-column: auto; }
}

@media (max-width: 620px) {
  .site-header { height: 64px; }
  .sample-link { padding: 0 5px; }
  .landing-hero { padding: 48px 0 56px; }
  .hero-content h1 { font-size: clamp(45px, 13vw, 62px); }
  .hero-summary { margin-top: 22px; font-size: 17px; }
  .repository-form { margin-top: 32px; }
  .repository-field { grid-template-columns: auto minmax(0, 1fr); padding: 8px 8px 8px 14px; }
  .repository-field button { grid-column: 1 / -1; justify-content: center; }
  .preview-header { align-items: flex-start; padding: 14px; gap: 8px; }
  .preview-commit { display: none; }
  .preview-selection { grid-template-columns: 1fr; gap: 10px; }
  .analysis-progress { padding: 20px; }
  .progress-title > strong { font-size: 38px; }
  .analysis-progress ol { grid-template-columns: repeat(2, 1fr); margin-top: 30px; }
  .site-footer { display: grid; align-content: center; gap: 7px; }
  .report-nav { height: auto; min-height: 64px; padding: 12px 16px; grid-template-columns: 1fr auto; }
  .report-context { display: none; }
  .quiet-action { width: 38px; padding: 0; font-size: 0; }
  .primary-action { padding: 0 11px; }
  .report-overview { width: calc(100% - 32px); padding: 35px 0 28px; gap: 30px; }
  .report-overview h1 { font-size: 38px; }
  .report-overview dl div { min-width: 0; padding-left: 14px; }
  .report-overview dd { font-size: 23px; }
  .repository-meta { gap: 11px; }
  .panel-heading { align-items: flex-start; }
  .panel-heading p { max-width: 230px; }
  .hotspot-panel { padding: 14px; }
  .report-footer { display: grid; width: calc(100% - 32px); align-content: center; gap: 5px; }
}

@media (prefers-reduced-motion: no-preference) {
  .analysis-progress::before { animation: analysis-scan 2.2s cubic-bezier(.45, 0, .25, 1) infinite; }
  .progress-state svg { animation: activity-spin 1.4s linear infinite; }
  .progress-title > strong { animation: activity-breathe 2.2s ease-in-out infinite; }
  .analysis-progress li.is-active > span::after { animation: activity-pulse 1.8s ease-out infinite; }
  .skeleton { animation: skeleton-pulse 1.5s ease-in-out infinite alternate; }
}

@keyframes analysis-scan { 0% { transform: translateX(-110%); } 60%, 100% { transform: translateX(320%); } }
@keyframes activity-spin { to { transform: rotate(360deg); } }
@keyframes activity-breathe { 0%, 100% { opacity: .72; transform: scale(.985); } 50% { opacity: 1; transform: scale(1); } }
@keyframes activity-pulse { 0% { opacity: .4; transform: scale(.78); } 75%, 100% { opacity: 0; transform: scale(1.18); } }
@keyframes skeleton-pulse { from { opacity: .52; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}

@media (prefers-reduced-transparency: reduce) {
  .report-nav { background: var(--page); backdrop-filter: none; }
}

```

## Raw `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracepath: see the shape of a codebase",
  description: "Architecture maps, dependency graphs, and explainable complexity hotspots for public GitHub repositories."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

```

