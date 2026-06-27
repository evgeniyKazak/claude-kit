# Plan files — <Service Name>

This directory holds the **plan files** the workflow mandate refers to. When a
non-trivial task enters plan mode (`/plan`), the approved plan is written here as
a persistent artifact so it survives the session and can be checked against at
"verify-before-done" time.

## Convention
- One file per task: `<YYYY-MM-DD>-<slug>.md` (kebab-case slug).
- Every plan **must** contain a `## Verification` section — concrete, copy-pasteable checks (what / how / what "pass" looks like). A plan without it is unfinished. See [`../rules/testing.md`](../rules/testing.md) for the primitives.
- The plan is approved by the operator **before** any code or config change.
- After the task is done and verified, the plan file may be deleted or kept for history — operator's choice. AgentMemory already captures the tool-by-tool record, so this file is the *intent + verification contract*, not a log.

## Not for
- Application code, notes that belong in `CHANGELOG.md`, or curated rules (those go in `.claude/rules/`).
