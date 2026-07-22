# Evidence-backed Repository overviews

Repository overviews must distinguish evidence-backed claims from inference, and evidence must attach to each meaningful claim or flow stage rather than living only in a shared appendix. README and manifest context, source evidence, module summaries, and dependency edges are acceptable supports; confidence remains a supporting signal rather than a substitute for evidence. This protects engineers from treating fluent model output as verified repository behavior.

## Consequences

- Overview claims need evidence references or an explicit inference label.
- Each Overview claim owns its Evidence anchors so readers can inspect the reason for that specific statement.
- A useful unsupported claim may remain as an Inferred claim, but it must be visibly labeled and carry reduced confidence.
- Missing evidence must never be silently replaced with evidence borrowed from another claim.
- When README or manifest intent conflicts with the analyzed code, show both Documented intent and Observed behavior and raise an Intent mismatch signal.
- Architecture flows are inferred from static structure and must not be labeled as runtime traces or guaranteed execution order.
- Older reports may use deterministic synthesis, but they must not appear more certain than their evidence allows.
- The UI needs to make the evidence boundary visible without turning the overview into a raw source browser.
