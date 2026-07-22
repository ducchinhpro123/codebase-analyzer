# Semantic nodes are inferred from static evidence

Tracepath will derive Data-flow architecture diagram nodes from deterministic module and dependency facts, then use DeepSeek to name and classify them as actors, services, workers, stores, artifacts, transformations, or boundaries. Every Semantic node and relationship must retain its Supporting modules and evidence status; when classification is uncertain, the diagram shows an Inferred claim instead of presenting the label as observed fact.

## Consequences

- The diagram is understandable at subsystem level without discarding file-level traceability.
- LLM output enriches labels and explanations but cannot invent unsupported nodes or relationships.
- Deterministic fallback remains possible when the LLM is unavailable or returns invalid structure.
