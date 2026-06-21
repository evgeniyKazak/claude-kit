#!/usr/bin/env bash
# Shared wrapper for all AgentMemory-related Claude Code hooks.
#
# Single source of truth for env (AGENTMEMORY_URL/SECRET/INJECT_CONTEXT) across
# the umbrella and every child project. Self-resolves its own location so the
# checkout works from any path — nothing here is hardcoded to a host directory.
#
# Resolves the hook script in this order:
#   1. <stack-root>/agentmemory-src/plugin/scripts/<name>   (upstream hooks)
#   2. <this-dir>/<name>                                    (our extras:
#                                                            parent-context.mjs,
#                                                            architecture-context.mjs)
# Bash scripts are exec'd directly; .mjs files via node.
#
# Args: $1 = hook script filename (e.g. session-start.mjs, parent-context.mjs)

set -euo pipefail

# Directory this script lives in: <stack-root>/.claude/shared-hooks
SHARED_DIR="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"
# Stack root = two levels up (.../.claude/shared-hooks -> .../.claude -> stack root)
STACK_ROOT="$(dirname "$(dirname "$SHARED_DIR")")"
AGENTMEMORY_SRC_DIR="${AGENTMEMORY_SRC_DIR:-${STACK_ROOT}/agentmemory-src}"

SCRIPT_NAME="${1:?hook name required}"
PLUGIN_SCRIPT="${AGENTMEMORY_SRC_DIR}/plugin/scripts/${SCRIPT_NAME}"
SHARED_SCRIPT="${SHARED_DIR}/${SCRIPT_NAME}"

# Bearer MUST equal AGENTMEMORY_SECRET in agentmemory.env. Replace the placeholder
# (or export AGENTMEMORY_SECRET in your shell profile so it falls through here).
export AGENTMEMORY_URL="${AGENTMEMORY_URL:-http://127.0.0.1:3111}"
export AGENTMEMORY_SECRET="${AGENTMEMORY_SECRET:-<AGENTMEMORY_SECRET>}"
export AGENTMEMORY_INJECT_CONTEXT="${AGENTMEMORY_INJECT_CONTEXT:-true}"

if [[ -f "$PLUGIN_SCRIPT" ]]; then
  exec node "$PLUGIN_SCRIPT"
fi

if [[ -f "$SHARED_SCRIPT" ]]; then
  case "$SHARED_SCRIPT" in
    *.mjs|*.js) exec node "$SHARED_SCRIPT" ;;
    *.sh)       exec bash "$SHARED_SCRIPT" ;;
    *)          exec "$SHARED_SCRIPT" ;;
  esac
fi

# Script missing — silent no-op (consistent behaviour for unconfigured hooks).
exit 0
