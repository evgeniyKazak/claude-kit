# Testing & Verification

How umbrella-scope work is verified. Cross-references: [`workflow.md`](workflow.md) • [`conventions.md`](conventions.md) • [`agentmemory.md`](agentmemory.md)

## Philosophy

**Each plan defines its own Verification section.** This file is a *toolbox*, not a script — pick the primitives the plan calls for, compose them, run them.

The mandate from [`workflow.md`](workflow.md): a task is not done until its Verification section has been executed and the results reported. If a plan came back without a Verification section, the plan was incomplete — fix the plan before continuing.

Umbrella-scope testing is **integration** testing of the stack. Sub-project unit tests live in each sub-project. Do not write unit tests at the umbrella level.

## What a good Verification section looks like

Three to seven concrete, copy-pasteable checks. Each names:

- **What** is being checked (the assertion).
- **How** to check it (the command or URL).
- **What "pass" looks like** (expected output or status).

Bad: "Make sure agentmemory still works."
Good: `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3111/agentmemory/health` → `status: "healthy"`.

## Verification primitives toolbox

### Compose & containers

| Check | How |
|---|---|
| Container is healthy | `docker compose ps <svc>` → status `running (healthy)` |
| Container started cleanly | `docker logs --since 30s <container>` → no `[ERROR]`, no `panic:` |
| Env file applied | `docker exec <container> env \| grep <VAR>` after `docker compose up -d <svc>` |
| Volume mounted | `docker exec <container> ls /data` (or equivalent path) |

### REST health probes

| Service | Probe | Pass |
|---|---|---|
| AgentMemory | `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3111/agentmemory/health` | `status: "healthy"`, `connectionState: "connected"` |
| Ollama | `curl -s http://localhost:11434/api/version` | JSON `version` |
| `<your service>` | `curl -s http://localhost:<port>/<health-path>` | `<expected>` |

### AgentMemory smoke tests

| Check | How |
|---|---|
| LLM provider active | startup log names the configured provider/model |
| Embedding provider active | startup log says `Embedding provider: openai (1024 dims)` (not `BM25-only`) |
| Hybrid search active | startup log `Ready. Triple-stream (BM25+Vector+Graph) search active.` |
| Write reaches the store | `POST /agentmemory/remember`, then look for `Observation captured` in logs |
| Compress path is "llm" for big payloads | post a >512 byte observation, check log says `"compress":"llm"` |
| Compress path is "synthetic" for small payloads | post a <512 byte observation, check log says `"compress":"synthetic"` |
| Per-project namespaces visible | `/agentmemory/sessions?limit=500`, group by `project` field |

### Ollama checks

| Check | How |
|---|---|
| Model installed | `docker exec <ollama> ollama list \| grep <model>` (or `ollama list` on a native host) |
| Model loaded | `ollama ps` |
| OpenAI-compatible embeddings | `curl -s -X POST <ollama>/v1/embeddings -d '{"model":"mxbai-embed-large","input":"test"}' \| jq '.data[0].embedding \| length'` → `1024` |
| OpenAI-compatible chat | `curl -s -X POST <ollama>/v1/chat/completions -d '{"model":"<model>","messages":[{"role":"user","content":"ping"}],"max_tokens":10}'` |

### Documentation sanity (tasks that touch `.md`)

| Check | How |
|---|---|
| Linkrot | `grep -rE '\]\(' <changed-md-files>` then verify each relative target exists |
| `ARCHITECTURE.md` matches reality | Read the topology doc, then `docker compose ps` — every container in ARCHITECTURE is running, every running container is in ARCHITECTURE |

## Anti-patterns

- "Tests passed locally, declaring done" — verification must be runnable from the plan as-is by anyone.
- "It compiles, so it works" — `build` is not verification. The change must be reachable through a healthcheck or smoke probe.
- One-line verification like "verify it works" — that is no verification. Push back.
- Skipping verification because "the change is small" — small unverified changes are exactly how silent regressions land.

## When verification fails

1. Capture the exact failure (command + output). It goes into the task report and possibly `lessons-learned.md`.
2. Decide: amend the plan and continue, or stop and re-plan through lavish.
3. Do not declare the task done until verification passes (or the plan is amended to drop the failing check with a documented reason).
