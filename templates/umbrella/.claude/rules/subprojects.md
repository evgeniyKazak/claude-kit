# Sub-project Standard

What every sub-project must have, how it wires into the umbrella, and how to add a new one without drifting from the pattern.

Cross-references: [`conventions.md`](conventions.md) • [`workflow.md`](workflow.md) • [`agentmemory.md`](agentmemory.md) • [`security.md`](security.md) • [`../../CLAUDE.md`](../../CLAUDE.md) • [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)

## What a sub-project is

A directory under the umbrella that:

1. Contains a runnable service that is part of the stack.
2. Has its own `CLAUDE.md` and is treated as its own Claude project for AgentMemory namespace isolation.
3. Owns its source code, its `CHANGELOG.md`, its conventions, and its lessons-learned.
4. Wires into the umbrella through the shared hook runner — never reinvents the AgentMemory integration locally.

Counter-examples — **not** sub-projects: vendored upstream code (`agentmemory-src/`), config-only directories for containers without operator-facing code, and shared resource trees (`scripts/`, `logs/`, `data/`).

## Required structure

Every sub-project has these files. Same layout everywhere so operator muscle memory transfers.

```
<service>/
├── CLAUDE.md                 # entry point — see "CLAUDE.md required sections"
├── CHANGELOG.md              # sub-project-scope changes only
├── .gitignore                # never commit .env / secrets
├── .mcp.json                 # MCP servers — must include agentmemory
├── data-flows/               # flow-explainer agent output (one .md per documented flow)
│   └── README.md
├── diagrams/                 # archify HTML schemas + companion .md per schema
└── .claude/
    ├── settings.local.json   # local overrides — must include the full 12-hook block
    ├── hooks/
    │   └── agentmemory/
    │       └── run.sh        # thin two-line wrapper
    ├── agents/
    │   └── flow-explainer.md # required cross-project agent
    ├── tasks/
    │   └── README.md         # plan files (one per non-trivial task)
    └── rules/
        ├── conventions.md
        ├── workflow.md       # must carry the workflow mandate (see below)
        ├── testing.md        # service test commands + how to verify a change
        ├── sources.md        # this service's MCP servers + data sources, and how to use them
        └── lessons-learned.md
```

Optional (add when earned): `API.md` (required if reached over HTTP by other services), additional `.claude/agents/`, `.claude/skills/`, `<service>/.env(.example)`.

## `CLAUDE.md` required sections

Mirror the umbrella `CLAUDE.md` shape. Required section order:

1. `## About` — what the service does, what tech, where it sits in the stack.
2. `## Sub-project Context` — "this lives inside the umbrella stack, own conventions, own agentmemory namespace, parent-context block is injected."
3. `## Current Status` — one line on focus.
4. `## Key Rules` — the top 5-10 rules that override umbrella defaults.
5. `## Project Rules` — link to `.claude/rules/`.
6. `## Common Commands` — copy-paste-ready commands.
7. `## Project Structure` — directory tree with role comments.
8. `## After Completing a Task` — checklist with what to update.

## Required wiring

### `.mcp.json`
Must include `agentmemory` (REST URL, bearer, `AGENTMEMORY_TOOLS=core`). Additional MCP servers go alongside it.

### `.claude/settings.local.json`
Must have:
- `enableAllProjectMcpServers: true`
- `enabledMcpjsonServers: ["agentmemory", …]` with `agentmemory` present
- a `hooks` block with **all 12 hook points** (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Notification`, `TaskCompleted`, `Stop`, `SessionEnd`) — each pointing at `$CLAUDE_PROJECT_DIR/.claude/hooks/agentmemory/run.sh <script>.mjs`
- the SessionStart hook chain ordered: `session-start.mjs` → `architecture-context.mjs` → `parent-context.mjs`
- `PreToolUse` matcher `Edit|Write|Read|Glob|Grep`

### Sub-project workflow mandate
`<service>/.claude/rules/workflow.md` **must** carry the workflow mandate, mandatory for every task in the service: (1) lavish-plan-first on non-trivial tasks (visual HTML plan reviewed and approved via `npx -y lavish-axi`, then recorded in a plan file with a `Verification` section), (2) verify-before-done, (3) capture non-trivial failures in `lessons-learned.md`. A sub-project may add steps and its own "non-trivial" examples, but cannot drop the mandate. Surface rule (1) as a top `Key Rule` in `<service>/CLAUDE.md` so it lands in always-loaded context.

### Hook wrapper
`<service>/.claude/hooks/agentmemory/run.sh` is a **two-line** wrapper that `exec`s `<STACK_ROOT>/.claude/shared-hooks/agentmemory-run.sh "$@"`. Must be `chmod +x`. No logic locally — all logic is in the shared runner.

### Required agents
`<service>/.claude/agents/flow-explainer.md` is mandatory, adapted to the service's stack. Shared contract:
- YAML frontmatter `name: flow-explainer`, one-sentence description, `tools: Read, Grep, Glob, Bash, Write, TodoWrite`.
- 10-phase workflow: Orient → Discover entry points → Trace execution → Map persistence → Map outbound calls → Build diagram → Self-check → Present for review → Iterate → Save.
- Hard rules: English-only output; never write application code; trace by reading source; one Markdown artifact per approved flow saved to `<service>/data-flows/` plus its archify HTML diagram in `<service>/diagrams/`; explicit user approval before saving.
- A `Project Quick Reference` describing the service's modules, entry points, and conventions.
- Boundary discipline: the sub-project agent stops at calls leaving the container. Cross-service flows belong to the umbrella `flow-explainer` and umbrella `data-flows/`.

### `data-flows/` directory
Holds the artifacts produced by the service's `flow-explainer`. One Markdown file per flow. A `README.md` describes purpose, naming (`<domain>-<flow-name>.md`, kebab-case, no dates), and what does/doesn't belong there. Do not hand-author files here — the agent produces them. The folder is the deliverable surface of the agent.

## File ownership matrix

| Path pattern | Owner | Edit when |
|---|---|---|
| `CLAUDE.md`, `ARCHITECTURE.md`, `ROADMAP*.md`, `BACKLOG.md`, `CHANGELOG.md` (root) | umbrella | working at umbrella scope |
| `.claude/rules/*.md`, `.claude/adr/*.md` (root) | umbrella | umbrella rules / decisions change |
| `.claude/shared-hooks/*` | umbrella | hook contract changes (update `agentmemory.md` + CHANGELOG together) |
| `agentmemory.env`, `agentmemory-src/`, `agentmemory.iii-config.yaml` | umbrella | agentmemory profile / patch changes |
| `.env`, `docker-compose.yml`, `ollama/entrypoint.sh` | umbrella | stack infra changes |
| `<service>/CLAUDE.md`, `<service>/CHANGELOG.md` | sub-project | working in that sub-project |
| `<service>/.claude/rules/*.md` | sub-project | sub-project conventions / lessons change |
| `<service>/.claude/settings.local.json` | sub-project | new permission or hook change (hook block stays in sync with the standard) |
| `<service>/.mcp.json` | sub-project | adding a sub-project-specific MCP server |
| `<service>/.claude/hooks/agentmemory/run.sh` | sub-project (content fixed) | only when the shared-hooks path moves |
| sub-project source | sub-project | application work |

## Adding a new sub-project — checklist

1. **Create the directory** under the umbrella. Short, lowercase name, no spaces.
2. **Write the service code** (Dockerfile, app, dependencies).
3. **Add a service entry to `docker-compose.yml`** with `container_name`, healthcheck, named volume(s), and join the stack network.
4. **Create `<service>/CLAUDE.md`** following the required section order.
5. **Create `<service>/CHANGELOG.md`** with a header and a "Service scaffolded." entry.
6. **Copy the `.claude/` skeleton** from `templates/subproject/` (or the closest sibling): settings, the two-line hook wrapper (`chmod +x`), `rules/` (rewrite content — don't ship someone else's `lessons-learned.md`; ensure `workflow.md` carries the workflow mandate above), and `agents/flow-explainer.md` (adapt description, entry-point semantics, persistence stores, boundary line, and Project Quick Reference to the new stack). **Adopting an existing service** (it already has a `CLAUDE.md` / `workflow.md`)? **Merge**, don't overwrite — preserve existing content, layer in the standard, and add the mandate if missing.
7. **Create `<service>/.mcp.json`** — include the `agentmemory` block; add service-specific MCP servers if needed.
8. **Create `<service>/data-flows/README.md`** — rewrite the "what does/doesn't go here" for the new service. Leave the directory otherwise empty. Create an empty `<service>/diagrams/` for archify output.
9. **Update umbrella `CLAUDE.md`** — add a bullet under "Sub-projects".
10. **Update `ARCHITECTURE.md`** — add the service to the table, inter-service URLs, and a details entry.
11. **Update umbrella `CHANGELOG.md`** — log the scaffolding.
12. **Update `ollama/entrypoint.sh`** if the service needs a new model.
13. **Verify** — start the container, confirm healthcheck, open a Claude session inside the new sub-project, check SessionStart shows `<architecture-context>` + `<parent-project-context>`, smoke-write to agentmemory, see the namespace via `/agentmemory/sessions`, confirm the `flow-explainer` agent loads and `data-flows/` exists.

## Reporting upstream — when sub-project work touches umbrella

Sub-projects own their internals. Some changes ripple out and **must** be reflected in umbrella docs in the same task. Propagate when the change:

- adds/removes/renames an endpoint, port, or protocol → `ARCHITECTURE.md`
- introduces new shared data (a table other services read, a new vector collection, a new queue/topic) → `ARCHITECTURE.md` "Shared data"
- adds a new dependency on a sibling service or external API → `ARCHITECTURE.md` inter-service URLs + note in the sub-project's `CLAUDE.md`
- requires a new model or ambient infra → `ollama/entrypoint.sh` + a `CHANGELOG.md` bullet
- is architecturally significant → new ADR under `.claude/adr/NNNN-slug.md`
- obsoletes any line in `ARCHITECTURE.md` or umbrella `CLAUDE.md` → fix the umbrella doc in the same task; stale umbrella docs cascade into every child SessionStart.

Refactors, internal renames, language-specific patterns, and sub-project-local lessons stay inside the sub-project.

## When sub-projects should NOT diverge

These are umbrella contracts:

- **Sub-project workflow mandate.** Every `<service>/.claude/rules/workflow.md` carries the lavish-plan-first (non-trivial) + verify-before-done mandate, mandatory for every task. A sub-project may add steps but cannot drop the mandate.
- **`flow-explainer` agent contract.** The 10-phase workflow, hard rules, and the "md to `data-flows/`, archify HTML to `diagrams/`" output are non-negotiable. Extend the Project Quick Reference, but don't remove a phase or change the output directories.
- **Diagrams convention.** archify HTML in `diagrams/`, a companion `.md` per schema, linked from the main docs — see the Diagrams section in [`conventions.md`](conventions.md). A sub-project doesn't invent its own diagram tooling or folders.
- **`data-flows/` deliverable surface.** Agent-produced files only — no hand-written entries, no overlap with `API.md` or rules.
- **Hook wrapper logic.** All behaviour lives in the shared runner. Local wrapper stays two lines.
- **Hook order at SessionStart.** Always `session-start.mjs` → `architecture-context.mjs` → `parent-context.mjs`.
- **AgentMemory bearer.** Lives in `agentmemory.env` and the shared runner. A sub-project never embeds its own bearer.
- **`AGENTMEMORY_TOOLS=core`.** Sub-projects do not unilaterally jump to `"all"`.
- **`parent-context` source.** Always the umbrella. Cross-child visibility is off by design.
- **`enabledMcpjsonServers` must include `"agentmemory"`.**
- **English-only docs.**

## When sub-projects ARE free to differ

- Code conventions specific to the language/framework.
- The set of `settings.local.json` `permissions.allow` entries.
- Additional `.claude/` subdirectories (`agents/`, `skills/`, `tasks/`).
- `API.md` content and shape.
- `CHANGELOG.md` rhythm and granularity.
- Sub-project-private secrets (`<service>/.env`).

## Forbidden

- Editing a sub-project's files from umbrella scope without acknowledging its conventions.
- Adding logic to `<service>/.claude/hooks/agentmemory/run.sh` — wrapper stays two lines.
- Copy-pasting another sub-project's `lessons-learned.md` content into a new sub-project.
- Skipping any of the 12 hook entries because "this sub-project doesn't use subagents" — keep all twelve; unused ones are no-ops.
- Treating a new top-level directory as a sub-project without going through the checklist.
