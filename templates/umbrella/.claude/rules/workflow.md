# Umbrella Workflow

How to run a task at umbrella scope from intent to "done". Cross-references: [`conventions.md`](conventions.md) • [`testing.md`](testing.md) • [`agentmemory.md`](agentmemory.md) • [`lessons-learned.md`](lessons-learned.md)

## The mandate

1. **Plan with lavish, not plan mode.** Every non-trivial task starts with a full project analysis based on the existing docs (`CLAUDE.md`, `ARCHITECTURE.md`, `.claude/rules/`, `data-flows/`, `diagrams/`). The plan is authored as an **HTML artifact that explains as much as possible visually** — archify diagrams, block schemes, graphs — and reviewed in **lavish** (see "The lavish planning loop" below). The approved plan is then recorded in a plan file (`.claude/tasks/<YYYY-MM-DD>-<slug>.md`, see `.claude/tasks/README.md`) that links the lavish artifact. No code or config changes before approval.
2. **Plan defines verification.** The plan **must** include a `Verification` section listing the concrete checks that confirm success. If verification is missing, the plan is not finished.
3. **Verify before done.** A task is complete only when the Verification section has been executed and the results reported. No "should work — declaring done" shortcuts.

These three are non-negotiable. The rest of this file is the supporting checklist.

## The lavish planning loop

The [lavish](https://github.com/kunchenguid/lavish-axi) skill replaces Claude Code plan mode for this stack:

1. **Analyze** — read the docs above end-to-end; recall relevant history via agentmemory.
2. **Author** — draft the plan as a self-contained HTML artifact next to the plan file (`.claude/tasks/<YYYY-MM-DD>-<slug>.html`). Visual-first: archify diagrams for architecture / API-contract / DB impact, block schemes for step ordering, tables for risks and effort. Prose only where a picture can't carry it.
3. **Review** — open it for the operator: `npx -y lavish-axi .claude/tasks/<YYYY-MM-DD>-<slug>.html`. The operator annotates elements and diagrams in the browser; collect the feedback (`npx -y lavish-axi poll`), revise the artifact, repeat.
4. **Approve** — only an explicit operator approval (in lavish or in chat) finalizes the plan. Then write/refresh the plan file with its `Verification` section and a link to the HTML artifact, and start implementing.

## What counts as "non-trivial"

Trivial (no plan needed):
- Typo fix in a doc
- Single-line config rename
- Adding one already-permitted permission to `settings.local.json`
- Running a read-only diagnostic

Non-trivial (plan required):
- Anything touching `docker-compose.yml`, env files, or shared hooks
- Adding a new sub-project rule file
- Patching `agentmemory-src/`
- A change that affects more than one sub-project
- A change with any risk of breaking a running background/cron job

When in doubt, default to a lavish plan. The cost is small.

## During the task

- AgentMemory captures tool-uses, prompts, and outcomes automatically — do not narrate this into docs.
- When something surprises you (a config silently ignored, a container behaving unexpectedly), grab the exact reproduction now — you'll write the `lessons-learned.md` entry at the end.
- If the plan turns out wrong mid-execution, stop and either fix the plan file or reopen the lavish artifact and re-plan. Do not "improvise around" an approved plan silently.

## Verification

Run the Verification section from the plan. The toolbox of primitives lives in [`testing.md`](testing.md) — most umbrella tasks compose 3-6 of those: compose healthcheck, log tail, REST probe, agentmemory smoke write, viewer check. Verification output goes into the task report. If a check failed, the task is not done — either fix and rerun, or escalate by amending the plan.

## After EVERY Completed Task

Walk the checklist and update whatever was actually affected.

1. **`CLAUDE.md`** — stack composition changed (new container, removed service, new shared file at root), a key rule was added/revised, or a new sub-project was added.
2. **`ARCHITECTURE.md`** — new service in compose, a port changed, or a new inter-service protocol/endpoint was introduced.
3. **`CHANGELOG.md`** — append every umbrella-level change. One bullet per change, focused on what and why, grouped under today's date. Sub-project changes go to that sub-project's CHANGELOG.
4. **`BACKLOG.md`** — closed an item → strike/remove; new strategic task → append (1-3 lines).
5. **`.claude/rules/conventions.md`** — a new umbrella convention was discovered or contradicted.
6. **`.claude/rules/lessons-learned.md`** — a non-trivial error happened that could recur (use the entry format in the file).
7. **`.claude/rules/testing.md`** — a new verification primitive was added.
8. **`.claude/rules/security.md`** — secret handling, host binding, or hardening guidance changed.
9. **`.claude/adr/`** — an architecturally significant decision was made (new `NNNN-slug.md`).
10. **`diagrams/`** — a schema (architecture, API contract, DB relations, cross-service flow) was created or changed → refresh the archify HTML in `diagrams/`, update its companion `.md`, and keep the link from the main docs. See the Diagrams convention in [`conventions.md`](conventions.md).
11. **Sub-projects** — if the task crossed into a sub-project, follow that sub-project's own checklist — do not write into their files from umbrella scope.

## Forbidden

- Starting a non-trivial task without a plan.
- Declaring "done" without running verification.
- Writing the same fact into both `CHANGELOG.md` and `lessons-learned.md` (changelog = what shipped; lessons = what could trip us again).
- Adding `lessons-learned.md` entries for trivial slips — AgentMemory recall covers those.
- Skipping the `ARCHITECTURE.md` update when a port or container changed — broken topology docs cascade into every child SessionStart.
- Updating a schema without refreshing its archify HTML in `diagrams/`, its companion `.md`, and the doc link.
