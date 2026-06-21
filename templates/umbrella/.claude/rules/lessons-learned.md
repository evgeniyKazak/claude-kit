# Lessons Learned (Umbrella)

Curated log of non-trivial failures that could recur. **Check before touching the related component.**

This file is for umbrella-scope incidents (docker-compose, env, agentmemory, shared hooks, local LLM runtime). Sub-project lessons live in `<service>/.claude/rules/lessons-learned.md`.

Cross-references: [`workflow.md`](workflow.md) • [`conventions.md`](conventions.md)

## When to add an entry

- A non-trivial behaviour bit you (silent config, wrong default, missing dependency, race condition).
- The failure could plausibly recur for future-you or a different operator.
- The root cause is **not** discoverable from current code alone.

Do **not** add entries for: typos, momentary slips, transient network failures, or things obvious from a clean reading of the code. AgentMemory captures those automatically.

## Entry format

```
### [YYYY-MM-DD] One-line title — what happened
- **File:** path or "stack-level"
- **Error:** the exact symptom, with the message verbatim if possible
- **Cause:** the underlying mechanic (one to two sentences)
- **Fix:** what made it work
- **Rule:** the durable takeaway, phrased as guidance for next time
```

---

> The two entries below ship with the boilerplate because they bite almost every
> stack that wires AgentMemory the way this one does. Keep them; add your own below.

### [seed] `docker compose restart` does not reload `env_file`
- **File:** stack-level (`docker-compose.yml` + any `env_file:` setup)
- **Error:** After editing an env file (e.g. `agentmemory.env`) to enable a feature, `docker compose restart <svc>` left the container running with the old env. New variables were absent from `docker exec <container> env`. Behaviour silently unchanged.
- **Cause:** `docker compose restart` reuses the existing container with its existing env. `env_file:` is read at container **creation** time, not at restart.
- **Fix:** `docker compose up -d <service>` — Compose detects the file change and recreates the container, re-reading `env_file`.
- **Rule:** After editing any `env_file:`-referenced file, always use `docker compose up -d <svc>`. Reserve `restart` for when only the process is stuck and the env is unchanged.

### [seed] AgentMemory has no OpenAI-compatible LLM provider out of the box
- **File:** `agentmemory-src/src/config.ts`, `agentmemory-src/src/providers/index.ts`
- **Error:** Setting `OPENAI_API_KEY` + `OPENAI_BASE_URL` to a local Ollama made embeddings work but not compress. Compress kept logging `Provider: noop`. The startup banner only mentioned the four cloud keys.
- **Cause:** Upstream uses `OPENAI_*` env vars exclusively for the embedding client. The LLM-provider detector only branches on Anthropic/Gemini/OpenRouter/MiniMax keys. There is no OpenAI-compatible LLM provider class, even though `OpenRouterProvider` already implements one.
- **Fix:** Add an `ollama` branch to `detectProvider`, reuse `OpenRouterProvider` with `OLLAMA_BASE_URL`, register `"ollama"` in `createBaseProvider`, extend `ProviderType` in `types.ts`. See ADR-0002.
- **Rule:** When adding a new LLM provider to agentmemory, reuse `OpenRouterProvider` (OpenAI-compatible) rather than inventing a class. Detection must be added in **both** `detectProvider` and `detectLlmProviderKind`, and the `types.ts` union needs the new tag.

---

*Add new entries below this line, newest first.*
