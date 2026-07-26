import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Spectral } from "next/font/google";
import "./globals.css";

/**
 * Three voices, so the report reads as what it is in each register.
 *
 * Archivo carries the instrument voice: expanded widths for display, normal
 * width for controls. Spectral carries the human voice, because the product's
 * job is turning machine analysis into prose someone can actually read. Plex
 * Mono carries the apparatus: paths, line ranges, and metrics.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap"
});

const reading = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-read",
  display: "swap"
});

const data = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-data",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Tracepath: see the shape of a codebase",
  description: "Architecture maps, dependency graphs, and explainable complexity hotspots for public GitHub repositories."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${reading.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
