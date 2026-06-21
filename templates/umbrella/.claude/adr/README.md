# Architecture Decision Records

Short, immutable records of architecturally significant decisions. One file per decision. They capture **why** something was chosen, not **what** it is — the "what" lives in `ARCHITECTURE.md` and code.

Cross-references: [`../../CLAUDE.md`](../../CLAUDE.md) • [`../rules/conventions.md`](../rules/conventions.md)

## When to write an ADR

Write an ADR when the decision:

- Closes off alternatives that would otherwise be live options (forking upstream, choosing one DB over another, a fork-vs-patch strategy).
- Is hard or expensive to reverse (production data shape, network topology, secret-storage scheme).
- Will be questioned again in six months ("why did we do it this way?").

Do **not** write an ADR for: code style, naming, day-to-day refactors, sub-project-internal patterns that don't ripple across the stack. Those belong in `conventions.md` and `lessons-learned.md`.

## File naming

`NNNN-slug.md`. Zero-padded four-digit sequence, incremented across the whole `adr/` directory. Slug is short and kebab-case.

- `0001-adopt-agentmemory.md`
- `0002-local-llm-compress.md`

## Template

Copy-paste this when writing a new ADR:

```markdown
# ADR-NNNN — <one-line decision>

- **Status:** Accepted | Superseded by ADR-MMMM | Deprecated | Proposed
- **Date:** YYYY-MM-DD
- **Decider:** <name or role>
- **Related:** ADR-XXXX, CHANGELOG entry, BACKLOG item

## Context

What problem prompted this decision? What constraints (technical, organisational, time, cost) shaped the option space? Mention alternatives that were considered and why — do not exhaustively enumerate the universe.

## Decision

The single sentence (or short paragraph) of what we chose. Be specific.

## Consequences

What changes because of this decision. Split into:

- **Positive:** what we get.
- **Negative:** what we give up or what new maintenance burden we accept.
- **Neutral:** other downstream effects worth noting.

## Alternatives considered

Briefly, one paragraph per option that was on the table. Why was each rejected?

## Notes

Optional. Links to supporting context (issues, conversations, benchmarks).
```

## Status lifecycle

- **Proposed** — written but not yet acted on. Rare; usually skipped.
- **Accepted** — the decision is in effect.
- **Superseded by ADR-MMMM** — a later ADR replaced it. Do not delete the file — link forward instead.
- **Deprecated** — no longer applies but no replacement was needed.

ADRs are append-only — once Accepted, do not rewrite the Decision or Context. Add a new ADR that supersedes the old one.

## Cross-linking

- Reference ADRs from `CLAUDE.md` only when the decision is core to operator orientation.
- Reference from `conventions.md` when the convention is a direct consequence of an ADR.
- Reference from `CHANGELOG.md` when the change that landed implements an ADR (`See ADR-0002`).
- Reference from `BACKLOG.md` when an item depends on a decision that's still Proposed.
