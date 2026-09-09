import ts from 'typescript';
import { rel, isExternal, lineOf, ownerClass } from './program.mjs';
import { classify, SIDE_EFFECT_KINDS } from './classify.mjs';

const bodyOf = (decl) => {
  if (!decl) return null;
  if (ts.isMethodDeclaration(decl) || ts.isFunctionDeclaration(decl) || ts.isConstructorDeclaration(decl) ||
      ts.isArrowFunction(decl) || ts.isFunctionExpression(decl) || ts.isGetAccessor(decl) || ts.isSetAccessor(decl)) {
    return decl.body ?? null;
  }
  if ((ts.isPropertyDeclaration(decl) || ts.isVariableDeclaration(decl)) && decl.initializer &&
      (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
    return decl.initializer.body;
  }
  return null;
};

const smallestNodeAt = (sf, pos) => {
  let found = null;
  const visit = (n) => {
    if (n.getStart() <= pos && pos < n.getEnd()) { found = n; ts.forEachChild(n, visit); }
  };
  ts.forEachChild(sf, visit);
  return found;
};

const enclosingCallable = (node) => {
  let n = node;
  while (n && !bodyOf(n)) n = n.parent;
  return n ?? null;
};

export function trace(ctx, entryDecl, opts) {
  const { checker, service, program } = ctx;
  const { maxDepth, followExternal, includeLogs, full } = opts;
  const visited = new Set();
  const stats = { nodes: 0, byKind: {}, files: new Set(), unresolved: 0, boundaries: [] };

  /** Resolve the identifier of a call to the declaration(s) it points at. */
  function resolveTargets(nameNode) {
    const sym = checker.getSymbolAtLocation(nameNode);
    if (!sym) return [];
    const target = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
    const decls = target.declarations ?? [];
    const withBody = decls.filter((d) => bodyOf(d));
    if (withBody.length) return withBody.map((d) => ({ decl: d, name: target.getName(), via: 'checker' }));

    // Declaration is bodyless (interface member / abstract method / overload signature).
    // Fall back to what the IDE's "Go to Implementation" does.
    const sf = nameNode.getSourceFile();
    const impls = service.getImplementationAtPosition(sf.fileName, nameNode.getStart()) ?? [];
    const resolved = [];
    for (const impl of impls) {
      const isf = program.getSourceFile(impl.fileName);
      if (!isf) continue;
      const node = smallestNodeAt(isf, impl.textSpan.start);
      const decl = enclosingCallable(node);
      if (decl && bodyOf(decl)) resolved.push({ decl, name: target.getName(), via: 'implementation' });
    }
    if (resolved.length) return resolved;
    return decls.length ? [{ decl: decls[0], name: target.getName(), via: 'declaration' }] : [];
  }

  function walk(decl, depth, stack) {
    const body = bodyOf(decl);
    if (!body) return [];
    const edges = [];

    const visit = (n) => {
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        const callee = n.expression;
        const nameNode = ts.isPropertyAccessExpression(callee) ? callee.name
          : ts.isElementAccessExpression(callee) ? callee.argumentExpression
          : callee;
        const methodName = ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)
          ? nameNode.getText() : callee.getText();

        const targets = ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)
          ? resolveTargets(nameNode) : [];
        const primary = targets[0] ?? null;
        const targetFile = primary?.decl.getSourceFile().fileName ?? null;
        const { kind, boundary } = classify({ targetFile, methodName, isNew: ts.isNewExpression(n) });

        if (kind === 'log' && !includeLogs) { ts.forEachChild(n, visit); return; }

        const edge = {
          call: callee.getText().replace(/\s+/g, ''),
          kind,
          at: `${rel(n.getSourceFile().fileName)}:${lineOf(n)}`,
        };
        if (boundary) {
          edge.boundary = true;
          stats.boundaries.push({ kind, at: edge.at, call: edge.call });
        }

        if (!primary) {
          edge.resolved = false;
          stats.unresolved++;
        } else {
          const file = targetFile;
          edge.target = {
            class: ownerClass(primary.decl),
            name: primary.name,
            file: rel(file),
            line: lineOf(primary.decl),
          };
          if (primary.via !== 'checker') edge.target.via = primary.via;
          if (targets.length > 1) edge.target.implementations = targets.length;
          stats.files.add(rel(file));

          const key = `${file}#${primary.decl.getStart()}`;
          const external = isExternal(file);
          if (external) edge.external = true;

          if (stack.has(key)) {
            edge.cycle = true;
          } else if (!external || followExternal) {
            if (visited.has(key) && !full) {
              edge.repeated = true;
            } else if (depth < maxDepth) {
              visited.add(key);
              stack.add(key);
              const kids = walk(primary.decl, depth + 1, stack);
              stack.delete(key);
              if (kids.length) edge.calls = kids;
            } else {
              edge.truncated = true;
            }
          }
        }

        stats.nodes++;
        stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
        edges.push(edge);
      }
      ts.forEachChild(n, visit);
    };

    ts.forEachChild(body, visit);
    return edges;
  }

  const rootKey = `${entryDecl.getSourceFile().fileName}#${entryDecl.getStart()}`;
  const calls = walk(entryDecl, 1, new Set([rootKey]));

  return {
    entry: {
      class: ownerClass(entryDecl),
      name: entryDecl.name?.getText() ?? '<anonymous>',
      file: rel(entryDecl.getSourceFile().fileName),
      line: lineOf(entryDecl),
    },
    options: { maxDepth, followExternal, includeLogs, full },
    stats: {
      edges: stats.nodes,
      unresolved: stats.unresolved,
      filesTouched: stats.files.size,
      byKind: stats.byKind,
      sideEffects: Object.fromEntries(
        Object.entries(stats.byKind).filter(([k]) => SIDE_EFFECT_KINDS.has(k)),
      ),
      boundaries: stats.boundaries,
    },
    calls,
  };
}
