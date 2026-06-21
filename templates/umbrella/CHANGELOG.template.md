# Changelog — Umbrella

Umbrella-level changes only (infra, env, shared hooks, model list, agentmemory).
Sub-project changes go to that sub-project's own `CHANGELOG.md`. One bullet per
change, focused on **what and why**, grouped under the date. Newest date first.

## <YYYY-MM-DD>
- Stack scaffolded from the microservices + Claude Code + AgentMemory boilerplate.
- AgentMemory wired across all projects (shared hooks, 12-hook block, architecture/parent context injection).
- Applied the local-Ollama compress patch to `agentmemory-src/` (see ADR-0002).
