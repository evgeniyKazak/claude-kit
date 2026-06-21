# ADR-0001 — Adopt AgentMemory (rohitg00/agentmemory) for cross-session recall

- **Status:** Accepted
- **Date:** <YYYY-MM-DD>
- **Decider:** <operator>
- **Related:** ADR-0002, `.claude/rules/agentmemory.md`, CHANGELOG entry

> Worked example. This is the decision that motivates the whole boilerplate —
> kept here as a real ADR you can adapt or replace. Update the date/decider and
> trim anything that doesn't match your stack.

## Context

Claude Code's built-in auto-memory (`MEMORY.md`) covers always-on durable facts (operator profile, preferences) but does not capture episodic detail — what was actually done in a session, which files were touched, which commands ran, what was discovered. Without that capture, every new session re-discovers context that already existed.

A microservices repository spans several logical projects (umbrella + one Claude project per service), often with background runs by sub-agents. The operator needs:

- per-project history isolated by namespace (work in service A should not pollute service B's history)
- cross-project visibility from children into the umbrella ("what was happening in the stack overall while I worked in service A")
- searchable recall — both lexical (exact terms) and semantic (paraphrases, cross-language)
- automatic capture of tool-uses, prompts, subagent activity — no manual journaling

The stack already runs in Docker and a local LLM runtime (Ollama) is available for embeddings.

## Decision

Adopt `rohitg00/agentmemory` as the per-project memory layer for Claude Code sessions in this stack. Deploy it as a long-running container, bound to `127.0.0.1:3111`. Wire every Claude project (umbrella + each child) through:

- `.mcp.json` exposing the agentmemory MCP surface (`AGENTMEMORY_TOOLS=core`)
- `.claude/settings.local.json` with the 12 lifecycle hooks
- a shared hook runner at `.claude/shared-hooks/agentmemory-run.sh` to centralise env injection and script resolution

Use the `project` field of each REST call (= absolute CWD of the session) to keep namespaces isolated. Inject cross-project context into each child SessionStart through two custom hooks:

- `architecture-context.mjs` — static, reads `ARCHITECTURE.md`
- `parent-context.mjs` — dynamic, pulls the umbrella namespace's recent observations

Keep Claude's built-in `MEMORY.md` (always-on durable facts) in parallel — the two cover different layers.

## Consequences

**Positive**

- Every session starts with usable historical context — architecture + recent activity injected automatically.
- Per-project namespaces — work in one service is isolated from another's history.
- Semantic recall across the capture archive via the `memory_smart_search` MCP tool.
- Single source of truth for hooks (`shared-hooks/`) — adding a new child project is three lines in its `settings.local.json`.

**Negative**

- New long-running container, ~200 MB RAM idle.
- A local copy of `agentmemory-src/` mounted from disk. Upstream changes require `npm run build` and may conflict with local patches (see ADR-0002).
- Two parallel memory systems (Claude `MEMORY.md` + agentmemory) — the operator must understand the split (documented in `.claude/rules/agentmemory.md`).
- Hooks fire frequently (~50-100 PostToolUse spawns per active hour) — measurable CPU overhead, but well under saturation.

**Neutral**

- Captures include tool inputs/outputs. Upstream redaction handles obvious secrets; treat as defence-in-depth (see `.claude/rules/security.md`).
- Viewer UI is read-only and bound to localhost — no public exposure concerns.

## Alternatives considered

**Stick with Claude `MEMORY.md` only.** Misses the episodic / search-across-history use case. Its size cap is for always-on facts, not a session archive.

**Custom Postgres + pgvector schema.** More work, no plug-and-play MCP, no out-of-the-box hooks. Pays off only if recall must be shared with non-Claude tools.

**Editor-extension-based memory.** Tied to the editor, not the project. Per-project isolation is harder.

**Off-the-shelf vector DB plus thin shim.** Reinvents what agentmemory already does (hooks, MCP, viewer, profile knobs). Cost-benefit doesn't justify it at personal/team scale.

## Notes

- Day-to-day usage and the git-docs-vs-agentmemory split are documented in [`../rules/agentmemory.md`](../rules/agentmemory.md).
- The compress provider is decided separately in [`0002-local-llm-compress.md`](0002-local-llm-compress.md).
