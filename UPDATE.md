# Update Guide — upgrading an already-installed stack

This guide brings a project that **already runs this boilerplate** up to the current version:
missing skills and plugins get installed, agents and rules get merged forward, the workflow
mandate gets upgraded, and new architectural features (diagrams convention, `UPDATE.md`-era
contracts) get wired in — without losing anything the operator wrote locally.

It is meant to be run by Claude Code from the target stack, with this repo checked out somewhere
readable (the boilerplate repo is the source of truth; nothing here is applied blindly).

> Conventions: `<STACK_ROOT>` = the target stack's root (holds `docker-compose.yml`).
> `<KIT>` = the path to this boilerplate repo checkout. `<service>` = one microservice directory.

**Non-negotiable shape of an update run:** inventory first, then a **detailed lavish plan** that
shows — with diagrams, not prose — exactly what will change in the important parts (above all
`workflow.md` and the agents), operator approval, and only then application. Never "just patch it".

---

## Step 0 — Bootstrap lavish (the update plan itself is presented through it)

The plan in Step 2 is reviewed in lavish. If the target doesn't have it yet, install it first:

```bash
test -d <STACK_ROOT>/.claude/skills/lavish || \
  (cd <STACK_ROOT> && npx skills add kunchenguid/lavish-axi --skill lavish)
npx -y lavish-axi --help >/dev/null && echo "lavish ok"
```

While here, check archify too (Step 3 installs it if missing):

```bash
test -f <STACK_ROOT>/.claude/skills/archify/SKILL.md && echo "archify ok" || echo "archify MISSING"
```

## Step 1 — Inventory the target

Build the feature-gap list by diffing the installed stack against the current `templates/`. Read,
don't guess — every row of the report cites the file you checked.

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
   test -f .claude/skills/archify/SKILL.md || npx skills add tt-a1i/archify
   test -d .claude/skills/lavish          || npx skills add kunchenguid/lavish-axi --skill lavish
   mkdir -p diagrams
   ```
2. **Umbrella rules** — merge template changes into `.claude/rules/*.md`: upgrade the
   `workflow.md` mandate to lavish-plan-first, add the `conventions.md` Diagrams section, update
   `glossary.md` / `testing.md` / `subprojects.md` references. **Preserve** every locally added
   rule, lesson, and convention — merge, never overwrite.
3. **Agents** — bring `code-reviewer.md` and both `flow-explainer.md` variants up to the current
   archify-wired versions. If the operator customized an agent (Project Quick Reference, extra
   checklist items), graft those customizations onto the new version rather than dropping either.
   Note: an already-open Claude session caches agent definitions — new sessions pick up the edits.
4. **Sub-projects** — per service: mandate block in `workflow.md`, `diagrams/` folder,
   `tasks/README.md` convention, agent update. Never overwrite `lessons-learned.md`, local
   `conventions.md` content, or local `permissions.allow`.
5. **Docs** — update the target's `CLAUDE.md` Key Rules (lavish mandate, diagrams rule),
   `ARCHITECTURE.md` if new folders/contracts appeared, and append the update to the umbrella
   `CHANGELOG.md` (one bullet per applied area).

When a merge is ambiguous, show the operator the merged result before writing — same rule as at
install time.

## Step 4 — Verify and log

Run the `Verification` section from the approved plan. Baseline checks for any update run:

```bash
# Skills respond
test -f <STACK_ROOT>/.claude/skills/archify/SKILL.md && echo "archify ok"
npx -y lavish-axi --help >/dev/null && echo "lavish ok"
# Mandate upgraded everywhere (no stale plan-mode mandate lines)
grep -rn "plan mode\|/plan" <STACK_ROOT>/.claude/rules/ <STACK_ROOT>/*/.claude/rules/ || echo "clean"
# Agents carry archify wiring
grep -l "archify" <STACK_ROOT>/.claude/agents/*.md <STACK_ROOT>/*/.claude/agents/flow-explainer.md
# Hook chain untouched (compare against pre-update state, not the template)
test -x <STACK_ROOT>/.claude/shared-hooks/agentmemory-run.sh && echo "runner ok"
# A fresh child session still shows <architecture-context> + <parent-project-context>
```

Then: `CHANGELOG.md` entries in the target (umbrella + every touched sub-project), and a
`lessons-learned.md` entry if anything non-trivial bit during the update.

---

## What an update never does

- Overwrite `lessons-learned.md`, locally written conventions, ADRs, or `permissions.allow`.
- Touch the hook wrappers, the shared runner, the bearer, or `agentmemory.env` — those change only
  through their own planned tasks.
- Apply anything not in the lavish-approved plan.
- Re-run `SETUP.md` — setup is for greenfield; this guide is the only upgrade path.
