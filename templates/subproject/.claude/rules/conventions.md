# Code Conventions — <Service Name>

> TEMPLATE. Rewrite for this service's language/framework. The headings below are
> a starting skeleton — keep what fits, drop what doesn't.

## File Organization
- <How modules/packages are structured; the standard layout of a module.>
- <Where config lives; how settings are read from env.>

## Naming
- <File / class / function / constant naming rules.>

## Patterns
- <Client/singleton patterns, error-handling patterns, async patterns, typing rules.>

## Running Commands
- All commands (tests, install, lint) run inside the `<prefix>-<service>` container: `docker exec <prefix>-<service> <command>`. Never on the host.

## Don'ts
- Don't hardcode service hostnames, ports, or secrets — read from config/env.
- Don't add blocking calls in async contexts (if applicable).
- <Other framework-specific anti-patterns.>
