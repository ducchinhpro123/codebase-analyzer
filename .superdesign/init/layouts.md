# Shared layouts

## RootLayout

- Path: `app/layout.tsx`
- Description: Root Next.js layout that installs Geist Sans and Geist Mono and imports the global theme.

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

## Application shell branches

- Path: `app/components/AnalyzerShell.tsx`
- Landing layout: `LandingPage` renders the shared brand header, two-column hero, capability band, and footer.
- Report layout: `ReportView` renders the sticky report navigation, repository summary, tabbed overview/module workspaces, and report footer.
- Shared navigation mark: `Brand` is reused on landing, report, loading, and error screens.

The full implementation is recorded in `components.md`; the design calls should pass the source file itself as context.

