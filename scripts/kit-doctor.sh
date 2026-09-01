#!/usr/bin/env bash
# claude-kit doctor — machine-checkable conformance of an installed stack.
# Run from <STACK_ROOT>. Requires: bash, jq. Exit 1 if any check FAILs.
set -u

FAILS=0
ok()   { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
warn() { printf 'warn  %s\n' "$1"; }

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

# --- manifest ---
MANIFEST=.claude/kit-manifest.json
if [ -f "$MANIFEST" ] && jq -e '.kit and .version and .commit' "$MANIFEST" >/dev/null 2>&1; then
  ok "manifest: $MANIFEST valid (kit $(jq -r .version "$MANIFEST"))"
else
  fail "manifest: $MANIFEST missing or invalid (needs .kit/.version/.commit)"
fi

# --- shared runner + hook wrappers executable ---
if [ -x .claude/shared-hooks/agentmemory-run.sh ]; then
  ok "shared runner executable"
else
  fail "shared runner .claude/shared-hooks/agentmemory-run.sh missing or not executable"
fi
while IFS= read -r w; do
  if [ -x "$w" ]; then ok "hook wrapper executable: $w"; else fail "hook wrapper not executable: $w"; fi
done < <(find . -path ./.agents -prune -o -path '*/.claude/hooks/agentmemory/run.sh' -print 2>/dev/null)

# --- 12-hook block + SessionStart order in every settings.local.json with a hooks key ---
HOOK_POINTS='SessionStart UserPromptSubmit PreToolUse PostToolUse PostToolUseFailure PreCompact SubagentStart SubagentStop Notification TaskCompleted Stop SessionEnd'
while IFS= read -r s; do
  jq -e '.hooks' "$s" >/dev/null 2>&1 || continue
  missing=""
  for h in $HOOK_POINTS; do
    jq -e --arg h "$h" '.hooks[$h]' "$s" >/dev/null 2>&1 || missing="$missing $h"
  done
  if [ -n "$missing" ]; then
    fail "hook block incomplete in $s — missing:$missing"
  else
    ok "12-hook block complete: $s"
  fi
  # child sessions must chain session-start -> architecture-context -> parent-context
  case "$s" in
    ./.claude/*) : ;;  # umbrella: single SessionStart hook, no chain required
    *)
      chain=$(jq -r '[.hooks.SessionStart[].hooks[].command] | join(" ")' "$s" 2>/dev/null)
      case "$chain" in
        *session-start.mjs*architecture-context.mjs*parent-context.mjs*)
          ok "SessionStart chain order: $s" ;;
        *)
          fail "SessionStart chain wrong/missing in $s (need session-start -> architecture-context -> parent-context)" ;;
      esac ;;
  esac
done < <(find . -path ./.agents -prune -o -name settings.local.json -path '*/.claude/*' -print 2>/dev/null)

# --- skills ---
if [ -f .claude/skills/archify/SKILL.md ]; then
  ok "skill installed: archify"
  if [ -f "$MANIFEST" ] && [ -f .claude/skills/archify/skill-release.json ]; then
    want=$(jq -r '.skills.archify.version // empty' "$MANIFEST")
    have=$(jq -r '.version // empty' .claude/skills/archify/skill-release.json)
    if [ -n "$want" ] && [ "$want" != "$have" ]; then
      warn "archify version drift: installed $have, manifest $want (upgrade skills only via UPDATE.md)"
    fi
  fi
else
  fail "skill missing: .claude/skills/archify (npx skills add tt-a1i/archify)"
fi
if [ -d .claude/skills/lavish ]; then
  ok "skill installed: lavish"
else
  fail "skill missing: .claude/skills/lavish (npx skills add kunchenguid/lavish-axi --skill lavish)"
fi

# --- mandate markers in every workflow.md ---
while IFS= read -r w; do
  if grep -q 'claude-kit:begin mandate' "$w"; then
    ok "mandate marker: $w"
  else
    fail "mandate marker missing: $w (managed block claude-kit:begin/end mandate)"
  fi
done < <(find . -path ./.agents -prune -o -path '*/.claude/rules/workflow.md' -print 2>/dev/null)

# --- diagrams/ at umbrella and per sub-project (a sub-project = dir with CLAUDE.md + .claude/) ---
if [ -d diagrams ]; then ok "umbrella diagrams/ exists"; else fail "umbrella diagrams/ missing"; fi
for d in */; do
  [ -f "${d}CLAUDE.md" ] && [ -d "${d}.claude" ] || continue
  if [ -d "${d}diagrams" ]; then ok "diagrams/ exists: ${d%/}"; else fail "diagrams/ missing: ${d%/}"; fi
done

echo
if [ "$FAILS" -gt 0 ]; then
  echo "kit-doctor: $FAILS check(s) FAILED"
  exit 1
fi
echo "kit-doctor: all checks passed"
