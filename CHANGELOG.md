# Changelog — claude-kit

Versioning: semver, annotated git tags (`vX.Y.Z`). Run installs and updates from a tag checkout,
never from bare `main`. Each entry carries a **Migration** section — the ordered steps `UPDATE.md`
applies to bring an installed stack from the previous version to this one.

## 0.5.0 — 2026-09-09

The diagram skill is vendored and renamed; upstream archify is retired.

- **`skills/schematic/`** — the diagram skill now ships *in this repo* instead of being pulled with
  `npx skills add`. It is a fork of `tt-a1i/archify` 2.16.0 with every layout ceiling raised to 200,
  automatic row-block wrapping for wide lifecycles, content-derived viewBox in every type, and the
  upstream update channel removed. `skills/schematic/FORK.md` records every local change;
  `UPSTREAM-BASELINE.sha256` pins the pristine tree so drift is one command away.
- **Upstream archify must not be installed.** Its `dataflow` caps at 5 stages and rejects the specs
  this kit generates. `kit-doctor` fails when `.claude/skills/archify` exists.
- **`templates/subproject/tools/dataflow/`** — call-graph extractor driven by the TypeScript
  compiler API. `paths` walks backwards from a write site to every entry point; `schematic` emits a
  ready dataflow spec. `flow-explainer` gains Phase 5b, which makes it mandatory for any
  "where is this field written" question.
- CI validates with the vendored skill — no clone, no network, no upstream drift.
- The name is generic on purpose: the previous working name came from the first stack this was
  built in, which does not belong in a kit meant for any stack. The binary keeps its upstream name
  (`bin/archify.mjs`), and so does the viewer's `Archify.*` JS namespace — ~400 references across
  the template and 23 test files, renamed for no reader-visible gain.

### Migration

1. Copy the skill in and delete the old one:
   `rsync -a --exclude node_modules <KIT>/skills/schematic/ .claude/skills/schematic/`, then delete
   `.claude/skills/archify`.
2. Repoint every reference from `.claude/skills/archify/bin/archify.mjs` to
   `.claude/skills/schematic/bin/archify.mjs` — agents, `rules/conventions.md`, `ARCHITECTURE.md`.
3. Drop the `archify` entry from `skills-lock.json`; it no longer records an installed skill.
4. Rewrite `.claude/kit-manifest.json`: `skills.schematic` with a file-tree digest (SETUP.md
   "Record the install manifest"), no `skills.archify`.
5. TypeScript services: copy `templates/subproject/tools/dataflow/` next to the service's
   `tsconfig.json` and `chmod +x tools/dataflow/bin/dataflow.mjs`.
6. Re-deliver any diagram whose spec named the old skill, and re-run `scripts/kit-doctor.sh`.

## 0.4.0 — 2026-09-01

Install/update hardening: manifest, managed blocks, kit-doctor, CI.

- `CHANGELOG.md` + semver tags; updates run from a tag checkout.
- Install manifest `<STACK_ROOT>/.claude/kit-manifest.json` (kit version/commit, skill versions,
  modules) — written by SETUP, rewritten by UPDATE; inventory is manifest-first.
- Managed blocks: `<!-- claude-kit:begin <id> vN -->` markers around kit-owned sections
  (`mandate` in both workflow.md templates, `diagrams` in umbrella conventions.md).
- `scripts/kit-doctor.sh` — machine-checkable conformance (hooks, 12-hook block, SessionStart
  order, skills, markers, diagrams/); replaces most prose Validate checks.
- UPDATE git discipline: clean tree required, `pre-kit-update-<date>` tag, single commit, rollback
  section.
- Skill version policy: upgrade only during UPDATE runs; versions/hash recorded in the manifest;
  target commits `skills-lock.json`.
- `.gitattributes` forcing LF on checkout — CRLF from a Windows/WSL clone would break the shell
  templates inside Linux containers.
- CI (`.github/workflows/ci.yml`): Cyrillic/linkrot/shellcheck/JSON lint + archify validate +
  auto-rendered `docs/boilerplate-architecture.png` committed back to main.

**Migration (0.3.0 → 0.4.0):**
1. Copy `scripts/kit-doctor.sh` to `<STACK_ROOT>/scripts/` (`chmod +x`).
2. Write `.claude/kit-manifest.json` (see SETUP.md "Record the install manifest").
3. Wrap the mandate blocks in every `workflow.md` and the Diagrams section in umbrella
   `conventions.md` with the managed markers (content unchanged if already at v0.3.0 wording).
4. Commit the target's `skills-lock.json`.
5. Run `scripts/kit-doctor.sh` — all checks green.

## 0.3.0 — 2026-09-01 (`d756154`)

archify + lavish integration.

- Umbrella skills installed via `npx skills add`: **archify** (interactive HTML diagrams) and
  **lavish** (browser plan review). Never vendored.
- Workflow mandate: lavish-plan-first replaces Claude Code plan mode; plan files keep the
  `Verification` contract.
- Diagrams convention: archify HTML in `diagrams/`, companion `.md` per schema, linked from main
  docs. `code-reviewer` + both `flow-explainer` agents wired to archify.
- `UPDATE.md` brownfield upgrade runbook; `docs/boilerplate-architecture.{json,html}`.

**Migration (0.2.0 → 0.3.0):** install both skills at the umbrella; upgrade the mandate in every
`workflow.md`; add the Diagrams section to umbrella `conventions.md`; create `diagrams/` folders;
update the three agents.

## 0.2.0 — 2026-08 (`e23b075`)

Hardened sub-project workflow; added `testing.md`/`sources.md`/plan-file convention; shipped the
`stack-equipper` agent.

## 0.1.0 — 2026-08 (`f05d241`, `ed69853`)

Initial boilerplate: AgentMemory infra templates, 12-hook contract, umbrella ⇄ sub-project
standard, `flow-explainer` ×2 + `code-reviewer` agents, plan-mode-first workflow, SETUP.md.
