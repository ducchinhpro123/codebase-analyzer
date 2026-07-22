# Interactive diagram as source of truth

Tracepath will make the interactive Data-flow architecture diagram the source of truth and derive SVG, PNG, and Draw.io-compatible Diagram artifacts from the same normalized model. This keeps exports consistent with the evidence, labels, and interactions shown in the report while allowing engineers to continue editing or sharing the result elsewhere.

## Consequences

- The diagram needs a stable normalized model separate from its visual renderer.
- The normalized model uses Semantic nodes linked to Supporting modules and Evidence anchors, rather than treating every source file as a diagram node.
- Export formats are projections of the model, not separate hand-maintained diagrams.
- The first release can prioritize reliable in-app navigation while exports mature independently.
