# Conservative Diagram relationships

The first Data-flow architecture diagram will render Observed relationships and Inferred relationships as distinct kinds. Parsed imports, manifest references, explicit documented flows, and source evidence can create Observed relationships; model-generated relationships without direct support remain visibly inferred. The default view will favor a readable main path and allow expansion into the complete module map instead of showing every unresolved edge at once.

## Consequences

- A diagram can be useful without implying that static imports prove runtime calls.
- Relationship provenance becomes part of the exportable normalized model.
- Dense repositories need progressive disclosure: main path first, supporting modules and unresolved edges on demand.
