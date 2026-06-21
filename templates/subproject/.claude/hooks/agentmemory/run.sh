#!/usr/bin/env bash
# Thin wrapper that delegates to the shared agentmemory hook runner. This service
# runs as its own Claude project; all hook logic lives in the umbrella's
# shared-hooks/. Keep this file two lines (no logic). Replace <STACK_ROOT> with
# the absolute path to the umbrella root, then `chmod +x` this file.
exec "<STACK_ROOT>/.claude/shared-hooks/agentmemory-run.sh" "$@"
