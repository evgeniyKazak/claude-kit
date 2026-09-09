# dataflow — call-graph extraction via the TypeScript compiler API

Produces JSON call graphs for this monorepo by asking the TypeScript type checker
the same questions an IDE asks it. "Go to Definition", "Find All References" and
"Go to Implementation" in VS Code are not editor features — they are `tsserver`
from `node_modules/typescript` answering over a protocol. This tool skips the
protocol and drives the compiler API directly, so it can walk the answers
recursively and emit a nested document instead of one hop at a time.

Intended consumer: the `flow-explainer` agent and `docs/data-flows/`. The JSON is
the raw material for a schematic dataflow diagram — it establishes *what actually
calls what*, so the diagram is derived from the type system rather than from
reading code by hand.

## Requirements

None beyond the repo. It imports `typescript` (5.3.3) resolved from
`nestjs/node_modules`, and reads `nestjs/tsconfig.json` for `paths`, so the
`@app/boost/*` / `@app/shared/*` / `@libs/*` aliases resolve exactly as they do at
build time.

The CLI re-execs itself once with `--max-old-space-size=12288`; the repo-wide
program does not fit in the default 2 GB V8 heap.

## Commands

```bash
# what can I trace in this file?
tools/dataflow/bin/dataflow.mjs symbols apps/offers/src/clairvo-at-home/clairvo-at-home.service.ts

# forward: everything this symbol calls, nested
tools/dataflow/bin/dataflow.mjs trace \
  libs/boost/src/offer-pass/offer-pass.service.ts OfferPassService.syncPass --depth=6

# reverse: everywhere this symbol is used ("Find All References")
tools/dataflow/bin/dataflow.mjs refs \
  libs/boost/src/offers/offers.helper.ts nurturedOrAppointmentExistsSql
```

`<symbol>` accepts `method`, `Class.method`, `Class`, or a 1-based line number.
A bare `method` that is ambiguous in the file errors out with the qualified
alternatives rather than guessing.

### Options

| Flag | Default | Effect |
|---|---|---|
| `--depth=N` | `6` | recursion limit for `trace` |
| `--scope=seed\|repo` | `seed` for trace, `repo` for refs | which files go into the program (see below) |
| `--external` | off | descend into `node_modules` instead of stopping at the package boundary |
| `--logs` | off | keep logger calls; they are dropped by default because they triple the graph and carry no dataflow |
| `--full` | off | re-expand a target on every occurrence instead of marking it `repeated` |
| `--out=FILE` | stdout | write JSON to a file |
| `--quiet` | off | suppress the stderr progress line |

## How it resolves a call

For every `CallExpression` / `NewExpression` in the body:

1. Take the callee identifier — `name` of a property access, or the identifier itself.
2. `checker.getSymbolAtLocation()`, then `getAliasedSymbol()` if it is an import alias.
   This is what makes `this.sellerRepo.findOne` land on
   `BaseOrmRepository.findOne` rather than on a string: the type of `sellerRepo`
   is the class, so the member lookup is a type-system fact, not a name match.
   NestJS constructor DI resolves for free for the same reason.
3. If the resolved declaration has a body, recurse into it.
4. If it does not — an interface member, an abstract method, an overload
   signature — fall back to `service.getImplementationAtPosition()`, which is the
   IDE's "Go to Implementation". Those edges are tagged `"via": "implementation"`.
   Example: `secretOptions.getExchange` resolves through the abstract declaration
   to `RMQBaseOptions.getExchange`.
5. If nothing resolves, emit the edge with `"resolved": false` rather than
   dropping it. In practice these are array/string methods on `any` values —
   `strictNullChecks` and `noImplicitAny` are off in this repo, so untyped JSON
   payloads produce a handful per trace.

Traversal bookkeeping: a target already on the current path is marked `cycle`; a
target seen elsewhere in the graph is marked `repeated` and not re-expanded
(use `--full` to override); hitting `--depth` marks `truncated`.

## Scope: seed vs repo

This is the single decision that governs both cost and correctness.

**`seed`** — the program's root file set is just the entry file. Module resolution
pulls in exactly the transitively-reachable subgraph. Cheap, and complete *for
forward tracing*, because anything the entry calls is by definition reachable
from it.

**`repo`** — roots are every `.ts` in `tsconfig.json` minus specs and `test/`.
Required for `refs`: a caller in another app does not import the callee's file
in the direction we need, so under `seed` the reference set comes back silently
short. The CLI defaults `refs` to `repo` and warns if you override it.

Measured on this repo (M-series Mac):

| Operation | Scope | Program build | Total | Output |
|---|---|---|---|---|
| `symbols` on a service | seed | 1.9 s | 2.0 s | — |
| `trace` clairvo-at-home, depth 4 | seed | 2.1 s | 2.8 s | 31 edges, 13 KB |
| `trace` OfferPassService.syncPass, depth 6 | seed | 1.3 s | 14.5 s | 290 edges, 141 KB |
| `refs` on `OfferPassEventService.record` | repo | ~13 s | 13.6 s | 15 refs / 5 files |
| `refs` on `OffersHelper.nurturedOrAppointmentExistsSql` | repo | ~13 s | 13.6 s | 7 refs / 3 files |

Repo scope loads 3456 root files → 8392 in the program, ~2.7 GB RSS.

If you need many `refs` queries in one sitting, the 13 s program build dominates
and should be paid once — that means keeping a `tsserver` process alive and
talking to it, which this tool does not do yet. See *Not built yet* below.

## Output

### `trace`

```jsonc
{
  "entry":   { "class": "OfferPassService", "name": "syncPass", "file": "…", "line": 449 },
  "options": { "maxDepth": 6, "followExternal": false, "includeLogs": false, "full": false },
  "stats": {
    "edges": 290,
    "unresolved": 10,          // callee the checker could not pin down
    "filesTouched": 46,
    "byKind":      { "call": 226, "db.read": 13, "db.write": 9, "http.out": 4, … },
    "sideEffects": { "db.read": 13, "db.write": 9, "http.out": 4 },
    "boundaries":  [ { "kind": "http.out", "at": "…/apple-apns.service.ts:53", "call": "http2.connect" } ]
  },
  "calls": [
    {
      "call": "this.sellerRepo.findOne",
      "kind": "db.read",
      "at":   "apps/offers/src/clairvo-at-home/clairvo-at-home.service.ts:333",
      "target": { "class": "BaseOrmRepository", "name": "findOne",
                  "file": "shared/database-core/base-orm.repository.ts", "line": 84 },
      "calls": [ /* …recursive… */ ]
    }
  ]
}
```

Per-edge flags: `boundary`, `external`, `resolved:false`, `cycle`, `repeated`,
`truncated`, and `target.via` (`implementation` / `declaration`) when the edge did
not come straight from the checker.

### `refs`

Grouped by file, each use carrying its line and the trimmed source line, with
`definition` / `write` flags from the language service.

### `symbols`

Flat list of `{kind, class, name, line}` — classes, methods, constructors, and
function-valued properties. Use it to find the `<symbol>` argument.

## Edge kinds

Classification is two-signal, in `src/classify.mjs`. The *module* of the resolved
declaration gives the channel; the *method name* decides whether the edge is a
real operation on that channel or a helper that merely lives in the same package.

This distinction is load-bearing. `mapOptions` sits in `shared/database-core` but
queries nothing; `getRabbitMQExchangeName` sits in `shared/rmq` but publishes
nothing. Both would otherwise be counted as side effects and pollute a diagram.
Helpers get a `.helper` suffix and stay out of `sideEffects`.

| Kind | Meaning |
|---|---|
| `db.read` / `db.write` | TypeORM / `database-core` query |
| `db.mongo.read` / `db.mongo.write` | MongoDB |
| `queue.amqp` | RabbitMQ publish/consume — **boundary** |
| `queue.lambda` | `queue_tasks` / Lambda enqueue — **boundary** |
| `http.out` | axios, node `http2`, vendor SDKs — **boundary** |
| `aws` | S3 / SQS / Rekognition — **boundary** |
| `cache` | Redis / shared-cache |
| `event` | `@nestjs/event-emitter` |
| `throw` | `@nestjs/common` exception construction |
| `construct` | `new` on ordinary application code |
| `call` | plain in-process call |
| `*.helper` | in a channel's package, but performs no operation |

`boundary: true` marks the last thing the type checker can see. The call is
visible; what happens on the other side is not.

### Extending the classifier

`CHANNELS` in `src/classify.mjs` is a project-specific table, not a general truth.
When an integration is added — a new SDK, a new transport — add a channel entry
with its `match` patterns, `remote` flag, and `actions` regexes. Symptom of a
missing entry: real network calls showing up as plain `call` and an empty
`boundaries` list. That is exactly how `http2` (APNs) and `google-auth-library`
(Google Wallet) were initially missed on `syncPass`, and adding them turned up all
four of that flow's real network exits.

## Accuracy

Cross-checked against `grep` on `OfferPassEventService.record`: the tool reported
15 references across 5 files (14 call sites + the declaration); grep found 14 call
sites in the same 4 caller files. Exact match.

Cross-checked against `CLAUDE.md` on `OffersHelper.nurturedOrAppointmentExistsSql`:
the tool returned the three documented `viewOnly` sites —
`offer.repository.ts:827,850` and `offers.service.ts:909,929,934,1351` — and
nothing else.

## What it cannot see

The type checker follows types. Where two pieces of code are joined by a *string*
rather than a type, the graph ends. These are precisely the seams in this stack:

| Seam | Why it is invisible |
|---|---|
| `@RabbitSubscribe` routing keys | producer and consumer share a string, not a type |
| Lambda queue `JOB_TYPES` | the join is an enum value stored in `queue_tasks` |
| HTTP between apps | the contract is a URL |
| `@Inject('XCHANGE_REPOSITORY')` | the token is a string; the factory binds at runtime |
| Dynamic dispatch, `eval`-ish lookups | no static callee |

`boundary: true` is where each of these begins. Joining the far sides needs a
second pass that indexes decorators and string contracts, and matches producers to
consumers by key. That pass is not in this tool.

Two smaller caveats:

- **Reachability, not execution.** An edge means the code *can* call the target,
  not that a given request does. Branches are not evaluated.
- **`--depth` shapes the answer.** Deep traces grow fast (290 edges at depth 6).
  Start at 3–4 and increase only for the branch you care about.

## Not built yet

- Persistent `tsserver` daemon, to amortise the 13 s repo-scope build across many
  queries.
- The decorator/string-contract pass that joins the far side of a `boundary`.
- Direct emission of the schematic `dataflow.schema.json` — currently a separate
  transform step from this JSON.

## Layout

```
tools/dataflow/
├── README.md
├── bin/dataflow.mjs     CLI: arg parsing, heap re-exec, command dispatch
└── src/
    ├── program.mjs      tsconfig load, LanguageService construction, scope handling
    ├── locate.mjs       resolve "Class.method" / line number to a declaration
    ├── trace.mjs        recursive outgoing call graph
    ├── refs.mjs         reverse lookup via getReferencesAtPosition
    └── classify.mjs     channel + action table (the part you will edit)
```
