# Workflow — <Service Name>

## After EVERY Completed Task

1. **CLAUDE.md** — update if files/dirs appeared, focus changed, or a new architectural decision was made.
2. **CHANGELOG.md** — add an entry at the top (`## YYYY-MM-DD` → 1-2 lines per item).
3. **.claude/rules/** — new code convention → `conventions.md`; new domain knowledge → the matching rules file.
4. **lessons-learned.md** — if an error was made, log it immediately (format is in the file).

## Umbrella reporting (architectural changes)

Some changes inside this sub-project also affect the rest of the stack — propagate them to umbrella docs in the **same task**. Internal-only changes (refactors, naming, new conventions, local lessons) stay sub-project-scope.

Update umbrella docs when the change:
- adds, removes, or renames an endpoint, port, or protocol → umbrella `ARCHITECTURE.md`
- introduces new shared data (a table other services read, a new vector collection, a new queue/topic) → umbrella `ARCHITECTURE.md` "Shared data"
- adds a new dependency on a sibling service → umbrella `ARCHITECTURE.md` + note in this `CLAUDE.md`
- requires a new model or ambient infra → umbrella `ollama/entrypoint.sh` + a bullet in umbrella `CHANGELOG.md`
- is architecturally significant → new ADR under umbrella `.claude/adr/NNNN-slug.md`
- obsoletes any line in umbrella `ARCHITECTURE.md` or `CLAUDE.md` → fix it in the same task; stale umbrella docs cascade into every child SessionStart.

Full ownership matrix: umbrella `.claude/rules/subprojects.md`.

## Before Working on a Component
Check `lessons-learned.md` — are there records of previous issues with this component?

## Forbidden
- Do not hardcode connection strings, hostnames, or ports — always read from config.
- Do not commit `.env` files or secrets.
- Do not add logic to `.claude/hooks/agentmemory/run.sh` — it stays a two-line wrapper.
- <Other framework-specific forbiddens.>
