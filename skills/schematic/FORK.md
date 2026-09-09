# schematic — fork notice

This directory is a **modified copy** of the `archify` Skill, forked at upstream
version **2.16.0** (commit-equivalent snapshot taken 2026-09-09) for use inside
claude-kit.

## Provenance

| | |
|---|---|
| Upstream project | `archify` — https://github.com/tt-a1i/archify |
| Upstream version | 2.16.0 (`skill-release.json`) |
| Upstream license | MIT — see [`LICENSE`](LICENSE) (kept verbatim, unmodified) |
| Original ancestor | `Cocoon-AI/architecture-diagram-generator` (MIT) |
| Fork baseline | [`UPSTREAM-BASELINE.sha256`](UPSTREAM-BASELINE.sha256) — SHA-256 of every file as copied |

`LICENSE` carries the upstream copyright notices and MUST NOT be edited or removed.
It covers the upstream code that survives in this fork.

Modifications made in this fork are:

    Copyright (c) 2026 claude-kit contributors

and are released under the same MIT terms, so the combined work stays MIT.

## Verifying what we changed

```bash
# every file that differs from pristine upstream 2.16.0
shasum -a 256 -c UPSTREAM-BASELINE.sha256 2>/dev/null | grep -v ': OK$'

# or a full tree diff against the untouched original
diff -r ../archify .
```

Regenerate the baseline only when deliberately re-syncing with a new upstream release —
never to hide local drift.

## Known upstream carry-overs to resolve during the rewrite

1. **Update checker phones home to upstream.** `scripts/check-update.mjs` +
   `skill-release.json` point at `tt-a1i.github.io/.../archify/stable.json`. In a fork
   this is wrong: it makes a network call and can report a "newer version" of a project
   we have deliberately diverged from. Neutralise or remove before this skill goes live.
2. **`npm test` is broken as distributed.** `package.json` references
   `../scripts/check-release-identity.mjs`, `../scripts/build-gallery.mjs`,
   `../scripts/run-tests.mjs` — those live in the upstream repository and were not
   shipped with the Skill. Devtime deps (`ajv`, `parse5`, `saxes`, `simple-icons`) are
   also not installed. Only the generated artefacts under `renderers/shared/` are usable.
3. **`bin/archify.mjs` still carries the upstream command name** in usage text and in
   every `references/*.md` example.

## Local changes

### 001 — Presentation Stage only, no Info Cards (2026-09-09)

**Info Cards removed from the artifact.** `renderCards()` in
`renderers/shared/utils.mjs` now returns an empty string, and the
`ARCHIFY:CARDS_SLOT` block in `assets/template.html` is empty between its two
sentinels (the sentinels stay — `applyTemplate` throws without them). Authored
`cards` remain schema-valid so existing specifications still validate; they
simply never reach the HTML. Dead `.cards` CSS and the null-guarded `.cards`
lookup in `Archify.readerLayout` were left in place for a later cleanup pass.

**The Presentation Stage is the only layout.** `data-present="true"` is set in
the pre-paint boot script unconditionally, so there is no non-stage flash and no
`?present=1` opt-in. Removed: the `#btn-present` toolbar button, the
`data-guide-action="present"` entry in the diagram guide and its handler, the
`F` keyboard toggle, the `Escape` branch that exited the stage, and every CSS
rule addressing `#btn-present` / `#present-icon` / `#present-label`.
`Archify.presentation` is now a stub whose `enter`/`exit`/`toggle`/`active` all
return `true`, kept only because other modules call that API.

Verified: all five example types render; `validate --quality showcase` reports
9/9 artifact checks with 0 errors and 0 warnings for each; `deliver` exits zero;
`visual-check` in headless Chrome reports `status: pass` with 0 diagnostics
across 1440×900 / 1600×1000 / 1920×1080 / 2048×1320.

### 002 — 200 columns / 200 nodes, contained-and-zoom reading model (2026-09-09)

**Ceilings raised to 200** (`col` / `stage` / `row` are `0..199`):

| Type | Was | Now |
|---|---|---|
| dataflow | stages 2–5, rows 0–4 | stages 2–200, rows 0–199 |
| lifecycle | phase col 0–4, lower band 0–2, lanes 1–4 | col 0–199 in every band, lanes 1–200 |
| workflow | col 0–5 (schema **and** compiler) | col 0–199 |
| architecture | `layout.cols` 1–12 | 1–200 |
| sequence | participants failed closed on viewBox width | viewBox grows to fit |

**Fixed pixel tables became formulas**, reproducing the historical grids exactly
so no existing diagram moves:

- dataflow `rowYs: [128,242,356,470,584]` → `rowTop 128 + row × 114`
- lifecycle `phaseXs/eventXs/outcomeXs` → `94 + col × 154`, lower bands keep the
  `col N` ≡ main `col N + 2` contract via one `lowerBandOffset`
- workflow `LEGACY_COLUMN_CENTERS` (6 entries) → 200 entries: the six historical
  centers verbatim, then the readable-v2 120px adjacent-rank baseline
- workflow v2 `columnCount = 6` → `authoredColumnCount()`, six as the floor so
  ordinary documents solve identically and only a wider document grows the solver

**An omitted `meta.viewBox` is now derived from content** in dataflow, lifecycle
and sequence (architecture already did this). A large diagram is therefore
contained by construction, and the viewer scales it to one screen.

**Reading model changed, and with it the readability gate.** Upstream required
node context text to project at ≥6px at a 1440px desktop — that assumes the
diagram is read at 100%. We read large diagrams by landing them whole and
zooming in, so `composition/desktop-readability` and
`viewer/projected-text-readability` are now **informational**: the measurement is
still reported (`minProjectedNodeTextPx`, `readability.status: "informational"`),
it just never fails delivery. **Containment stays a hard gate** — that is the
invariant we actually depend on.

Verified — 12 stock examples still pass `showcase` with 0 errors / 0 warnings,
and five 200-node stress diagrams pass `showcase`, `deliver`, and headless-Chrome
`visual-check` with **zero overflow** at 1440×900 / 1600×1000 / 1920×1080 /
2048×1320:

| Type | Nodes | Derived viewBox |
|---|---|---|
| architecture | 200 | 3820×1218 |
| dataflow | 200 (20 stages × 10 rows) | 4293×1286 |
| workflow | 200 (10 lanes × 20 cols) | 2638×1396 |
| lifecycle | 200 | 12699×630 |
| sequence | 30 participants / 200 messages | 3277×6233 |

**Known limitation — lifecycle aspect ratio.** Lifecycle has exactly three fixed
vertical bands, so 200 states can only grow sideways: 12699×630 is a 20:1 strip
that contains correctly but uses a thin band of a 16:9 screen. Raising the
ceiling did not fix the shape. A real fix is wrapping the rail into repeated row
blocks (or letting the band count grow), which is a layout redesign, not a limit
change. Workflow and architecture do not have this problem because both grow in
two dimensions.

**`npm install` was run** to regenerate `renderers/shared/generated-validators.mjs`
after the schema edits — without that regeneration the schema JSON is inert,
because the compiled validator is what actually runs. `node_modules/` is
gitignored; only the regenerated artefact matters.

### 003 — Lifecycle wraps into row blocks (2026-09-09)

Change 002 raised the lifecycle ceiling but not its shape: 200 states in three
fixed vertical bands produced a 12699×630 strip (20:1). Lifecycle now wraps.

**Wrap model.** An authored `col` is absolute and unchanged; the renderer maps it
to a position:

```
block        = floor(col / columnsPerRow)
columnInBlock = col % columnsPerRow
x = bandX(band, columnInBlock)
y = bandTop(band) + block × blockPitch + yOffset
```

`blockPitch` is 580 — the three bands occupy y 126..508 inside a block, plus the
gap that separates two stacked blocks. Block 0 keeps the historical coordinates
exactly, so a diagram that fits one row renders byte-identically to before.

**Row width is chosen automatically.** `chooseColumnsPerRow()` scans candidate
row widths from `minColumnsPerRow` (6) upward and keeps the one whose resulting
canvas sits closest to `targetAspect` (1.6), scored on the log of the ratio so
too-wide and too-tall are penalised symmetrically. `meta.columns_per_row`
overrides it. A diagram with 6 or fewer columns never wraps.

**Wrap transitions get their own route.** A transition leaving one block for the
next cannot be drawn directly — it would cut through every state in both rows
(this is exactly what failed first: one `t21` produced 30+
`clean-flow/edge-through-node` errors). Such a transition now leaves to the
right, runs down the right margin the auto viewBox always reserves, crosses left
through the empty gap between the two blocks, and enters the next row's state
from the top. Both corridors are empty by construction. `fromSide`/`toSide`/
`via`/`route` authored on the transition still win.

**Per-block chrome.** Band separators and titles repeat for each block, suffixed
`· n/total`, and a band is drawn only for blocks that actually hold states in it
— an uneven wrap leaves no labelled empty band behind. The phase rail is emitted
once per block, spanning only that block's phase columns.

Result for the 200-state stress diagram: **12699×630 (20:1) → 3771×2370 (1.59)**,
`showcase` 0 errors / 0 warnings, headless-Chrome `visual-check` pass with zero
overflow. Both stock lifecycle examples still render at exactly 980×660.

Final stress matrix, all five types at 200 nodes:

| Type | viewBox | Aspect | showcase | browser |
|---|---|---|---|---|
| architecture | 3820×1218 | 3.14 | pass | pass, 0 overflow |
| dataflow | 4293×1286 | 3.34 | pass | pass, 0 overflow |
| workflow | 2638×1396 | 1.89 | pass | pass, 0 overflow |
| lifecycle | 3771×2370 | 1.59 | pass | pass, 0 overflow |
| sequence | 3277×6233 | 0.53 | pass | pass, 0 overflow |

**Not done, deliberately.** A *backward* cross-block transition (a return arrow
from a later row to an earlier one) still uses default routing and can cut
through rows. The forward wrap is the case a wrapped rail creates by
construction; a backward one is authored, and the author can already route it
with `route`/`via`. Revisit if it shows up in real diagrams.

**Observation for later.** Lifecycle is now the best-proportioned type at scale.
dataflow (3.34) and architecture (3.14) are the wide ones, but their placement is
authored — the author picks stage/row and col — so wrapping them would override
an authoring decision rather than fix a layout the renderer imposed.
