# Extractable components

There are no dedicated shared layout component files; the current app is a single self-contained client shell. Do not extract a page shell before the redesign establishes stable boundaries.

## Brand

- Source: `app/components/AnalyzerShell.tsx`
- Category: basic
- Description: Tracepath wordmark with the braces icon in an accent tile.
- Extractable props: none
- Hardcoded: Tracepath text, `BracketsCurly` icon, home URL, all CSS classes

## GraphCanvas

- Source: `app/components/AnalyzerShell.tsx`
- Category: basic
- Description: Interactive SVG dependency graph used in both the landing preview and report module map.
- Extractable props: `compact` (boolean), `selectedPath` (string)
- Hardcoded: graph toolbar copy, auto-arrange action, SVG node/edge styling
- Note: keep inline for the first design round because its data-driven SVG behavior is not useful as a static DraftComponent.

## AnalysisProgress

- Source: `app/components/AnalyzerShell.tsx`
- Category: basic
- Description: Four-stage repository analysis progress panel.
- Extractable props: current stage, progress percentage
- Hardcoded: Clone / Index / Map / Explain labels, activity visuals, status layout
- Note: keep inline for the first design round so the landing draft can show the default product preview state.

