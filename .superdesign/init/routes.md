# Routes

Routing model: Next.js 14 App Router.

## `/`

- Entry: `app/page.tsx`
- Layout: `app/layout.tsx`
- Rendered component: `AnalyzerShell` without a report token
- Summary: Marketing/entry page with repository URL form, interactive sample graph preview, analysis progress state, capability strip, and footer.

```tsx
import { AnalyzerShell } from "./components/AnalyzerShell";

export default function HomePage() {
  return <AnalyzerShell />;
}

```

## `/report/[token]`

- Entry: `app/report/[token]/page.tsx`
- Layout: `app/layout.tsx`
- Rendered component: `AnalyzerShell reportToken={params.token}`
- Summary: Interactive architecture report. `/report/demo` renders the bundled demo immediately; other tokens fetch a persisted report.

```tsx
import { AnalyzerShell } from "../../components/AnalyzerShell";

export default function ReportPage({ params }: { params: { token: string } }) {
  return <AnalyzerShell reportToken={params.token} />;
}

```

## API routes

- `POST /api/analyses` → `app/api/analyses/route.ts`
- `GET /api/analyses/[id]` → `app/api/analyses/[id]/route.ts`
- `GET /api/analyses/[id]/events` → `app/api/analyses/[id]/events/route.ts`
- `GET /api/reports/[token]` → `app/api/reports/[token]/route.ts`

