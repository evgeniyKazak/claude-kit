# <Stack Name> — Architecture

> TEMPLATE. This file is injected (truncated to ~1500 tokens) into every child
> Claude session via `architecture-context.mjs`. Keep it accurate and concise —
> stale topology here cascades into every session. Fill the placeholders.

## Topology

```
            ┌──────────────────────────────────────────────┐
            │            <stack-network> (bridge)           │
            │                                               │
  Claude ──▶│  agentmemory (127.0.0.1:3111)                 │
  Code      │  ollama (11434)                               │
  (host)    │  <service-a> (<port>) ──▶ <service-b> (<port>)│
            │  <datastore> (<port>)                         │
            └──────────────────────────────────────────────┘
```

## Services

| Service | Container | Port(s) | Role | Reaches |
|---|---|---|---|---|
| Ollama | `<prefix>-ollama` | 11434 | LLM + embeddings | — |
| AgentMemory | `<prefix>-agentmemory` | 127.0.0.1:3111 / 3112 | Claude memory | ollama |
| `<service-a>` | `<prefix>-<service-a>` | `<port>` | `<role>` | `<peers>` |

## Inter-service URLs

Inside the docker network, address peers by container name:

- `http://<service-a>:<port>/`
- `http://ollama:11434/` (OpenAI-compatible at `/v1`)
- AgentMemory: `http://127.0.0.1:3111/` (host-bound only)
- Native-Ollama hosts (Apple Silicon): `http://host.docker.internal:11434/`

## Shared data

| Store | What | Written by | Read by |
|---|---|---|---|
| `<relational DB>` | `<tables>` | `<service>` | `<service>` |
| `<vector store>` | `<collection>` (dims, metric, model) | `<service>` | `<service>` |
| `<broker>` | `<queues/topics>` | `<producer>` | `<consumer>` |
| `agentmemory_data` volume | observation archive (per-project namespaces) | hooks | recall |

## Secrets

- `.env` — stack-wide (DB, object store, third-party tokens)
- `agentmemory.env` — agentmemory profile + bearer
- per-service credential stores — service-private

## Sub-project details

- **`<service-a>`** — `<one paragraph: stack, entry points, what it persists, who it calls>`
