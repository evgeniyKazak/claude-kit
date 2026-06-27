# <Service Name>

> TEMPLATE. Fill placeholders from real service data. Keep the section order —
> the sub-project standard expects it. Delete this quote block when done.

## About
<One paragraph: what the service does, what tech/runtime, where it sits in the stack, and which siblings/datastores it talks to.>

## Sub-project Context
This service lives inside the umbrella `<stack>` stack. Treat it as **its own Claude project** — own conventions, own rules, own `agentmemory` namespace (`project=<STACK_ROOT>/<service>`), so its history does not pollute the umbrella stream and vice versa. At session start, hooks also inject `<architecture-context>` (from the umbrella `ARCHITECTURE.md`) and `<parent-project-context>` (recent umbrella activity). Use them to stay aligned with cross-service work without leaving this context.

## Current Status
**Focus:** <one line.>

## Key Rules
1. **Every non-trivial task starts in plan mode (`/plan`) and is not "done" until its `Verification` section has run** — the mandatory sub-project workflow. See `.claude/rules/workflow.md`.
2. <Rule that overrides or specializes an umbrella default for this stack.>
3. All env vars come from docker-compose — never hardcode connection strings or secrets.
4. <Language/framework rule, e.g. async-first, typed models, module layout.>
5. <Boundary rule, e.g. all DB writes route through service X.>
6. <API/versioning rule if applicable.>

## Project Rules
Detailed rules in `.claude/rules/`:
- `conventions.md` — code conventions, naming, file organization
- `workflow.md` — **mandatory workflow** (plan-mode-first on non-trivial tasks, verify-before-done), post-task checklist, upstream-reporting triggers
- `testing.md` — where tests live, how to run them, the bar for "needs a test", how to verify a change
- `sources.md` — MCP servers and data sources this service has, and how to use each
- `lessons-learned.md` — error log; check before touching a previously problematic component

## Common Commands
```bash
docker exec <prefix>-<service> <test command>
curl -s http://localhost:<port>/<health-path>
```
<All commands run inside the container unless noted.>

## Project Structure
```
<top-level source tree with one-line role comments per directory>
data-flows/                 # flow-explainer agent output (one .md per documented flow)
.claude/agents/             # sub-agents — flow-explainer.md is required
.claude/rules/              # conventions, workflow, testing, sources, lessons-learned
.claude/tasks/              # plan files (one per non-trivial task; see workflow mandate)
.gitignore                  # never commit .env / secrets
```

## After Completing a Task
- [ ] `CLAUDE.md` — structure/focus/rules changed
- [ ] `CHANGELOG.md` — add an entry about what was done
- [ ] `.claude/rules/conventions.md` — new convention discovered
- [ ] `.claude/rules/lessons-learned.md` — an error occurred → log it
- [ ] **Umbrella reporting** — endpoint/port/protocol, new shared data, new sibling dependency, new model, or an architecturally significant decision → update the umbrella docs in the **same task** (see `.claude/rules/workflow.md`).
