# Update Guide — upgrading an already-installed stack

This guide brings a project that **already runs this boilerplate** up to the current version:
missing skills and plugins get installed, agents and rules get merged forward, the workflow
mandate gets upgraded, and new architectural features (diagrams convention, `UPDATE.md`-era
contracts) get wired in — without losing anything the operator wrote locally.

It is meant to be run by Claude Code from the target stack, with this repo checked out somewhere
readable (the boilerplate repo is the source of truth; nothing here is applied blindly).

> Conventions: `<STACK_ROOT>` = the target stack's root (holds `docker-compose.yml`).
> `<KIT>` = the path to this boilerplate repo checkout. `<service>` = one microservice directory.

## Prerequisites (hard requirements)

- The target stack is a **git repository with a clean working tree** — `git -C <STACK_ROOT> status --porcelain` prints nothing. Dirty tree → stop and have the operator commit or stash first.
- The kit checkout is on a **release tag**, never bare `main`: `git -C <KIT> fetch --tags && git -C <KIT> checkout vX.Y.Z`. Read `<KIT>/CHANGELOG.md` — the **Migration** sections between the installed version and the target tag are the update's work list.
- `jq` is available (kit-doctor and the manifest need it).

Before applying anything (end of Step 2): `git -C <STACK_ROOT> tag pre-kit-update-$(date +%Y%m%d)`. The whole update lands as **one commit** — "Apply claude-kit vX.Y.Z update".

**Non-negotiable shape of an update run:** inventory first, then a **detailed lavish plan** that
shows — with diagrams, not prose — exactly what will change in the important parts (above all
`workflow.md` and the agents), operator approval, and only then application. Never "just patch it".

---

## Step 0 — Bootstrap lavish (the update plan itself is presented through it)

The plan in Step 2 is reviewed in lavish. If the target doesn't have it yet, install it first:

```bash
test -d <STACK_ROOT>/.claude/skills/lavish || \
  (cd <STACK_ROOT> && npx skills add kunchenguid/lavish-axi --skill lavish -y)
npx -y lavish-axi --help >/dev/null && echo "lavish ok"
```

While here, check archify too (Step 3 installs it if missing):

```bash
test -f <STACK_ROOT>/.claude/skills/archify/SKILL.md && echo "archify ok" || echo "archify MISSING"
```

## Step 1 — Inventory the target

**Manifest first.** Read `<STACK_ROOT>/.claude/kit-manifest.json`:

- Manifest present → the installed version is `manifest.version`; the work list is exactly the
  `CHANGELOG.md` **Migration** sections from that version up to the target tag. Spot-check two or
  three claims (mandate marker present, skills dir exists) rather than re-deriving everything.
- Manifest missing (pre-0.4.0 install) → fall back to the grep inventory below, and **write the
  manifest as part of this update** (Step 3).

Legacy fallback: build the feature-gap list by diffing the installed stack against the current
`templates/`. Read, don't guess — every row of the report cites the file you checked.

For the **umbrella** (`<STACK_ROOT>`):

- `.claude/rules/*.md` — which files exist; does `workflow.md` still carry the old plan-mode
  mandate (`/plan`) or the current lavish mandate? Does `conventions.md` have the **Diagrams**
  section?
- `.claude/agents/` — are `code-reviewer`, `flow-explainer`, `stack-equipper` present, and do the
  first two carry the archify wiring (Phase 6 archify output, "Architecture Visualization"
  section)?
- `.claude/skills/` — `archify`? `lavish`? anything else the current SETUP installs?
- `.claude/tasks/README.md` — lavish-artifact convention present?
- `diagrams/` — does the folder exist?
- Hook block in `.claude/settings.local.json` — all 12 hook points, SessionStart chain intact
  (`session-start` → `architecture-context` → `parent-context`)? **Never rewrite hooks during an
  update — flag drift, fix only with explicit approval.**

For **each sub-project** (`<STACK_ROOT>/<service>`): same questions against
`templates/subproject/` — `workflow.md` mandate version, `flow-explainer` archify wiring,
`diagrams/` folder, `tasks/README.md`, the 12-hook block, `sources.md`/`testing.md` presence.

Produce a table: `area · installed state · current template state · action (install / merge /
skip) · risk`. This table feeds the plan.

## Step 2 — Plan the update with lavish

Author the update plan as a **visual HTML artifact** — this is the centerpiece of the run:

- an archify diagram of the target stack with the touched areas highlighted;
- a block scheme of the update order (skills → umbrella rules → agents → sub-projects → docs);
- **an explicit before/after panel for `workflow.md`** — the mandate change (plan-mode → lavish)
  is the most operator-visible edit and must be called out prominently, per level, not buried;
- per-area tables from the Step 1 inventory: what is installed, what changes, what is preserved;
- a `Verification` section (Step 4's checks, pre-filled for this target).

Open it and iterate until approval:

```bash
npx -y lavish-axi <STACK_ROOT>/.claude/tasks/<YYYY-MM-DD>-boilerplate-update.html
# collect operator annotations, revise, repeat:
npx -y lavish-axi poll
```

On approval, record the plan file `<STACK_ROOT>/.claude/tasks/<YYYY-MM-DD>-boilerplate-update.md`
(links the HTML, carries `Verification`). **Nothing is applied before this point.**

## Step 3 — Apply (brownfield merge rules)

Work through the approved plan in order. The merge discipline is the same as `SETUP.md` Step 4:

1. **Skills** — install what's missing at the umbrella:
   ```bash
   cd <STACK_ROOT>
   test -f .claude/skills/archify/SKILL.md || npx skills add tt-a1i/archify -y
   test -d .claude/skills/lavish          || npx skills add kunchenguid/lavish-axi --skill lavish -y
   mkdir -p diagrams
   ```
2. **Umbrella rules** — merge template changes into `.claude/rules/*.md`. **Managed blocks make
   this mechanical**: content between `<!-- claude-kit:begin <id> vN -->` and
   `<!-- claude-kit:end <id> -->` is kit-owned — replace it wholesale with the template's current
   block (bumping `vN`); everything outside the markers is operator-owned — never touched. A file
   that predates the markers gets them added around the matching section during this update.
   **Preserve** every locally added rule, lesson, and convention — merge, never overwrite.
3. **Agents** — bring `code-reviewer.md` and both `flow-explainer.md` variants up to the current
   archify-wired versions. If the operator customized an agent (Project Quick Reference, extra
   checklist items), graft those customizations onto the new version rather than dropping either.
   Note: an already-open Claude session caches agent definitions — new sessions pick up the edits.
4. **Sub-projects** — per service: mandate block in `workflow.md`, `diagrams/` folder,
   `tasks/README.md` convention, agent update. Never overwrite `lessons-learned.md`, local
   `conventions.md` content, or local `permissions.allow`.
5. **Doctor + manifest** — copy the current `scripts/kit-doctor.sh` from `<KIT>/scripts/` to
   `<STACK_ROOT>/scripts/` (`chmod +x`), then rewrite `.claude/kit-manifest.json`: new `version`
   (the target tag) and `commit`, `updated_at` = today, refreshed skill versions
   (`.claude/skills/archify/skill-release.json`, `skills-lock.json` hash), and the current
   `modules` list. Commit the updated `skills-lock.json` too.
6. **Docs** — update the target's `CLAUDE.md` Key Rules (lavish mandate, diagrams rule),
   `ARCHITECTURE.md` if new folders/contracts appeared, and append the update to the umbrella
   `CHANGELOG.md` — one bullet per applied area, naming the kit version and commit.

When a merge is ambiguous, show the operator the merged result before writing — same rule as at
install time.

## Step 4 — Verify and log

Run the `Verification` section from the approved plan. Baseline for any update run — the doctor
covers the wiring contracts (manifest, hooks, 12-hook block, SessionStart chain, skills, mandate
markers, `diagrams/`):

```bash
cd <STACK_ROOT> && bash scripts/kit-doctor.sh
```

Plus the update-specific checks:

```bash
# Mandate upgraded everywhere (no stale plan-mode mandate lines)
grep -rn "plan mode\|/plan" <STACK_ROOT>/.claude/rules/ <STACK_ROOT>/*/.claude/rules/ || echo "clean"
# Agents carry archify wiring
grep -l "archify" <STACK_ROOT>/.claude/agents/*.md <STACK_ROOT>/*/.claude/agents/flow-explainer.md
# lavish CLI runs
npx -y lavish-axi --help >/dev/null && echo "lavish ok"
# A fresh child session still shows <architecture-context> + <parent-project-context>
```

Finish with the single update commit (see Prerequisites).

Then: `CHANGELOG.md` entries in the target (umbrella + every touched sub-project), and a
`lessons-learned.md` entry if anything non-trivial bit during the update.

---

## Rollback

The update is one commit on top of the `pre-kit-update-<date>` tag, so:

- Preferred: `git -C <STACK_ROOT> revert <update-commit>` — keeps history linear.
- Blunt (nothing else landed since): `git -C <STACK_ROOT> reset --hard pre-kit-update-<date>`.
- `.claude/skills/` installs and `node_modules` are **untracked** — a git rollback does not remove
  them. If the update installed or upgraded a skill you're rolling back, delete its directory and
  re-run the previous install command (versions are in the pre-update manifest, which git restored).
- After rollback: `bash scripts/kit-doctor.sh` (expect drift warnings until the state matches the
  restored manifest) and delete the tag once the dust settles.

---

## What an update never does

- Overwrite `lessons-learned.md`, locally written conventions, ADRs, or `permissions.allow`.
- Touch the hook wrappers, the shared runner, the bearer, or `agentmemory.env` — those change only
  through their own planned tasks.
- Apply anything not in the lavish-approved plan.
- Re-run `SETUP.md` — setup is for greenfield; this guide is the only upgrade path.
- Run from an untagged kit state, skip a Migration section, or leave the manifest stale.
- Upgrade skills outside of an update run.
