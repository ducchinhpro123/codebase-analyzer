import { z } from "zod";

export const repositoryUrlSchema = z
  .string()
  .trim()
  .transform((value) => /^github\.com\//i.test(value) ? `https://${value}` : value)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Paste a GitHub repository URL" });
      return;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.search || url.hash || segments.length !== 2 || !segments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Only public github.com repository URLs are supported" });
    }
  })
  .transform((value) => value.replace(/\.git\/?$/, "").replace(/\/$/, ""));

export const llmSummarySchema = z.object({
  modulePath: z.string(),
  purpose: z.string(),
  responsibilities: z.array(z.string()).default([]),
  keyFlows: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  evidence: z.array(z.object({ filePath: z.string(), startLine: z.number().int().positive(), endLine: z.number().int().positive(), reason: z.string() })).default([])
});

export const projectOverviewSchema = z.object({
  summary: z.string().min(1).max(1600),
  audience: z.array(z.string().min(1).max(180)).max(5).default([]),
  capabilities: z.array(z.string().min(1).max(280)).min(1).max(6),
  flow: z.array(z.object({
    title: z.string().min(1).max(80),
    description: z.string().min(1).max(360),
    modulePaths: z.array(z.string()).max(8).default([])
  })).min(2).max(6),
  risks: z.array(z.string().min(1).max(320)).max(5).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  evidence: z.array(z.object({ filePath: z.string(), startLine: z.number().int().positive(), endLine: z.number().int().positive(), reason: z.string() })).max(8).default([])
});

const diagramEvidenceSchema = z.object({ filePath: z.string(), startLine: z.number().int().positive(), endLine: z.number().int().positive(), reason: z.string() });

export const repositoryDiagramSchema = z.object({
  description: z.string().min(1).max(600),
  nodes: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(100),
    kind: z.enum(["actor", "service", "worker", "store", "artifact", "transform", "boundary"]),
    description: z.string().min(1).max(360),
    modulePaths: z.array(z.string()).max(12).default([]),
    evidence: z.array(diagramEvidenceSchema).max(6).default([]),
    provenance: z.enum(["observed", "inferred"]).default("inferred"),
    confidence: z.enum(["low", "medium", "high"]).default("medium")
  })).min(2).max(18),
  relationships: z.array(z.object({
    id: z.string().min(1).max(100),
    source: z.string(),
    target: z.string(),
    kind: z.enum(["depends-on", "reads", "writes", "transforms", "publishes", "calls"]),
    label: z.string().min(1).max(100),
    evidence: z.array(diagramEvidenceSchema).max(6).default([]),
    provenance: z.enum(["observed", "inferred"]).default("inferred"),
    confidence: z.enum(["low", "medium", "high"]).default("medium")
  })).max(36),
  generatedBy: z.enum(["deepseek-v4-flash", "deterministic-fallback"]).default("deterministic-fallback"),
  confidence: z.enum(["low", "medium", "high"]).default("medium")
});
