# Workflow — <Service Name>

## The mandate (applies to EVERY task in this sub-project)

Non-negotiable. Every task touched inside this service follows these — no "it's small" shortcuts.

1. **Plan first on non-trivial tasks.** Any non-trivial change enters plan mode (`/plan`); the plan is written to a plan file (`.claude/tasks/<YYYY-MM-DD>-<slug>.md`, see [`../tasks/README.md`](../tasks/README.md)) and approved by the operator before any code or config change, and **must** include a `Verification` section.
2. **Verify before done.** A task is complete only when its Verification section has been executed and the results reported. No "should work — declaring done".
3. **Capture lessons.** A non-trivial failure gets a `lessons-learned.md` entry the moment it happens.

### What counts as non-trivial (plan required)
- Anything touching source other modules import, the service's public API/endpoints, DB schema, or container/build config.
- A change that affects a sibling service or any umbrella doc.
- Anything that could break a running pipeline, endpoint, or scheduled job.

### Trivial (no plan needed)
- Typo / comment fix, a single-line config rename, adding one already-permitted permission, a read-only diagnostic.

When in doubt, default to plan mode — the cost is small.

## Verification

Run the `Verification` section from the plan before declaring the task done — this is the executable half of mandate rule (2), not an afterthought. For a sub-project that usually means 2-5 concrete, copy-pasteable checks, each naming **what** is asserted, **how** to check it, and **what "pass" looks like**:

- the service's own tests in its container — `docker exec <prefix>-<service> <test command>`;
- a health/smoke probe of the changed surface — `curl -s http://localhost:<port>/<health-path>` → expected status/body;
- container came up clean after the change — `docker logs --since 30s <prefix>-<service>` → no errors.

Service-level detail (where tests live, the exact command, the bar for "needs a test") is in [`testing.md`](testing.md); the stack-wide primitives toolbox is in umbrella `.claude/rules/testing.md`. Verification output goes into the task report. If a check fails, the task is **not** done — fix and rerun, or re-enter plan mode and amend the plan. "Build passed" is not verification.

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
