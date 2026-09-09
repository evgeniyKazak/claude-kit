import ts from 'typescript';
import { rel, isExternal, lineOf, ownerClass } from './program.mjs';
import { entryPointOf } from './entrypoints.mjs';
import { namePosition } from './locate.mjs';

/**
 * Reverse traversal: from one declaration up to every entry point that can reach it.
 *
 * `refs.mjs` answers one hop — "who uses this symbol". That is the IDE question.
 * The diagram question is its transitive closure: given the place a column is
 * written, which HTTP routes, queue subscribers and cron jobs can arrive there,
 * and by which chain. So each reference is resolved to its enclosing callable and
 * that callable is queried again, until the walk reaches something Nest itself
 * invokes (see entrypoints.mjs) or runs out of budget.
 *
 * Requires scope=repo. Under scope=seed the program only holds files reachable
 * from the entry, so callers living in another app are silently absent — the
 * answer would look clean and be wrong.
 */

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
  return n && !ts.isSourceFile(n) ? n : null;
};

/** apps/offers/... -> "offers"; libs/boost/... -> "boost"; shared/rmq/... -> "shared/rmq". */
export function unitOf(relFile) {
  const m = relFile.match(/^(apps|libs)\/([^/]+)\//);
  if (m) return m[2];
  const s = relFile.match(/^shared\/([^/]+)\//);
  if (s) return `shared/${s[1]}`;
  return relFile.split('/')[0] ?? '?';
}

const idOf = (decl) => `${rel(decl.getSourceFile().fileName)}:${decl.getStart()}`;
const isSpec = (f) => f.endsWith('.spec.ts') || f.endsWith('.e2e-spec.ts') || f.includes('/test/');

function nodeRecord(decl) {
  const file = rel(decl.getSourceFile().fileName);
  const entry = entryPointOf(decl);
  return {
    id: idOf(decl),
    class: ownerClass(decl),
    name: decl.name?.getText?.() ?? '<anonymous>',
    file,
    line: lineOf(decl),
    unit: unitOf(file),
    entry: entry ? { kind: entry.kind, label: entry.label, detail: entry.detail } : null,
  };
}

export function callersOf(ctx, sourceFile, target, opts = {}) {
  const { service, program } = ctx;
  const { maxDepth = 8, maxFanout = 40, appFilter = null } = opts;

  const nodes = new Map();
  const edges = new Map();
  const stats = { queries: 0, truncatedAt: [], skippedExternal: 0, skippedSpec: 0 };

  const targetDecl = target.node;
  const targetId = idOf(targetDecl);
  nodes.set(targetId, { ...nodeRecord(targetDecl), role: 'target' });

  const seen = new Set([targetId]);
  let frontier = [{ decl: targetDecl, depth: 0 }];

  while (frontier.length) {
    const next = [];
    for (const { decl, depth } of frontier) {
      if (depth >= maxDepth) {
        stats.truncatedAt.push(nodeRecord(decl));
        continue;
      }
      const sf = decl.getSourceFile();
      let hits;
      try {
        stats.queries += 1;
        hits = service.getReferencesAtPosition(sf.fileName, namePosition(decl)) ?? [];
      } catch {
        hits = [];
      }

      let fanout = 0;
      for (const h of hits) {
        if (isExternal(h.fileName)) { stats.skippedExternal += 1; continue; }
        if (isSpec(h.fileName)) { stats.skippedSpec += 1; continue; }
        const hsf = program.getSourceFile(h.fileName);
        if (!hsf) continue;

        const caller = enclosingCallable(smallestNodeAt(hsf, h.textSpan.start));
        if (!caller) continue;
        const callerId = idOf(caller);
        const calleeId = idOf(decl);
        if (callerId === calleeId) continue; // the declaration itself, or direct recursion

        const line = hsf.getLineAndCharacterOfPosition(h.textSpan.start).line + 1;
        const code = hsf.text.split('\n')[line - 1]?.trim() ?? '';
        const edgeKey = `${callerId}->${calleeId}`;
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, {
            from: callerId,
            to: calleeId,
            at: `${rel(h.fileName)}:${line}`,
            code: code.length > 140 ? code.slice(0, 137) + '…' : code,
          });
        }

        if (!nodes.has(callerId)) nodes.set(callerId, nodeRecord(caller));
        if (seen.has(callerId)) continue;
        seen.add(callerId);

        // An entry point ends the walk: whatever calls it is Nest, the broker or
        // the scheduler, none of which exist in the type graph.
        if (nodes.get(callerId).entry) continue;

        fanout += 1;
        if (fanout > maxFanout) { stats.truncatedAt.push(nodeRecord(decl)); break; }
        next.push({ decl: caller, depth: depth + 1 });
      }
    }
    frontier = next;
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];
  const paths = buildPaths(nodeList, edgeList, targetId, appFilter);

  return {
    target: nodeRecord(targetDecl),
    options: { maxDepth, maxFanout, appFilter },
    stats: {
      queries: stats.queries,
      nodes: nodeList.length,
      edges: edgeList.length,
      entryPoints: nodeList.filter((n) => n.entry).length,
      paths: paths.length,
      skippedExternal: stats.skippedExternal,
      skippedSpec: stats.skippedSpec,
      truncatedAt: stats.truncatedAt.slice(0, 10),
    },
    nodes: nodeList,
    edges: edgeList,
    paths,
  };
}

/**
 * Every entry point -> target chain, shortest first.
 * Shortest is what the diagram wants: a longer chain to the same entry point is
 * usually the same story with an extra hop, and it is the first thing dropped
 * when the diagram runs out of budget.
 */
function buildPaths(nodes, edges, targetId, appFilter) {
  const outgoing = new Map();
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from).push(e.to);
  }

  const entries = nodes.filter((n) => n.entry && (!appFilter || n.unit === appFilter));
  const paths = [];
  for (const entry of entries) {
    const queue = [[entry.id]];
    const visited = new Set([entry.id]);
    let found = null;
    while (queue.length && !found) {
      const chain = queue.shift();
      const last = chain[chain.length - 1];
      if (last === targetId) { found = chain; break; }
      for (const nextId of outgoing.get(last) ?? []) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        queue.push([...chain, nextId]);
      }
    }
    if (found) {
      paths.push({
        entry: { id: entry.id, kind: entry.entry.kind, label: entry.entry.label, unit: entry.unit },
        length: found.length,
        nodes: found,
      });
    }
  }
  paths.sort((a, b) => a.length - b.length || a.entry.label.localeCompare(b.entry.label));
  return paths;
}
