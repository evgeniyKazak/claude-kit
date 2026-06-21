# AgentMemory Usage Guide

How to work with the per-project memory system. Cross-references: [`workflow.md`](workflow.md) • [`conventions.md`](conventions.md) • [`security.md`](security.md)

## What you get at SessionStart

Every Claude session inside this stack starts with up to **four** memory layers active:

| Layer | Source | Lifecycle | Content |
|---|---|---|---|
| `<architecture-context>` | `ARCHITECTURE.md` | static, injected each session | top-level topology — services, ports, inter-service URLs |
| `<parent-project-context>` | umbrella `agentmemory` namespace via `POST /agentmemory/context` | dynamic, refreshed each session | recent observations from umbrella-scope work |
| `MEMORY.md` (Claude auto-memory) | `~/.claude/projects/.../memory/` | always-on every turn | operator profile, durable preferences |
| `agentmemory` on-demand recall | agentmemory REST + MCP | searched explicitly | full capture archive across all projects (BM25 + dense vector) |

Children receive the first three layers. Cross-child visibility is intentionally off — children see the umbrella, not each other.

## Where things live

- **`.claude/shared-hooks/`** — single source of truth for hook scripts (`agentmemory-run.sh`, `parent-context.mjs`, `architecture-context.mjs`).
- **Per-child wrappers** — `<service>/.claude/hooks/agentmemory/run.sh` are two-line `exec` wrappers that delegate to the shared runner.
- **`agentmemory.env`** — profile (provider, embeddings, compress flags, bearer).
- **`agentmemory-src/`** — mounted source of our fork of `rohitg00/agentmemory`. Patches documented in ADR-0002 and `CHANGELOG.md`.
- **State** — named volume `agentmemory_data` mounted at `/data` (KV store, stream store, BM25 + vector indexes).

## Git docs vs AgentMemory — what goes where

Both layers exist on purpose. They do not overlap.

| Knowledge type | Where it goes | Why |
|---|---|---|
| Conventions, rules, patterns | `.claude/rules/conventions.md` | Curated, versioned, team-readable |
| Recurring failure modes | `.claude/rules/lessons-learned.md` | Curated; recall is too noisy for hard-won fixes |
| Architectural decisions | `.claude/adr/NNNN-slug.md` | Long-lived rationale, immutable once accepted |
| Stack topology | `ARCHITECTURE.md` | Authoritative source, injected into every session |
| Release-relevant changes | `CHANGELOG.md` | Human changelog, scannable |
| Tool-by-tool history of what you did | AgentMemory (automatic) | Capture is automatic; do not duplicate into docs |
| "When did I do X last week, and how" | AgentMemory recall (`memory_smart_search`) | Semantic search across the capture archive |

**Rule of thumb.** Curated, durable, team-readable knowledge → git. Episodic recall of your own past work → agentmemory. Do not write prose into agentmemory; do not turn rules files into a recall log.

## Cheat-sheet of MCP tools

`AGENTMEMORY_TOOLS=core` exposes a minimal surface:

| Tool | Purpose |
|---|---|
| `memory_smart_search` | Hybrid BM25 + dense vector search. Best default for recall. |
| `memory_search` | Plain BM25 — exact-keyword lookup. |
| `memory_remember` | Explicitly save a fact you want surfaced later. Use sparingly; auto-capture covers most cases. |
| `memory_context` | Compact "what happened recently" block for a project. |
| `memory_forget` | Remove a wrong/stale observation. |
| `memory_sessions` | List recent sessions per project. |

To enable the full surface, set `AGENTMEMORY_TOOLS=all` in `agentmemory.env`. Only do this with a concrete reason — the larger surface fills the MCP slug.

## Common operations

```bash
# Health
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3111/agentmemory/health | jq '{status, version}'

# Write an explicit fact
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sessionId":"manual","project":"<STACK_ROOT>","content":"…"}' \
  http://127.0.0.1:3111/agentmemory/remember

# Semantic search
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"…","project":"<STACK_ROOT>","limit":5}' \
  http://127.0.0.1:3111/agentmemory/smart-search

# Viewer (read-only UI)
open http://127.0.0.1:3111/agentmemory/viewer
```

## Profile reference

Current profile: **balanced** — local embeddings + local LLM compress. Key flags in `agentmemory.env`:

```
EMBEDDING_PROVIDER=openai
OPENAI_BASE_URL=http://ollama:11434/v1      # host.docker.internal on native-Ollama hosts
OPENAI_EMBEDDING_MODEL=mxbai-embed-large
OPENAI_EMBEDDING_DIMENSIONS=1024

OLLAMA_BASE_URL=http://ollama:11434/v1
OLLAMA_MODEL=qwen2.5:3b-instruct
MAX_TOKENS=1024
AGENTMEMORY_AUTO_COMPRESS=true
AGENTMEMORY_COMPRESS_MIN_BYTES=512

AGENTMEMORY_TOOLS=core
AGENTMEMORY_INJECT_CONTEXT=true
CLAUDE_MEMORY_BRIDGE=false
```

## Do / Don't

**Do**
- Ask for recall in plain English ("how did we do X last week") — Claude will hit `memory_smart_search`.
- Use `memory_remember` for facts you specifically want surfaced.
- Trust the SessionStart context injection — `<architecture-context>` and `<parent-project-context>` are both load-bearing.

**Don't**
- Duplicate `lessons-learned.md` content into agentmemory or vice versa.
- Treat `memory_smart_search` as the source of truth for conventions — it shows *episodes*, not *rules*.
- Raise `AGENTMEMORY_TOOLS=all` without a real reason.

## Troubleshooting

- Capture seems empty → `docker logs <agentmemory> | grep "Observation captured" | tail`
- Embeddings disabled → startup log should say `Embedding provider: openai (1024 dims)`; if `BM25-only`, the env didn't apply — recreate (`up -d`), not `restart`
- Compress slow → check `OLLAMA_MODEL`, `MAX_TOKENS=1024`, and that the model is actually loaded (`ollama ps`)
