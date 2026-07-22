import { parse } from "@babel/parser";

export type AstImport = { specifier: string; kind: "import" | "require"; line: number };

export function parseJavaScriptImports(source: string): AstImport[] {
  const ast = parse(source, {
    sourceType: "unambiguous",
    errorRecovery: true,
    plugins: ["typescript", "jsx", "dynamicImport", "importMeta", "topLevelAwait", "decorators-legacy"]
  });
  const imports: AstImport[] = [];
  const seen = new Set<string>();
  function add(specifier: unknown, kind: AstImport["kind"], line: unknown) {
    if (typeof specifier !== "string") return;
    const item = { specifier, kind, line: typeof line === "number" ? line : 1 };
    const key = `${item.kind}:${item.specifier}:${item.line}`;
    if (!seen.has(key)) { seen.add(key); imports.push(item); }
  }
  function visit(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const value = node as Record<string, unknown>;
    const loc = value.loc as { start?: { line?: number } } | undefined;
    const line = loc?.start?.line ?? 1;
    if (value.type === "ImportDeclaration" || value.type === "ExportNamedDeclaration" || value.type === "ExportAllDeclaration") {
      const sourceNode = value.source as { value?: unknown } | null;
      add(sourceNode?.value, "import", line);
    }
    if (value.type === "CallExpression") {
      const callee = value.callee as { type?: string; name?: string } | undefined;
      const args = value.arguments as Array<{ type?: string; value?: unknown }> | undefined;
      if (callee?.type === "Identifier" && callee.name === "require" && args?.[0]?.type === "StringLiteral") add(args[0].value, "require", line);
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }
  visit(ast);
  return imports;
}
