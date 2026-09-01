# Umbrella Conventions

Conventions for **umbrella-scope** work: `docker-compose.yml`, root env files, shared hooks, the agentmemory fork, `ARCHITECTURE.md`, local LLM models. Sub-project conventions live in each sub-project's own `.claude/rules/conventions.md`.

Cross-references: [`workflow.md`](workflow.md) • [`security.md`](security.md) • [`agentmemory.md`](agentmemory.md) • [`testing.md`](testing.md) • [`subprojects.md`](subprojects.md)

## Docker Compose

- One stack, one `docker-compose.yml` at the umbrella root. No alternate compose files.
- The `version:` key is obsolete — leave it out.
- Every service has a `container_name: <prefix>-<service>` so commands look the same as in the docs.
- Every long-running service has a `healthcheck` block. Health is what `docker compose up -d --wait` and the verification primitives rely on.
- Sensitive services (agentmemory) bind to `127.0.0.1:<port>`, never `0.0.0.0`. Cross-service traffic uses the docker network, not the host.
- Use named volumes for state and bind-mounts only for source-in-development and a shared `data/` tree.

## Env files

- One `.env` for general stack secrets, loaded by every service that needs it via `env_file:`.
- One `agentmemory.env` for the agentmemory profile, mounted exclusively to the agentmemory container.
- **`docker compose restart <svc>` does NOT reread `env_file:`.** After editing an env file, use `docker compose up -d <svc>` to recreate. See [`lessons-learned.md`](lessons-learned.md).
- Comments in env files explain *why* a value matters (which feature it gates), not what the variable name already says.

## Inter-service URLs

- Inside the docker network, use container names: `<service>:<port>`.
- `127.0.0.1` host addressing is for: agentmemory REST reached from Claude Code on the host, the viewer UI, and host-shell debugging.
- `localhost` is forbidden in service configs — inside a container it resolves to the container itself, not the stack.
- When a local LLM runs natively on the host (Apple Silicon) instead of in a container, peers reach it via `host.docker.internal:<port>` — the one sanctioned exception to the container-name rule.

## Shared hooks

- All AgentMemory hooks live in `.claude/shared-hooks/`. Per-child `<service>/.claude/hooks/agentmemory/run.sh` files are thin two-line wrappers that `exec` the shared runner.
- The shared runner resolves the hook script in two places: `agentmemory-src/plugin/scripts/<name>` (upstream) then `.claude/shared-hooks/<name>` (ours). Add umbrella-only hooks (`parent-context.mjs`, `architecture-context.mjs`) to the shared directory only.
- Hooks export `AGENTMEMORY_URL` / `AGENTMEMORY_SECRET` / `AGENTMEMORY_INJECT_CONTEXT` themselves. Do not rely on the calling shell.

## AgentMemory fork policy

- Source mounted from `agentmemory-src/` as a read-only volume. Rebuild via `npm run build` inside the source dir; the container picks up the new `dist/` after `docker compose up -d agentmemory`.
- Keep local patches minimal and surgical so an upstream `git pull` stays a routine merge.
- Track every local patch in `CHANGELOG.md` and either an ADR or `BACKLOG.md` so future-you knows what to re-apply.

## Local LLM models

- Models that a service depends on in production go in the model auto-pull list (`ollama/entrypoint.sh`) so they survive volume recreation — a manual `ollama pull` is a setup convenience, not a guarantee.
- Tag every model with its exact variant (`qwen2.5:3b-instruct`, not `qwen2.5:3b`). The missing suffix resolves to "latest" and may differ from what you tested against.
- When a GPU is shared between consumers, rely on the runtime's keep-alive to swap models in/out. Don't raise keep-alive system-wide if it starves another consumer.

## Diagrams (archify)

- **archify** is the standard tool for every visual schema in the stack: project architecture, API contracts, DB relations, cross-service flows. No hand-drawn HTML/SVG. It is installed once at the umbrella (`<STACK_ROOT>/.claude/skills/archify`, via `npx skills add tt-a1i/archify` — see `SETUP.md`); sub-project sessions invoke it as `node <STACK_ROOT>/.claude/skills/archify/bin/archify.mjs`.
- Diagram HTML lives in a dedicated folder: `<STACK_ROOT>/diagrams/` at umbrella scope, `<service>/diagrams/` at sub-project scope. Nothing but archify-delivered HTML goes in those folders.
- **Schema-update contract.** Every time a schema is created or updated:
  1. deliver/refresh the archify HTML into `diagrams/`;
  2. create/update its **companion `.md`** (same basename, next to the docs it serves) — what the schema shows, the key relationships/contracts, and a link to the HTML. The `.md` is the knowledge surface Claude reads; the HTML is the visual artifact;
  3. link the companion `.md` from the main documentation — `ARCHITECTURE.md` at umbrella scope, `CLAUDE.md` / `API.md` at sub-project scope.
  An updated schema without an updated `.md` and doc link is an unfinished task.
- Placement exception: flow-explainer narratives stay in `data-flows/` (that agent's deliverable surface) and link their HTML in `diagrams/`.
- **lavish** (`npx -y lavish-axi <file>.html`, installed via `npx skills add kunchenguid/lavish-axi --skill lavish`) is the review medium for HTML artifacts — plans and diagrams are discussed and approved there, not described in prose. See [`workflow.md`](workflow.md) for the planning loop.

## Documentation

- English. All `.md` files in this repository are English.
- Each `.claude/rules/*.md` cross-links to its closest siblings and to `CLAUDE.md`. A broken `[]()` link is treated as a bug.
- Section ordering inside `CLAUDE.md` follows a predictable pattern (About → Status → Key Rules → Project Rules → Stack / Sub-projects → Common Commands → After Task → Forbidden).

## File ownership

- `CLAUDE.md`, `CHANGELOG.md`, `BACKLOG.md`, `ARCHITECTURE.md`, `ROADMAP*.md` — umbrella-owned, edit only at umbrella scope.
- `<service>/CLAUDE.md`, `<service>/CHANGELOG.md`, `<service>/.claude/rules/*` — sub-project-owned.
- Files in `agentmemory-src/` — upstream code we forked; patches documented in `CHANGELOG.md` and ADR-0002.

Full ownership matrix and the standard every sub-project must follow: [`subprojects.md`](subprojects.md).

## Forbidden

- Hardcoding any URL, port, or credential that has an env or container-name alternative.
- Adding a new top-level `.md` file under the umbrella root without referencing it from `CLAUDE.md`.
- Changing shared-hooks behaviour silently — update `agentmemory.md` and `CHANGELOG.md` whenever the hook contract changes.
- Editing `agentmemory-src/` without leaving a CHANGELOG entry and an ADR or backlog item.
