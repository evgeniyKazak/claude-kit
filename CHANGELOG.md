# Changelog — claude-kit

Versioning: semver, annotated git tags (`vX.Y.Z`). Run installs and updates from a tag checkout,
never from bare `main`. Each entry carries a **Migration** section — the ordered steps `UPDATE.md`
applies to bring an installed stack from the previous version to this one.

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
