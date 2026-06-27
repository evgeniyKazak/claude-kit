# Sources & MCP — <Service Name>

> TEMPLATE. List the data sources and MCP servers **this service** actually has,
> and how to use each well. Keep it to what's wired in `.mcp.json` plus the
> datastores this service reads/writes. The cross-stack catalog (every service,
> every shared store) lives in the umbrella `ARCHITECTURE.md`, which is injected
> into this session as `<architecture-context>` — don't duplicate it here, point
> to it.

Cross-references: [`conventions.md`](conventions.md) • [`agentmemory` usage](../../../.claude/rules/agentmemory.md) • umbrella [`ARCHITECTURE.md`](../../../ARCHITECTURE.md)

## MCP servers (from `.mcp.json`)

| Server | Purpose | Use it for | Don't |
|---|---|---|---|
| `agentmemory` | recall of past work (BM25 + dense) | "how did we do X before", finding a file touched N sessions ago | storing curated rules — those go in `.claude/rules/` |
| `<service-mcp>` | `<what it exposes>` | `<the good-fit queries>` | `<anti-patterns>` |

- `agentmemory` is on `AGENTMEMORY_TOOLS=core` (6 tools). Prefer `memory_smart_search` for recall; `memory_remember` only for a fact you specifically want surfaced later. Full split of git-docs vs recall: umbrella [`agentmemory.md`](../../../.claude/rules/agentmemory.md).
- Add a service-specific MCP server by extending `.mcp.json` (keep `agentmemory` first in `enabledMcpjsonServers`). New server → add a row here and a note in the umbrella `ARCHITECTURE.md`.

## Data sources (datastores this service touches)

| Store | Access | Read / Write | Notes |
|---|---|---|---|
| `<relational DB>` | `docker exec <prefix>-<db> psql …` or the service's client | `<R / W>` | Read-only ad-hoc queries are fine; **writes/DDL need plan mode** (see [`workflow.md`](workflow.md)). |
| `<vector store>` | `<client / HTTP>` | `<R / W>` | `<collection, dims, metric, embedding model>` |

Inter-service URLs use container names (`http://<peer>:<port>`), never `localhost`. The authoritative topology + shared-data ownership is the umbrella `ARCHITECTURE.md`.

## Rules
- This file lists **how to use** sources; it is not the topology source of truth — that's the umbrella `ARCHITECTURE.md`. If they disagree, ARCHITECTURE wins; fix this file.
- Never embed credentials here. Secrets come from `.env` / the service's credential store (see umbrella [`security.md`](../../../.claude/rules/security.md)).
