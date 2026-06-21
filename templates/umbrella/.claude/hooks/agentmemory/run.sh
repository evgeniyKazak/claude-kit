#!/usr/bin/env bash
# Thin wrapper that delegates to the shared agentmemory hook runner.
# The umbrella runs as its own Claude project; all hook logic lives in
# shared-hooks/agentmemory-run.sh. This file must stay two lines (no logic).
exec "<STACK_ROOT>/.claude/shared-hooks/agentmemory-run.sh" "$@"
