# Testing & Verification — <Service Name>

> TEMPLATE. Fill the placeholders with this service's real test command, test
> location, and the bar for "a change needs a test". Keep it short — this is the
> service-level half of the workflow mandate's *verify-before-done* rule.

Cross-references: [`workflow.md`](workflow.md) • [`conventions.md`](conventions.md) • umbrella [`.claude/rules/testing.md`](../../../.claude/rules/testing.md)

## Where tests live
- `<path>` — `<unit / integration test layout for this stack>`.

## How to run them
All test/lint commands run **inside the container**, never on the host:

```bash
docker exec <prefix>-<service> <test command>          # e.g. pytest -q  /  npm test  /  go test ./...
docker exec <prefix>-<service> <lint/typecheck command>
```

## The bar — when a change needs a test
- New branch of business logic, a bug fix, or a public API/endpoint change → add or update a test.
- Pure refactor with existing coverage → run the suite, no new test required.
- Config/doc-only change → no test, but still run the relevant smoke probe.

## Verifying a change (the executable half of *verify-before-done*)
A task is **not** done until its plan's `Verification` section has run. For this service a Verification section is usually 2-5 of:

- service tests green — `docker exec <prefix>-<service> <test command>`;
- health/smoke probe of the changed surface — `curl -s http://localhost:<port>/<health-path>` → `<expected>`;
- container came up clean — `docker logs --since 30s <prefix>-<service>` → no errors;
- data check (read-only) — `docker exec <prefix>-<db> psql -U <user> -d <db> -c 'SELECT …'` → expected row(s).

Stack-wide primitives (compose health, agentmemory smoke, ollama probes) are in the umbrella [`testing.md`](../../../.claude/rules/testing.md). "It builds" is **not** verification.

## When verification fails
Capture the exact command + output into the task report. Then either fix and rerun, or re-enter plan mode and amend the plan — do not declare done. A non-trivial failure also earns a [`lessons-learned.md`](lessons-learned.md) entry.
