# <Stack Name> — Umbrella

> TEMPLATE. Fill the angle-bracket placeholders from real project data. Keep the
> section order — it's what the sub-project standard and operator muscle memory
> expect. Delete this quote block when done.

## About
<One paragraph: what this stack is, the services it hosts, and that each runnable
application lives in its own sub-directory with its own `CLAUDE.md`. This file is
the entry point for umbrella-level work — infrastructure, cross-service wiring,
env files, shared docs, stack-wide decisions.>

## Current Status
**Focus:** <one or two lines on the current stack-wide focus.>

## Key Rules
1. **English-only documentation.** All `.md` files in this repo are English.
2. **Start every non-trivial task in plan mode.** Use `/plan`; the plan must include a `Verification` section; `ExitPlanMode` only after the operator approves.
3. **Verification before "done".** A task is not complete until the plan's Verification section has been executed and reported.
4. **Umbrella vs sub-project scope.** Service-specific code/conventions live in that service's directory. The umbrella owns `docker-compose.yml`, `.env`, `agentmemory.env`, `ARCHITECTURE.md`, shared hooks, the model list, cross-service infra.
5. **Inter-service URLs use container names** (`<service>:<port>`) inside the docker network. `127.0.0.1` is reserved for host-bound services (agentmemory REST on `3111`).
6. **Secrets never inline.** All credentials read from `.env`, `agentmemory.env`, or a service's own credential store. See `.claude/rules/security.md`.

## Project Rules
Detailed rules in `.claude/rules/`:
- `conventions.md` — umbrella coding/config conventions
- `workflow.md` — operator workflow, plan-mode mandate, post-task checklist
- `subprojects.md` — required structure of every sub-project; checklist for adding one
- `testing.md` — verification primitives and strategy
- `security.md` — secrets, host bindings, redaction
- `agentmemory.md` — how to work with the per-project memory system
- `glossary.md` — terms used across the stack

Architecture Decision Records: `.claude/adr/`.

## Stack at a Glance
Full topology, ports, and inter-service URLs: see [`ARCHITECTURE.md`](ARCHITECTURE.md).

| Service | Container | Port | Role |
|---|---|---|---|
| Ollama | `<prefix>-ollama` | 11434 | Local LLM + embeddings |
| AgentMemory | `<prefix>-agentmemory` | 127.0.0.1:3111 | Per-project Claude memory |
| `<service>` | `<prefix>-<service>` | `<port>` | `<role>` |

## Sub-projects
Each service has its own Claude project context — read the local `CLAUDE.md` for code-level details.

- **`<service>`** — `<one line>`. [`<service>/CLAUDE.md`](<service>/CLAUDE.md)

## Common Commands

```bash
docker compose up -d                 # bring the stack up
docker compose up -d <service>       # recreate one service after editing its env_file
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3111/agentmemory/health
docker exec <prefix>-ollama ollama list
```

## After Completing a Task
Update only what changed:
- [ ] **`CLAUDE.md`** — stack composition, key rules, or sub-project list changed
- [ ] **`ARCHITECTURE.md`** — new service, port, or inter-service protocol
- [ ] **`CHANGELOG.md`** — every umbrella-level change
- [ ] **`BACKLOG.md`** — a strategic task appeared or closed
- [ ] **`.claude/rules/*`** — a new convention / lesson / verification primitive / security rule
- [ ] **`.claude/adr/`** — an architecturally significant decision
- [ ] **Sub-project docs** — when the task crossed into a sub-project, follow its own checklist

## Forbidden
- Do not start a non-trivial task without `/plan`.
- Do not declare a task done without running its Verification section.
- Do not write umbrella docs in any language but English.
- Do not commit secrets.
- Do not bypass the shared-hooks system — per-child wrappers must delegate to `.claude/shared-hooks/agentmemory-run.sh`.
