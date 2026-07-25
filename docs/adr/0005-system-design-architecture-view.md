# Separate system-design architecture view

Tracepath will expose a separate C4-style System-design architecture view
alongside the existing Data-flow architecture diagram. The System-design view
groups evidence-backed source and configuration facts into logical containers,
workers, stores, queues, actors, and external systems. It will not replace the
Data-flow model or imply runtime execution.

## Consequences

- `RepositorySystemDesign` is a distinct normalized report field, so the two
  views can evolve without conflating data movement with logical containers.
- Source modules, manifests, Compose files, route entrypoints, and safe
  architecture configuration may support a System-design element or
  relationship.
- Model-enriched labels are retained only after known-module/evidence
  validation; unsupported claims remain visibly inferred.
- Existing reports without the new field receive a deterministic fallback at
  read time.
- The in-app System-design view uses Mermaid for boundary-aware layout and is
  loaded only when that report tab mounts.
- SVG, PNG, and Draw.io exports are projections of the same normalized
  System-design model shown in the report.
