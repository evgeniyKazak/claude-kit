import { ENTRY_NODE_TYPE } from './entrypoints.mjs';

/**
 * Turn a `paths` result into an archify dataflow specification.
 *
 * The mapping is a layered DAG, right-aligned on the write site: a node's stage is
 * its distance from the target, so every path converges on the same final column
 * however long it is, and a node shared by two paths appears once. Rows are
 * assigned per stage, ordered by the row of the successor a node feeds, which is
 * the cheap way to stop converging edges from braiding.
 *
 * Budget: the dataflow schema allows 200 stages and 200 rows. Real queries overrun
 * rows long before stages — one write site can have dozens of entry points. When
 * that happens the diagram keeps what answers the question and reports what it
 * dropped, rather than emitting something that fails validation. Priority:
 *   1. the write site and its store       — the subject of the question
 *   2. entry points, shortest path first  — the answer to "where does it start"
 *   3. longer duplicate routes            — dropped first
 */

const MAX_ROWS = 200;
const MAX_STAGES = 200;

/**
 * Node text has to be sized against the renderer's own arithmetic, not guessed.
 * The dataflow renderer rejects a label whose estimated width exceeds
 * `width + 6` (6.2px per unit), and a sublabel that still needs more than
 * `width - 8` once shrunk to its 6px legible floor (6 × 0.6 = 3.6px per unit).
 * A node is therefore widened to fit its text, capped just under the 215px stage
 * pitch so two stages never collide, and the text is trimmed only when even the
 * cap cannot hold it.
 */
const NODE_W_DEFAULT = 112;
// Stage pitch is 215px. A flow label is measured as max(34, units × 4.9 + 12) and
// needs that much clear gap plus breathing room between two stages, so the node
// cap has to leave it: 215 − (34 + 8) ≈ 168.
const NODE_W_MAX = 168;
const LABEL_PX_PER_UNIT = 6.2;
const SUBLABEL_PX_PER_UNIT = 3.6;

const units = (t) => String(t ?? '').length;
const labelCapacity = (w) => Math.floor((w + 6) / LABEL_PX_PER_UNIT);
const sublabelCapacity = (w) => Math.floor((w - 8) / SUBLABEL_PX_PER_UNIT);

const clip = (text, max) => {
  const t = String(text ?? '');
  return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 1))}…`;
};

/** Width that holds both strings, and the strings trimmed to whatever we could get. */
function fitNodeText(label, sublabel) {
  const needed = Math.max(
    NODE_W_DEFAULT,
    Math.ceil(units(label) * LABEL_PX_PER_UNIT - 6),
    Math.ceil(units(sublabel) * SUBLABEL_PX_PER_UNIT + 8),
  );
  const width = Math.min(NODE_W_MAX, needed);
  return {
    width,
    label: clip(label, labelCapacity(width)),
    sublabel: sublabel ? clip(sublabel, sublabelCapacity(width)) : undefined,
  };
}

const slug = (s, fallback) => {
  const cleaned = String(s ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `${fallback}${cleaned}`;
};

/** Node ids must match archify's identifier pattern, and file:offset does not. */
function idFactory() {
  const used = new Map();
  return (node) => {
    const base = (slug(`${node.class ? node.class + '_' : ''}${node.name}`, 'n') || 'n').slice(0, 60);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}_${seen}`;
  };
}

const looksLikeWrite = (node) =>
  /repository|repo$/i.test(node.class ?? '') || /^(save|insert|update|upsert|delete|remove)/i.test(node.name);

export function emitArchify(result, opts = {}) {
  const { title = null, maxPaths = 12, quality = 'standard', storeLabel = null } = opts;

  const byId = new Map(result.nodes.map((n) => [n.id, n]));
  const kept = result.paths.slice(0, maxPaths);
  const dropped = result.paths.slice(maxPaths);
  if (!kept.length) return { spec: null, report: { reason: 'no entry point reaches this symbol' } };

  // --- layering: stage = distance from the target, counted backwards ----------
  const target = result.target;
  const stageOf = new Map();
  let maxDistance = 0;
  for (const p of kept) {
    p.nodes.forEach((id, index) => {
      const distance = p.nodes.length - 1 - index; // 0 at the target
      const current = stageOf.get(id);
      // A node reachable at two depths is drawn at its deepest, so no kept edge
      // ever points backwards.
      if (current === undefined || distance > current) stageOf.set(id, distance);
      if (distance > maxDistance) maxDistance = distance;
    });
  }

  // Every path is right-aligned on the write site, so a column means "this many
  // calls before the write" — not "this stage of a pipeline". Pinning short
  // routes' entry points to column 0 was tried and rejected: the resulting long
  // spanning edge cuts straight through the intermediate columns' nodes. The
  // columns are labelled for what they actually are instead, and an entry point is
  // recognised by its colour and tag wherever its depth places it.
  const stageIndex = (id) => maxDistance - stageOf.get(id);
  const storeStage = maxDistance + 1;
  if (storeStage + 1 > MAX_STAGES) return { spec: null, report: { reason: 'stage budget exceeded' } };

  // --- rows: order each stage by where its successors sit --------------------
  const successors = new Map();
  for (const p of kept) {
    for (let i = 0; i < p.nodes.length - 1; i += 1) {
      const from = p.nodes[i];
      if (!successors.has(from)) successors.set(from, new Set());
      successors.get(from).add(p.nodes[i + 1]);
    }
  }

  const stages = new Map();
  for (const id of stageOf.keys()) {
    const s = stageIndex(id);
    if (!stages.has(s)) stages.set(s, []);
    stages.get(s).push(id);
  }

  const rowOf = new Map();
  for (const s of [...stages.keys()].sort((a, b) => b - a)) { // right to left
    const ids = stages.get(s);
    ids.sort((a, b) => {
      const ra = averageSuccessorRow(a, successors, rowOf);
      const rb = averageSuccessorRow(b, successors, rowOf);
      if (ra !== rb) return ra - rb;
      return (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? '');
    });
    ids.forEach((id, row) => rowOf.set(id, row));
  }

  const usedRows = Math.max(...rowOf.values()) + 1;
  if (usedRows > MAX_ROWS) return { spec: null, report: { reason: 'row budget exceeded', usedRows } };

  // --- nodes ------------------------------------------------------------------
  const mkId = idFactory();
  const archifyId = new Map();
  const nodes = [];
  for (const id of stageOf.keys()) {
    const n = byId.get(id);
    if (!n) continue;
    const aid = mkId(n);
    archifyId.set(id, aid);
    // The method carries the meaning; its class is context and moves to the
    // sublabel, which measures at roughly half the cost per character.
    const fitted = fitNodeText(n.name, n.entry ? n.entry.label : (n.class ?? n.unit));
    const node = {
      id: aid,
      type: nodeType(n, id === target.id),
      label: fitted.label,
      stage: stageIndex(id),
      row: rowOf.get(id),
      width: fitted.width,
    };
    if (fitted.sublabel) node.sublabel = fitted.sublabel;
    node.tag = n.entry ? n.entry.kind.replace(/\.in$/, '') : n.unit;
    nodes.push(node);
  }

  const storeId = 'store';
  const storeFitted = fitNodeText(storeLabel ?? 'consumer_hub', 'persisted row');
  nodes.push({
    id: storeId,
    type: 'database',
    label: storeFitted.label,
    sublabel: storeFitted.sublabel,
    stage: storeStage,
    row: rowOf.get(target.id) ?? 0,
    width: storeFitted.width,
  });

  // --- flows ------------------------------------------------------------------
  const flows = [];
  const emitted = new Set();
  for (const p of kept) {
    for (let i = 0; i < p.nodes.length - 1; i += 1) {
      const from = p.nodes[i];
      const to = p.nodes[i + 1];
      const key = `${from}->${to}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      const edge = result.edges.find((e) => e.from === from && e.to === to);
      // The callee's method name is already the target node's label, so repeating
      // it on the edge is the redundant wording archify tells you to omit. The one
      // fact the two nodes do not carry is where the call is written, so the edge
      // says that instead.
      const flow = {
        id: slug(`f_${archifyId.get(from)}_${archifyId.get(to)}`, 'f').slice(0, 70),
        from: archifyId.get(from),
        to: archifyId.get(to),
        label: edge ? `:${edge.at.split(':').pop()}` : 'calls',
        variant: i === 0 ? 'emphasis' : 'default',
      };
      flows.push(flow);
    }
  }
  flows.push({
    id: 'f_write',
    from: archifyId.get(target.id),
    to: storeId,
    label: looksLikeWrite(target) ? 'write' : 'query',
    variant: 'emphasis',
  });

  // --- stage labels -----------------------------------------------------------
  const stageLabels = [];
  for (let s = 0; s <= storeStage; s += 1) {
    if (s === storeStage) stageLabels.push({ label: 'Store' });
    else if (s === storeStage - 1) stageLabels.push({ label: 'Write' });
    else {
      const hops = storeStage - 1 - s;
      stageLabels.push({ label: `${hops} call${hops === 1 ? '' : 's'} out` });
    }
  }

  // Up to five guided views, one per shortest route, so the reader can isolate a
  // single entry point instead of reading the whole convergence at once.
  const views = kept.slice(0, 5).map((p, i) => ({
    id: `route-${i + 1}`,
    label: p.entry.label.slice(0, 48),
    focus: p.nodes.map((id) => archifyId.get(id)).filter(Boolean).concat(storeId),
    note: `${p.entry.unit}: ${p.entry.label}`.slice(0, 140),
  }));

  const spec = {
    schema_version: 1,
    diagram_type: 'dataflow',
    meta: {
      title: title ?? `${target.class ? target.class + '.' : ''}${target.name} — inbound paths`,
      quality_profile: quality,
      ...(views.length ? { views } : {}),
    },
    stages: stageLabels,
    nodes,
    flows,
  };

  return {
    spec,
    report: {
      target: `${target.class ? target.class + '.' : ''}${target.name}`,
      entryPointsFound: result.stats.entryPoints,
      pathsKept: kept.length,
      pathsDropped: dropped.length,
      droppedRoutes: dropped.map((p) => `${p.entry.unit}: ${p.entry.label}`),
      stages: stageLabels.length,
      rows: usedRows,
      nodes: nodes.length,
      flows: flows.length,
    },
  };
}

function averageSuccessorRow(id, successors, rowOf) {
  const outs = [...(successors.get(id) ?? [])].map((s) => rowOf.get(s)).filter((r) => r !== undefined);
  if (!outs.length) return Number.MAX_SAFE_INTEGER;
  return outs.reduce((a, b) => a + b, 0) / outs.length;
}

function nodeType(node, isTarget) {
  if (node.entry) return ENTRY_NODE_TYPE[node.entry.kind] ?? 'external';
  if (isTarget) return 'database';
  if (/controller$/i.test(node.class ?? '')) return 'frontend';
  if (/repository|repo$/i.test(node.class ?? '')) return 'database';
  return 'backend';
}
