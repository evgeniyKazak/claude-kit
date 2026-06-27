# Plan files — umbrella

This directory holds the **plan files** the workflow mandate refers to. When a
non-trivial umbrella task enters plan mode (`/plan`), the approved plan is written
here so it persists across the session and anchors "verify-before-done".

## Convention
- One file per task: `<YYYY-MM-DD>-<slug>.md` (kebab-case slug).
- Every plan **must** contain a `## Verification` section — concrete, copy-pasteable checks (what / how / what "pass" looks like). Primitives toolbox: [`../rules/testing.md`](../rules/testing.md).
- Approved by the operator **before** any code or config change.
- After the task is done and verified, keep or delete — operator's choice. AgentMemory captures the tool-by-tool record; this file is the *intent + verification contract*, not a log.

Each sub-project keeps its own `<service>/.claude/tasks/` for sub-project-scope plans.
