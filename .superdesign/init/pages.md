# Page dependency trees

## `/` — Landing page

Entry: `app/page.tsx`

Dependencies:
- `app/page.tsx`
  - `app/components/AnalyzerShell.tsx`
    - `lib/demo.ts`
      - `lib/types.ts`
    - `lib/diagram-export.ts`
      - `lib/diagram-layout.ts`
      - `lib/types.ts`
    - `lib/graph-interaction.ts`
    - `lib/graph-layout.ts`
    - `lib/diagram-layout.ts`
    - `lib/project-overview.ts`
      - `lib/types.ts`
    - `lib/types.ts`
- `app/layout.tsx`
  - `app/globals.css`

Actual render branch: when `reportToken` is absent, `AnalyzerShell` returns `LandingPage` at the end of the component. The landing UI uses `Brand`, `HeroPreview`, `GraphCanvas`, and conditionally `AnalysisProgress`.

Design context candidate set:
- `app/components/AnalyzerShell.tsx` (full file, 463 lines)
- `app/globals.css` (full file, 417 lines)
- `app/layout.tsx`
- `app/page.tsx`
- `lib/demo.ts` only when sample content is needed

## `/report/[token]` — Architecture report

Entry: `app/report/[token]/page.tsx`

Dependencies:
- `app/report/[token]/page.tsx`
  - `app/components/AnalyzerShell.tsx`
    - `lib/demo.ts`
      - `lib/types.ts`
    - `lib/diagram-export.ts`
      - `lib/diagram-layout.ts`
      - `lib/types.ts`
    - `lib/graph-interaction.ts`
    - `lib/graph-layout.ts`
    - `lib/diagram-layout.ts`
    - `lib/project-overview.ts`
      - `lib/types.ts`
    - `lib/types.ts`
- `app/layout.tsx`
  - `app/globals.css`

Actual render branch: a resolved report renders `ReportView`; the default tab is `overview`, which renders `ProjectOverviewView`, `RepositoryDiagramCanvas`, and `DiagramExports`. The alternate `modules` tab renders a sticky browser, `GraphCanvas`, hotspot cards, and `Inspector`.

Design context candidate set:
- `app/components/AnalyzerShell.tsx` (full file)
- `app/globals.css` (full file)
- `app/layout.tsx`
- `app/report/[token]/page.tsx`
- `lib/demo.ts` for realistic report content
- `lib/types.ts` when report data shape is needed

