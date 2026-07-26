type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function cappedArray(value: unknown, maximum: number) {
  return Array.isArray(value) ? value.slice(0, maximum) : value;
}

function normalizedEvidence(value: unknown, maximum: number) {
  if (!Array.isArray(value)) return value;
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return undefined;
      const startLine = typeof record.startLine === "number" ? record.startLine : Number(record.startLine);
      const endLine = typeof record.endLine === "number" ? record.endLine : Number(record.endLine);
      if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine < 1 || endLine < 1) return undefined;
      return { ...record, startLine, endLine };
    })
    .filter(Boolean)
    .slice(0, maximum);
}

export function normalizeProjectOverviewCandidate(value: unknown) {
  const record = asRecord(value);
  if (!record) return value;
  const flow = Array.isArray(record.flow)
    ? record.flow.slice(0, 6).map((step) => {
        const item = asRecord(step);
        return item ? { ...item, modulePaths: cappedArray(item.modulePaths, 8) } : step;
      })
    : record.flow;
  return {
    ...record,
    audience: cappedArray(record.audience, 5),
    capabilities: cappedArray(record.capabilities, 6),
    flow,
    risks: cappedArray(record.risks, 5),
    evidence: normalizedEvidence(record.evidence, 8)
  };
}

export function normalizeRepositoryDiagramCandidate(value: unknown) {
  const record = asRecord(value);
  if (!record) return value;
  const nodes = Array.isArray(record.nodes)
    ? record.nodes.slice(0, 18).map((node) => {
        const item = asRecord(node);
        return item
          ? { ...item, modulePaths: cappedArray(item.modulePaths, 12), evidence: normalizedEvidence(item.evidence, 6) }
          : node;
      })
    : record.nodes;
  const relationships = Array.isArray(record.relationships)
    ? record.relationships.slice(0, 36).map((relationship) => {
        const item = asRecord(relationship);
        return item ? { ...item, evidence: normalizedEvidence(item.evidence, 6) } : relationship;
      })
    : record.relationships;
  return { ...record, nodes, relationships };
}

export function normalizeRepositorySystemDesignCandidate(value: unknown) {
  const record = asRecord(value);
  if (!record) return value;
  const boundaries = Array.isArray(record.boundaries)
    ? record.boundaries.slice(0, 8).map((boundary) => {
        const item = asRecord(boundary);
        return item ? { ...item, evidence: normalizedEvidence(item.evidence, 6) } : boundary;
      })
    : record.boundaries;
  const nodes = Array.isArray(record.nodes)
    ? record.nodes.slice(0, 20).map((node) => {
        const item = asRecord(node);
        return item
          ? { ...item, modulePaths: cappedArray(item.modulePaths, 12), evidence: normalizedEvidence(item.evidence, 6) }
          : node;
      })
    : record.nodes;
  const relationships = Array.isArray(record.relationships)
    ? record.relationships.slice(0, 40).map((relationship) => {
        const item = asRecord(relationship);
        return item ? { ...item, evidence: normalizedEvidence(item.evidence, 6) } : relationship;
      })
    : record.relationships;
  return { ...record, boundaries, nodes, relationships };
}
