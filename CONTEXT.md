# Tracepath domain

The language for describing a codebase analysis and the report an engineer uses to understand it.

## Analysis vocabulary

**Repository**:
The public GitHub codebase being examined.
_Avoid_: Project, codebase snapshot

**Repository overview**:
The generated plain-language explanation of what a Repository does, who or what it serves, and how its major parts work.
_Avoid_: Project overview, Big picture

**Tracepath**:
The product that creates and presents Repository reports.
_Avoid_: Analyzer, dashboard

**Evidence-backed claim**:
A statement in a Repository overview that points to one or more observed repository artifacts, such as a source range, README passage, manifest, or dependency edge.
_Avoid_: Verified fact, LLM fact

**Inference**:
A useful interpretation that is not directly established by the available repository artifacts and must be labeled as such.
_Avoid_: Guess, fact

**Confidence**:
A signal describing how strongly the available evidence supports an overview or explanation; it never replaces an evidence reference.
_Avoid_: Accuracy score, certainty

**Overview claim**:
A discrete statement about the Repository's purpose, capability, flow, or risk that can be evaluated independently for evidence.
_Avoid_: Summary sentence, model output

**Evidence anchor**:
A precise repository location or dependency relationship attached to an Overview claim to show why the claim was made.
_Avoid_: Citation, proof

**Inferred claim**:
An Overview claim retained for orientation when no valid Evidence anchor can be attached; it is visibly labeled and carries reduced confidence.
_Avoid_: Unsupported fact, fallback fact

**Documented intent**:
What the Repository's README or manifest says the software is meant to provide.
_Avoid_: Product truth, verified behavior

**Observed behavior**:
What the analyzed source modules, syntax relationships, and dependency structure support as a description of the Repository today.
_Avoid_: Runtime truth, actual execution

**Intent mismatch**:
A material disagreement between Documented intent and Observed behavior that deserves engineering review.
_Avoid_: Documentation bug, contradiction

**Data-flow architecture diagram**:
A visual Repository overview that shows actors, services, stores, artifacts, transformations, and the directional relationships between them.
_Avoid_: Draw.io, dependency graph, runtime trace

**Architecture flow**:
The most likely path through a Repository inferred from static structure and available explanations; it is not a proof of runtime execution order.
_Avoid_: Runtime trace, execution log, guaranteed sequence

**Semantic node**:
A meaningful actor, subsystem, store, artifact, transformation, or boundary in a Data-flow architecture diagram.
_Avoid_: File node, box

**Supporting module**:
An analyzed source module whose responsibilities, dependencies, or evidence support a Semantic node or relationship.
_Avoid_: Child node, implementation detail

**Diagram relationship**:
A directional connection between Semantic nodes that describes dependency, data movement, transformation, storage, or publication.
_Avoid_: Arrow, link

**Observed relationship**:
A Diagram relationship directly supported by parsed syntax, a manifest, a documented reference, or a source evidence anchor.
_Avoid_: Runtime edge, guaranteed call

**Inferred relationship**:
A plausible Diagram relationship proposed from combined module explanations or structural clues but not directly established by an observed artifact.
_Avoid_: LLM edge, guessed arrow

**Diagram artifact**:
An exported representation of a Data-flow architecture diagram, such as SVG, PNG, or a Draw.io-compatible document.
_Avoid_: Screenshot, chart image

**System-design architecture**:
A logical C4-style view of the Repository's containers, workers, stores, queues, external systems, and communication relationships.
_Avoid_: Runtime trace, deployment topology, infrastructure proof

**System-design element**:
A logical application container, worker, store, queue, actor, or external system retained in the System-design architecture.
_Avoid_: File node, semantic node

**System-design relationship**:
An evidence-backed or inferred interaction between System-design elements, such as a call, queue publication, read, write, or dependency.
_Avoid_: Runtime call, guaranteed execution
