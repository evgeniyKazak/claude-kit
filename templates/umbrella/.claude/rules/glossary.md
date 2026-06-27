# Glossary

Short definitions of terms used across the stack. One line each. Cross-references: [`../../CLAUDE.md`](../../CLAUDE.md) • [`agentmemory.md`](agentmemory.md)

## Stack-level

- **Umbrella** — the top-level stack directory. Owns `docker-compose.yml`, root env files, shared hooks, `ARCHITECTURE.md`, and stack-wide docs.
- **Sub-project / child** — a service directory with its own `CLAUDE.md` and Claude project context.
- **Stack** — the running set of containers defined in `docker-compose.yml`.
- **Service** — a single entry in `docker-compose.yml`. Corresponds to a `<prefix>-<name>` container.
- **Sibling service** — any other service that a given service may call across the docker network.

## AgentMemory

- **Namespace / `project`** — agentmemory groups observations by the `project` field (= absolute CWD of the Claude session). Each child has its own namespace; the umbrella has another.
- **Observation** — a single captured event (prompt submit, tool use, subagent start/stop). Auto-written by hooks.
- **Capture** — the act of writing an observation (`POST /agentmemory/observe`).
- **Compress** — turning the raw observation payload into a summary. Either `llm` (via the configured provider) or `synthetic` (cheap pattern-based).
- **Compress threshold** — `AGENTMEMORY_COMPRESS_MIN_BYTES`. Payloads below this skip LLM compress and use synthetic.
- **Recall** — querying back. Either explicit (`memory_smart_search`, `memory_search`) or via the session-start context injection.
- **`<architecture-context>`** — static block injected from `ARCHITECTURE.md` at every child SessionStart.
- **`<parent-project-context>`** — dynamic block injected from the umbrella agentmemory namespace at every child SessionStart.
- **Shared hooks** — the scripts in `.claude/shared-hooks/`; per-child wrappers delegate here.

## Workflow vocabulary

- **Plan mode** — Claude Code state in which only the plan file may be edited. Entered via `/plan`, exited via `ExitPlanMode` after user approval.
- **Plan file** — the persistent artifact of plan mode: `.claude/tasks/<YYYY-MM-DD>-<slug>.md` (per scope — umbrella or sub-project). Holds the approved plan and its mandatory `Verification` section.
- **Verification** — the section of a plan listing the concrete checks that confirm success. Required for every non-trivial plan.
- **ADR** — Architecture Decision Record. A short doc capturing the rationale behind one architecturally significant decision. Lives under `.claude/adr/NNNN-slug.md`.
- **Backlog item** — a 1-3 line strategic task in `BACKLOG.md`. Grows into a `ROADMAP.md` section when ready for detailed work.

## Fill in your domain terms below

- **`<entity>`** — `<one-line definition>`
- **`<collection / table>`** — `<one-line definition>`
