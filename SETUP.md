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
sub-project standard, two umbrella skills (**archify** for interactive HTML diagrams, **lavish**
for browser-based plan review), and a lavish-plan-first / verify-before-done workflow.

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

## Step 3b — Install the umbrella skills (archify + lavish)

Two Claude Code skills are part of the workflow and are installed **once, at the umbrella** (not vendored — installed copies of skills go stale, so they're pulled fresh at setup time):

```bash
cd <STACK_ROOT>
npx skills add tt-a1i/archify                          # interactive HTML diagrams
npx skills add kunchenguid/lavish-axi --skill lavish   # browser review/annotation of HTML artifacts
```

- **archify** (`.claude/skills/archify`) — compiles typed JSON specs into self-contained interactive HTML diagrams (architecture / workflow / sequence / dataflow / lifecycle). It is the standard tool for every visual schema: project architecture, API contracts, DB relations, cross-service flows. Output goes to `diagrams/` folders; every schema gets a companion `.md` linked from the main docs — the full contract is the **Diagrams** section of `templates/umbrella/.claude/rules/conventions.md`.
- **lavish** (`.claude/skills/lavish`) — opens agent-authored HTML artifacts in a local browser for annotation and approval (`npx -y lavish-axi <file>.html`). It replaces Claude Code plan mode in this workflow: plans are authored as visual HTML artifacts and approved in lavish — see Step 6.

Sub-project sessions reach archify through the umbrella path (`node <STACK_ROOT>/.claude/skills/archify/bin/archify.mjs`) — do not install per-service copies. Create the umbrella `diagrams/` folder now: `mkdir -p <STACK_ROOT>/diagrams`.

---

## Step 4 — Add each sub-project

For every microservice, copy `templates/subproject/` into `<STACK_ROOT>/<service>/` and adapt:

> **Brownfield merge — do NOT overwrite existing files.** When you point this setup at a repo whose
> services already have their own docs, Claude **merges** the template into what's there instead of
> replacing it:
> - **`CLAUDE.md`** — keep every existing service-specific fact (About, Key Rules, commands, structure);
>   layer in the template's required section order and any missing standard sections (`Sub-project
>   Context`, `After Completing a Task`). Never drop what the operator already wrote.
> - **`.claude/rules/workflow.md`** — preserve the service's existing post-task checklist and
>   forbiddens, and **ensure the mandate block is present** (lavish-plan-first on non-trivial tasks,
>   verify-before-done). The mandate is required in every sub-project — prepend it if the existing
>   file lacks it; do not duplicate it if it's already there.
> - **Other rules** (`conventions.md`, `lessons-learned.md`) — append template sections that are
>   missing; never overwrite existing entries.
> When a merge is ambiguous, show the operator the merged result before writing.

1. `CLAUDE.template.md` → `<service>/CLAUDE.md` (**merge**, don't overwrite, if one exists — see above),
   `CHANGELOG.template.md` → `<service>/CHANGELOG.md`.
2. `.mcp.json` → replace `<AGENTMEMORY_SECRET>`; add service-specific MCP servers if needed.
3. `.claude/hooks/agentmemory/run.sh` → replace `<STACK_ROOT>`, then `chmod +x` it. **Keep it two
   lines** — all logic lives in the shared runner.
4. `.claude/settings.local.json` → **keep the full 12-hook block** and the 3-hook SessionStart chain
   (`session-start` → `architecture-context` → `parent-context`) intact.
5. `.claude/rules/*` → rewrite for this service's language/framework (don't ship another service's
   `lessons-learned.md`). **`workflow.md` must carry the mandate block** (lavish-plan-first +
   verify-before-done); merge it into any existing workflow rather than replacing. Fill
   `testing.md` (real test command, where tests live, the bar) and `sources.md` (the MCP servers
   from `.mcp.json` + the datastores this service touches; the cross-stack catalog stays in umbrella
   `ARCHITECTURE.md` → "MCP servers & sources").
6. `.gitignore` → keep `.env` ignored; uncomment the build-artifact lines for this stack.
   `.claude/tasks/` → leave `README.md`; plan files land here at task time.
7. Add a minimal `permissions.allow` in `.claude/settings.local.json` for this service (replace the
   `<prefix>-<service>` / `<prefix>-<db>` placeholders) so routine container tests, health curls,
   read-only DB queries, and read-only git don't prompt every time.
8. `.claude/agents/flow-explainer.md` → fill the Project Quick Reference and adapt Phases 2/4/5 to
   this stack. **Do not** remove a phase or change the output directory.
9. `data-flows/README.md` → rewrite the "what does/doesn't go here" for this service. Create an empty `<service>/diagrams/` for archify output.
10. Update umbrella `CLAUDE.md` (Sub-projects), `ARCHITECTURE.md`, and `CHANGELOG.md`.

Full standard + the new-sub-project checklist: `templates/umbrella/.claude/rules/subprojects.md`.

---

## Step 5 — Equip sub-projects from ECC (recommended)

Once the stack is up (Step 2) and the sub-projects exist (Step 4), run the bundled **`stack-equipper`** agent (copied in Step 3, `.claude/agents/stack-equipper.md`) to pull technology-matched agents, rules, and skills from an external library into each sub-project — instead of hand-picking them.

1. Open a Claude Code session at `<STACK_ROOT>` (umbrella scope — the agent operates across all sub-projects).
2. Invoke it: `@stack-equipper equip the stack from ECC` (or scope it: "only `<service>`", "agents and rules only").
3. It detects each service's tech, clones the source library (default `affaan-m/ecc`, MIT) **outside** the tree, and **presents a mapping for approval** — review which assets land where, and prune anything you don't want.
4. On approval it copies the approved assets (each stamped with its `origin` + license), updates the touched CHANGELOGs, then **deletes the clone**. Nothing is placed before you approve, and the library is never left behind.

Re-runnable: it skips assets already harvested and re-deletes any stray clone. Full contract and the per-stack `Project Quick Reference` to fill in: `templates/umbrella/.claude/agents/stack-equipper.md`. The other bundled umbrella agents are `code-reviewer` and `flow-explainer` (cross-service).

---

## Step 6 — Adopt the workflow

The rules in `templates/umbrella/.claude/rules/` are the operating system:

- **`workflow.md`** — lavish-plan-first, verification-before-done, post-task checklist.
- **`subprojects.md`** — the sub-project standard and ownership matrix.
- **`agentmemory.md`** — the git-docs-vs-agentmemory split (don't duplicate knowledge across them).
- **`security.md`** / **`conventions.md`** / **`testing.md`** / **`glossary.md`** — supporting rules.
- **`adr/`** — record architecturally significant decisions; `0001`/`0002` are worked examples.

Internalize the mandate: every non-trivial task starts with a **lavish plan** — a full analysis
of the project on its existing docs, turned into a visual HTML artifact (archify diagrams, block
schemes, graphs), opened with `npx -y lavish-axi <plan>.html`, iterated on the operator's
annotations, and approved **in lavish** before any change; the approved plan is recorded in a plan
file with a `Verification` section, and the task is not "done" until that section has run. This is
**not** umbrella-only — each sub-project carries the same mandate in its own
`<service>/.claude/rules/workflow.md`, mandatory for every task in that service.

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
# Skills installed
test -f <STACK_ROOT>/.claude/skills/archify/SKILL.md && echo "archify ok"
npx -y lavish-axi --help >/dev/null && echo "lavish ok"
```

When all pass, delete this `SETUP.md` (and the `templates/` tree if you've copied it out). For
upgrading an already-installed stack later, use [`UPDATE.md`](UPDATE.md) from the boilerplate repo —
don't re-run this guide.

---

## Customization & escalation

- **MCP surface** — `AGENTMEMORY_TOOLS=core` (6 tools) by default. Raise to `all` (51 tools) only
  with a concrete reason.
- **Compress provider** — swap Ollama for a cloud LLM by setting its key in `agentmemory.env` (the
  detector prefers Ollama when `OLLAMA_BASE_URL` is set).
- **Compress threshold** — `AGENTMEMORY_COMPRESS_MIN_BYTES` controls when LLM vs synthetic compress
  is used.
- **Context injection** — set `AGENTMEMORY_INJECT_CONTEXT=false` for a capture-only profile.
