# Data Flows — <Service Name>

End-to-end data-flow documentation for flows that live **inside** this service. One file per flow.

Flows that cross into other containers belong to the umbrella `data-flows/` directory at `../../data-flows/` — not here. This directory is for service-internal flows only.

## How files land here

Files are produced by the `flow-explainer` sub-agent (`.claude/agents/flow-explainer.md`). The agent traces a flow end-to-end inside this service, presents it for human review, and writes a markdown document here only after approval. Do **not** hand-write files here.

## Naming convention

`<domain>-<flow-name>.md` in kebab-case, no dates. Examples: `<domain>-<flow>.md`.

## What does NOT go here

- Cross-service flows → umbrella `../../data-flows/`
- API references → `../API.md`
- Architectural decisions → umbrella `.claude/adr/`
- Code conventions → `.claude/rules/conventions.md`
