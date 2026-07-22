import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    // A production build must not rewrite the chunk manifest used by a live
    // development server. Keeping their generated output separate prevents
    // missing-chunk failures when both commands are run in the same checkout.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    experimental: { typedRoutes: true, optimizePackageImports: ["@phosphor-icons/react"] },
    transpilePackages: ["geist"]
  };
}
