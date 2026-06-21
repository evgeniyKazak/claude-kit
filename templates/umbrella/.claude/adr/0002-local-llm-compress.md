# ADR-0002 — Patch agentmemory-src to support local Ollama as the LLM compress provider

- **Status:** Accepted
- **Date:** <YYYY-MM-DD>
- **Decider:** <operator>
- **Related:** ADR-0001, `.claude/rules/lessons-learned.md`, `BACKLOG.md`

> Worked example. This documents the one upstream patch the boilerplate relies on.
> Re-apply it after cloning `agentmemory-src/` (see SETUP.md), and keep this ADR
> as the record of why the patch exists.

## Context

With AgentMemory deployed (ADR-0001) and embeddings enabled via Ollama's OpenAI-compatible endpoint, the next escalation knob was LLM compression — turning each raw observation into a structured summary instead of a synthetic pattern-based blob. Upstream supports four cloud providers (Anthropic, Gemini, OpenRouter, MiniMax) and gates LLM compress behind one of their API keys being set.

Constraints:

- We already run a local Ollama for embeddings — no marginal hardware cost to extend its use.
- We want zero ongoing cost — paying per-token for a cloud LLM was not on the table for this layer.
- Hidden cloud dependencies for development-loop tooling are undesirable, and the operator prefers content not leaving the host.
- Upstream uses `OPENAI_*` env vars exclusively for embeddings; there is no OpenAI-compatible *LLM* provider class, even though `OpenRouterProvider` already implements OpenAI Chat Completions semantics and just needs a different base URL.

The cheapest acceptable LLM-on-Ollama option was a small instruct model (e.g. `qwen2.5:3b-instruct`, ~3 s/call vs ~22 s for a 7B) with `MAX_TOKENS=1024` (the 4096 default was wasteful for summaries).

## Decision

Patch `agentmemory-src/` to add a fifth provider tag, `ollama`, reusing the existing `OpenRouterProvider` class with a configurable base URL. Specifically:

1. Extend `ProviderType` in `src/types.ts` with `"ollama"`.
2. Add a case `"ollama"` in `createBaseProvider` (`src/providers/index.ts`) constructing `OpenRouterProvider` with `OLLAMA_BASE_URL` and `OLLAMA_API_KEY`.
3. Adjust `OpenRouterProvider.name` to distinguish openrouter / gemini / ollama by inspecting the base URL.
4. Add detection in `detectProvider` (`src/config.ts`) — `OLLAMA_BASE_URL` or `OLLAMA_API_KEY` set ⇒ provider `"ollama"`, model from `OLLAMA_MODEL`. Place this branch above the gemini / openrouter branches so it wins when Ollama vars are set.
5. Add the same env keys to `detectLlmProviderKind` so the startup banner stops warning about a missing provider.
6. Add a guard for trivial observations: env `AGENTMEMORY_COMPRESS_MIN_BYTES` (default 512). If the raw payload is smaller, compress uses the synthetic path even with `AGENTMEMORY_AUTO_COMPRESS=true`. Implemented as `shouldUseLlmCompress(raw)` in `src/config.ts`, consumed by `src/functions/observe.ts`.

## Consequences

**Positive**

- Zero ongoing cost for LLM compress. No cloud account, no per-token billing.
- Local-only — observation content never leaves the host.
- Compress latency dropped from ~22 s (7B, max_tokens 4096) to ~3 s (3B, max_tokens 1024).
- `AGENTMEMORY_COMPRESS_MIN_BYTES=512` skips LLM on trivial observations entirely.
- Reuses the existing `OpenRouterProvider` — no new provider class to maintain.

**Negative**

- Local fork divergence from upstream. Five files in `agentmemory-src/` carry the patch; a `git pull` may conflict. Mitigation: save the diff as a `.patch` for re-apply (BACKLOG item).
- Summary quality on a 3B model is acceptable but weaker than 7B. Switching back is a one-line env change (`OLLAMA_MODEL=...`) at the cost of latency.
- GPU/compute contention with other local-LLM consumers — managed by Ollama's keep-alive, but a long compress burst before image/LLM work pays a model-swap cost.

**Neutral**

- The fork diverges in a small, well-scoped way. Each patched file gets a CHANGELOG entry and is referenced from this ADR.

## Alternatives considered

**Use a cloud free tier (e.g. Gemini).** Cheapest cloud option. Rejected: external dependency, an account to manage, and captures leave the host. Local Ollama was already running.

**Use a paid cloud LLM (e.g. Anthropic).** Best summary quality. Rejected on operating-cost grounds for a personal/team-scale capture system.

**Enable the Agent-SDK fallback.** Documented upstream as dangerous — may recurse through the Stop-hook loop. Rejected.

**Separate CPU-only Ollama just for agentmemory.** Removes contention but adds large CPU latency and another container. Rejected; default swap behaviour is adequate at this scale.

**Hard-fork agentmemory into a separate package.** Over-engineering for a five-file patch. Keep the diff small and upstream it if it stabilises (PR opportunity).

## Notes

- Implementation should land in a CHANGELOG entry on the day it's applied.
- Patch persistence (saving as a `.patch` file) belongs in `BACKLOG.md`.
