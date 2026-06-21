# Security

Secrets, host bindings, and hardening practice at umbrella scope. Cross-references: [`conventions.md`](conventions.md) • [`agentmemory.md`](agentmemory.md)

## Where secrets live

| Secret class | Location | Loaded by | Notes |
|---|---|---|---|
| DB password, object-store keys, third-party API tokens | `.env` | every service that needs them via `env_file:` | Single source of stack-wide secrets. |
| AgentMemory bearer, profile flags | `agentmemory.env` | the agentmemory container only | The same bearer is exported by the shared hook runner — keep them in sync. |
| Per-service runtime credentials | the service's own credential store / `<service>/.env` | that service at runtime | Never stored in code or committed configs. |

## Host bindings

- The AgentMemory REST (`3111`) and WebSocket (`3112`) ports bind to `127.0.0.1` only. Not exposed to the host network. Reached from Claude Code because the host is `127.0.0.1`.
- Other application ports may bind to `0.0.0.0` for local-dev convenience — change to a `127.0.0.1:` prefix before any non-local exposure.

## Never do

- Hardcode any secret in `docker-compose.yml`, Dockerfiles, scripts, or markdown.
- Commit a populated `.env`. `.env.example` (placeholders) is fine; the real `.env` is gitignored.
- Echo a secret in a shell command that may be captured (logs, agentmemory, terminal history). Use heredocs to a file, or read from `$VAR` without `echo`.
- Paste credentials into AgentMemory observations or `remember` calls. Upstream redaction exists, but treat it as defence-in-depth, not a license.
- Open the agentmemory REST port outside `127.0.0.1` without adding authn/authz hardening (the bearer is fine for local; not for the public internet).

## AgentMemory specifics

- The bearer is the only authn for the REST API. Rotate by changing `AGENTMEMORY_SECRET` in `agentmemory.env` **and** in `.claude/shared-hooks/agentmemory-run.sh`, then `docker compose up -d agentmemory`.
- The viewer at `http://127.0.0.1:3111/agentmemory/viewer` is not authenticated independently of the bearer — it's protected only by the `127.0.0.1` binding. Do not port-forward agentmemory through a public tunnel without rethinking access.
- Per-observation captures include tool inputs and outputs. If a captured observation contains a secret, use `memory_forget` to remove it and rotate the secret regardless.

## Container hardening

- Every long-running container has a `healthcheck:` block — required, not optional.
- Containers that don't need to write to the host filesystem use read-only mounts (`:ro`). Example: `agentmemory-src:/agentmemory-src:ro`.
- Source mounted from the host is for development convenience. Production deployments build images instead of mounting source.
- GPU access is granted only to the containers that need it — no blanket GPU grants.

## When a secret leaks

1. Rotate immediately at its source (DB, API provider, etc.).
2. Update every place that uses it — `.env`, `agentmemory.env`, the shared hook runner, per-service credential stores.
3. Recreate affected containers (`docker compose up -d <svc>` — recall the env-file gotcha in [`lessons-learned.md`](lessons-learned.md)).
4. If the leak happened in AgentMemory captures, `memory_forget` the affected observations.
5. Log a `lessons-learned.md` entry — root cause, blast radius, the durable rule.

## Forbidden

- Committing `.env` files or any file with real credentials.
- Using `echo "<secret>" | …` in shell commands.
- Putting a credential into a commit message or PR title.
- Binding the agentmemory container to `0.0.0.0` short of "we deliberately added authn/authz first".
