#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The repo-wide program needs far more than the default 2 GB V8 heap. Re-exec once
// with a raised limit rather than making every caller remember NODE_OPTIONS.
if (!process.env.DATAFLOW_CHILD) {
  const r = spawnSync(
    process.execPath,
    ['--max-old-space-size=12288', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, DATAFLOW_CHILD: '1' } },
  );
  process.exit(r.status ?? 1);
}

const { createService, ROOT } = await import('../src/program.mjs');
const { locate, listSymbols } = await import('../src/locate.mjs');
const { trace } = await import('../src/trace.mjs');
const { callersOf } = await import('../src/callers.mjs');
const { emitArchify } = await import('../src/emit-archify.mjs');
const { findReferences } = await import('../src/refs.mjs');

const USAGE = `dataflow — call-graph extraction via the TypeScript compiler API

  trace   <file> <symbol>   nested JSON of everything the symbol calls
  refs    <file> <symbol>   flat JSON of everywhere the symbol is used
  paths   <file> <symbol>   reverse: every entry point that can reach the symbol
  archify <file> <symbol>   paths, emitted as an archify dataflow specification
  symbols <file>            list declarations in a file (to find a <symbol>)

<symbol> is "method", "Class.method", "Class", or a 1-based line number.

Options
  --depth=N          trace recursion limit                     (default 6)
  --scope=seed|repo  program root set                          (trace: seed, refs/paths: repo)
  --app=NAME         paths: keep only entry points in that app    (e.g. offers)
  --fanout=N         paths: max callers expanded per symbol       (default 40)
  --max-paths=N      archify: routes to keep, shortest first       (default 12)
  --title=TEXT       archify: diagram title
  --store=TEXT       archify: label of the final storage node
  --quality=P        archify: standard|showcase                    (default standard)
  --external         descend into node_modules                 (default: stop at the boundary)
  --logs             keep logger calls                         (default: dropped)
  --full             re-expand a target on every occurrence    (default: mark "repeated")
  --out=FILE         write JSON to FILE instead of stdout
  --quiet            suppress the stderr progress line

Examples
  tools/dataflow/bin/dataflow.mjs symbols apps/offers/src/clairvo-at-home/clairvo-at-home.service.ts
  tools/dataflow/bin/dataflow.mjs trace apps/offers/src/offer-pass/offer-pass.service.ts OfferPassService.build --depth=5
  tools/dataflow/bin/dataflow.mjs refs libs/boost/src/offers/offers.helper.ts nurturedOrAppointmentExistsSql
`;

const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const positional = argv.filter((a) => !a.startsWith('--'));
const [command, fileArg, symbolArg] = positional;

if (!command || flags.help) { process.stdout.write(USAGE); process.exit(command ? 0 : 1); }
if (!fileArg) { console.error('error: <file> is required\n'); process.stdout.write(USAGE); process.exit(1); }

const absFile = path.resolve(ROOT, fileArg);
if (!fs.existsSync(absFile)) { console.error(`error: no such file: ${absFile}`); process.exit(1); }

const note = (msg) => { if (!flags.quiet) process.stderr.write(`${msg}\n`); };
const started = Date.now();
const defaultScope = ['refs', 'paths', 'archify'].includes(command) ? 'repo' : 'seed';
const scope = flags.scope ?? defaultScope;

note(`[dataflow] scope=${scope} building program…`);
const ctx = createService({ scope, entryFile: absFile });
const sourceFile = ctx.program.getSourceFile(absFile);
if (!sourceFile) {
  console.error(`error: ${fileArg} is not part of the program (excluded by tsconfig?)`);
  process.exit(1);
}
note(`[dataflow] roots=${ctx.rootCount} files=${ctx.program.getSourceFiles().length} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

let result;
try {
if (command === 'symbols') {
  result = {
    file: path.relative(ROOT, absFile),
    symbols: listSymbols(sourceFile).map(({ node, ...rest }) => rest),
  };
} else if (command === 'trace') {
  if (!symbolArg) { console.error('error: trace needs a <symbol>'); process.exit(1); }
  const target = locate(sourceFile, symbolArg);
  result = trace(ctx, target.node, {
    maxDepth: Number(flags.depth ?? 6),
    followExternal: !!flags.external,
    includeLogs: !!flags.logs,
    full: !!flags.full,
  });
} else if (command === 'paths' || command === 'archify') {
  if (!symbolArg) { console.error(`error: ${command} needs a <symbol>`); process.exit(1); }
  if (scope !== 'repo') note(`[dataflow] warning: ${command} with scope != repo misses callers in other apps`);
  const target = locate(sourceFile, symbolArg);
  const walked = callersOf(ctx, sourceFile, target, {
    maxDepth: Number(flags.depth ?? 8),
    maxFanout: Number(flags.fanout ?? 40),
    appFilter: flags.app ?? null,
  });
  if (command === 'paths') {
    result = walked;
  } else {
    const { spec, report } = emitArchify(walked, {
      title: flags.title ?? null,
      maxPaths: Number(flags['max-paths'] ?? 12),
      quality: flags.quality ?? 'standard',
      storeLabel: flags.store ?? null,
    });
    if (!spec) { console.error(`error: cannot emit a diagram — ${report.reason}`); process.exit(1); }
    note(`[dataflow] ${report.pathsKept} route(s) kept, ${report.pathsDropped} dropped, ${report.nodes} nodes, ${report.rows} rows`);
    for (const r of report.droppedRoutes) note(`[dataflow]   dropped: ${r}`);
    result = spec;
  }
} else if (command === 'refs') {
  if (!symbolArg) { console.error('error: refs needs a <symbol>'); process.exit(1); }
  if (scope !== 'repo') note('[dataflow] warning: refs with scope != repo returns an incomplete answer');
  const target = locate(sourceFile, symbolArg);
  result = findReferences(ctx, sourceFile, target);
} else {
  console.error(`error: unknown command "${command}"\n`);
  process.stdout.write(USAGE);
  process.exit(1);
}
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}

const json = JSON.stringify(result, null, 2);
if (flags.out) {
  fs.writeFileSync(path.resolve(process.cwd(), flags.out), json + '\n');
  note(`[dataflow] wrote ${flags.out} (${json.length} bytes) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
} else {
  process.stdout.write(json + '\n');
  note(`[dataflow] done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
