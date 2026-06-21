# Setup Guide — Microservices + Claude Code + AgentMemory

This guide stands up the full agentic layer for a microservices product: a shared memory service,
the Claude Code hook wiring, the umbrella ⇄ sub-project architecture, and the workflow mandate.

It is meant to be followed **once**, either by you or by Claude Code reading this file. Work through
the steps in order. Replace every `<PLACEHOLDER>` and `<STACK_ROOT>` with real values. When you
reach the end, run the **Validate** checks, then delete this file (and the `templates/` tree if you
copied everything out).

> Conventions used below: `<STACK_ROOT>` = absolute path to your stack's root directory (the one
> holding `docker-compose.yml`). `<prefix>` = your container-name prefix (e.g. `cf`). `<service>` =
> a single microservice directory name.

---

## What you get (the model)

Four memory layers active in every Claude session inside the stack:

| Layer | Source | Lifecycle |
|---|---|---|
| `<architecture-context>` | `ARCHITECTURE.md` | static, injected each child SessionStart |
| `<parent-project-context>` | umbrella agentmemory namespace | dynamic, injected each child SessionStart |
| `MEMORY.md` (Claude auto-memory) | `~/.claude/.../memory/` | always-on |
| on-demand recall | agentmemory REST + MCP | searched explicitly |

Plus: automatic capture via 12 lifecycle hooks, per-project namespace isolation, a strict
sub-project standard, and a plan-mode-first / verify-before-done workflow.

---

## Prerequisites

- Docker + Docker Compose.
- Claude Code (CLI/desktop/IDE).
- A local LLM runtime (**Ollama**) — or a cloud LLM key if you choose not to run one (see Step 1).
- `openssl` (to generate the bearer), `jq` and `node` (for the validation checks).

---

## Step 1 — Detect your platform and choose the LLM runtime ⚠️

**Do this first — it changes the infra you copy in Step 2.** The shipped
`templates/infra/docker-compose.boilerplate.yml` defaults to an **NVIDIA-on-Linux** example. That is
*not* portable as-is. Pick the row that matches your host:

| Host | LLM runtime | What to do |
|---|---|---|
| **NVIDIA GPU on Linux / WSL2** | Ollama as a docker service (GPU) | Keep the `ollama` service and its `deploy:` block. Needs the NVIDIA Container Toolkit installed. |
| **No GPU / generic CPU** | Ollama as a docker service (CPU) | Keep the `ollama` service, **delete the `deploy:` block**. Use small models only (3B or less). |
| **Apple Silicon (M-series) Mac** | Ollama **native on the host** | **Delete the whole `ollama` service.** Docker Desktop on macOS has **no GPU passthrough**, so containerized Ollama is CPU-only and 3–6× slower. Run Ollama natively instead (below). |
| **Any host, prefer cloud LLM** | a cloud provider | Skip the `ollama` service for compress; set `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` in `agentmemory.env`. You still need *some* embedding provider. |

**If Claude Code is running this setup:** detect the host first and propose the right option before
copying anything —
```bash
uname -sm          # Darwin arm64 = Apple Silicon; Linux x86_64 = check for NVIDIA next
command -v nvidia-smi >/dev/null && nvidia-smi -L || echo "no NVIDIA GPU"
```
Then state which table row applies and which edits you'll make, and confirm with the operator.

### Apple Silicon — native Ollama (recommended on Mac)

1. Install + start Ollama natively (it uses Metal — full GPU acceleration):
   ```bash
   brew install ollama
   OLLAMA_HOST=0.0.0.0:11434 ollama serve   # 0.0.0.0 so containers can reach it
   ```
   (`OLLAMA_HOST=0.0.0.0` is required — Ollama binds to `127.0.0.1` by default, which a container
   cannot reach. Only do this on a trusted machine/LAN.)
2. Pull the models on the host (see Step 1b for which):
   ```bash
   ollama pull qwen2.5:3b-instruct
   ollama pull mxbai-embed-large
   ```
3. In `agentmemory.env`, point both base URLs at the host:
   ```
   OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
   OPENAI_BASE_URL=http://host.docker.internal:11434/v1
   ```
   On **Linux** hosts, `host.docker.internal` needs an extra mapping on the agentmemory service:
   `extra_hosts: ["host.docker.internal:host-gateway"]`. On Docker Desktop (Mac/Windows) it works
   out of the box.

### Step 1b — Choose models by available memory (not by brand)

The `qwen2.5` GGUF models and `mxbai-embed-large` run identically on NVIDIA, CPU, and Apple Silicon
(Metal). What changes per host is the runtime, **not** the weights. Pick by free memory:

| Role | Default | Bump to | Notes |
|---|---|---|---|
| Compress / small tasks | `qwen2.5:3b-instruct` (~2 GB) | `qwen2.5:7b-instruct` (~5 GB) | 7B needs ≥8 GB free; on CPU-only hosts stay at 3B (7B on CPU is very slow). |
| Embeddings | `mxbai-embed-large` (1024-dim) | — | Keep `OPENAI_EMBEDDING_MODEL` / `OPENAI_EMBEDDING_DIMENSIONS` in sync with this. |

Apple Silicon runs the larger model well thanks to unified memory: an M-series with ≥16 GB handles
7B comfortably; 8 GB machines should stay at 3B. Set the docker-service model list in
`templates/infra/ollama/entrypoint.sh` (`OLLAMA_MODELS=...`); on a native-Ollama host you `ollama
pull` instead and ignore that script.

---

## Step 2 — Stand up the memory infra

1. Copy the infra templates into `<STACK_ROOT>` and drop the `.example` suffixes:
   ```
   templates/infra/docker-compose.boilerplate.yml  → merge into your docker-compose.yml
   templates/infra/agentmemory.env.example         → <STACK_ROOT>/agentmemory.env
   templates/infra/agentmemory.Dockerfile          → <STACK_ROOT>/agentmemory.Dockerfile
   templates/infra/agentmemory.iii-config.yaml     → <STACK_ROOT>/agentmemory.iii-config.yaml
   templates/infra/ollama/                         → <STACK_ROOT>/ollama/   (skip on native-Ollama hosts)
   templates/infra/.env.example                    → <STACK_ROOT>/.env       (fill real secrets; gitignore it)
   ```
   Apply the Step 1 platform edits to the compose file and `agentmemory.env`.

2. Clone AgentMemory's source (mounted at runtime) and apply the local-Ollama compress patch:
   ```bash
   cd <STACK_ROOT>
   git clone https://github.com/rohitg00/agentmemory agentmemory-src
   # Apply the 5-file patch described in templates/umbrella/.claude/adr/0002-local-llm-compress.md
   cd agentmemory-src && npm install && npm run build
   ```
   (If you use a cloud LLM provider instead of Ollama for compress, you can skip the patch.)

3. Generate the bearer and set it in **two** places (they must match):
   ```bash
   openssl rand -hex 32
   ```
   - `agentmemory.env` → `AGENTMEMORY_SECRET=...`
   - `templates/umbrella/.claude/shared-hooks/agentmemory-run.sh` → replace `<AGENTMEMORY_SECRET>`
   - and every `.mcp.json` → replace `<AGENTMEMORY_SECRET>`

4. Bring it up and health-check:
   ```bash
   docker compose up -d ollama agentmemory
   curl -s -H "Authorization: Bearer $(grep AGENTMEMORY_SECRET agentmemory.env | cut -d= -f2)" \
     http://127.0.0.1:3111/agentmemory/health | jq '{status, version}'
   ```
   Expect `status: "healthy"`. Remember: after editing `agentmemory.env`, always
   `docker compose up -d agentmemory` (a `restart` does **not** reload `env_file`).

---

## Step 3 — Wire the umbrella

1. Copy `templates/umbrella/.claude/` to `<STACK_ROOT>/.claude/`.
2. Copy `templates/umbrella/CLAUDE.template.md` → `<STACK_ROOT>/CLAUDE.md`,
   `ARCHITECTURE.template.md` → `ARCHITECTURE.md`, and the `CHANGELOG`/`BACKLOG` templates. Fill them
   from real project data (services, ports, inter-service URLs, shared data).
3. Copy `templates/umbrella/.mcp.json` → `<STACK_ROOT>/.mcp.json`.
4. Replace `<STACK_ROOT>` in `.claude/hooks/agentmemory/run.sh` and the permission entry in
   `.claude/settings.local.json`. Make the hooks executable:
   ```bash
   chmod +x <STACK_ROOT>/.claude/shared-hooks/agentmemory-run.sh
   chmod +x <STACK_ROOT>/.claude/hooks/agentmemory/run.sh
   ```
   The shared runner self-resolves its own directory, so no other path is hardcoded.
5. Open a Claude Code session at `<STACK_ROOT>` and confirm SessionStart captures (the umbrella has
   a single SessionStart hook — it's the parent, it doesn't inject parent/architecture into itself).

---

## Step 4 — Add each sub-project

For every microservice, copy `templates/subproject/` into `<STACK_ROOT>/<service>/` and adapt:

1. `CLAUDE.template.md` → `<service>/CLAUDE.md`, `CHANGELOG.template.md` → `<service>/CHANGELOG.md`.
2. `.mcp.json` → replace `<AGENTMEMORY_SECRET>`; add service-specific MCP servers if needed.
3. `.claude/hooks/agentmemory/run.sh` → replace `<STACK_ROOT>`, then `chmod +x` it. **Keep it two
   lines** — all logic lives in the shared runner.
4. `.claude/settings.local.json` → **keep the full 12-hook block** and the 3-hook SessionStart chain
   (`session-start` → `architecture-context` → `parent-context`) intact.
5. `.claude/rules/*` → rewrite for this service's language/framework (don't ship another service's
   `lessons-learned.md`).
6. `.claude/agents/flow-explainer.md` → fill the Project Quick Reference and adapt Phases 2/4/5 to
   this stack. **Do not** remove a phase or change the output directory.
7. `data-flows/README.md` → rewrite the "what does/doesn't go here" for this service.
8. Update umbrella `CLAUDE.md` (Sub-projects), `ARCHITECTURE.md`, and `CHANGELOG.md`.

Full standard + the new-sub-project checklist: `templates/umbrella/.claude/rules/subprojects.md`.

---

## Step 5 — Adopt the workflow

The rules in `templates/umbrella/.claude/rules/` are the operating system:

- **`workflow.md`** — plan-mode-first, verification-before-done, post-task checklist.
- **`subprojects.md`** — the sub-project standard and ownership matrix.
- **`agentmemory.md`** — the git-docs-vs-agentmemory split (don't duplicate knowledge across them).
- **`security.md`** / **`conventions.md`** / **`testing.md`** / **`glossary.md`** — supporting rules.
- **`adr/`** — record architecturally significant decisions; `0001`/`0002` are worked examples.

Internalize the mandate: every non-trivial task starts in `/plan` and is not "done" until its
Verification section has run.

---

## Validate

Run from `<STACK_ROOT>`:

```bash
# Infra health
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3111/agentmemory/health | jq .status
# Embeddings active (not BM25-only)
docker logs <prefix>-agentmemory 2>&1 | grep -i "embedding provider"
# A child session shows the injected context blocks
#   open Claude Code in <service>/ and confirm <architecture-context> + <parent-project-context>
# Namespaces isolated
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:3111/agentmemory/sessions?limit=200" \
  | jq '.sessions | group_by(.project) | map({project: .[0].project, count: length})'
# Hooks are executable
test -x <STACK_ROOT>/.claude/shared-hooks/agentmemory-run.sh && echo "runner ok"
```

When all pass, delete this `SETUP.md` (and the `templates/` tree if you've copied it out).

---

## Customization & escalation

- **MCP surface** — `AGENTMEMORY_TOOLS=core` (6 tools) by default. Raise to `all` (51 tools) only
  with a concrete reason.
- **Compress provider** — swap Ollama for a cloud LLM by setting its key in `agentmemory.env` (the
  detector prefers Ollama when `OLLAMA_BASE_URL` is set).
- **Compress threshold** — `AGENTMEMORY_COMPRESS_MIN_BYTES` controls when LLM vs synthetic compress
  is used.
- **Context injection** — set `AGENTMEMORY_INJECT_CONTEXT=false` for a capture-only profile.
