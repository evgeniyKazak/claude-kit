#!/usr/bin/env node
// SessionStart hook: injects the umbrella ARCHITECTURE.md into the child session
// as an <architecture-context> block. Static counterpart to parent-context.mjs
// (dynamic agentmemory pull) — guarantees every child knows the cross-service
// topology even on a freshly-restarted agentmemory or empty umbrella namespace.
//
// ARCH_PATH defaults to ARCHITECTURE.md in the parent directory of the current
// child project. Override with AGENTMEMORY_ARCHITECTURE_PATH if needed.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PARENT =
  process.env.AGENTMEMORY_PARENT_PROJECT ||
  dirname(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const ARCH_PATH =
  process.env.AGENTMEMORY_ARCHITECTURE_PATH || join(PARENT, "ARCHITECTURE.md");

// Rough chars-per-token for mixed markdown content. 1500 token budget ≈ 6000
// chars. Truncation prefers cutting at section boundaries.
const BUDGET_TOKENS = Number(process.env.AGENTMEMORY_ARCHITECTURE_BUDGET || 1500);
const CHAR_BUDGET = BUDGET_TOKENS * 4;

function truncateToBudget(text, budget) {
  if (text.length <= budget) return text;
  const head = text.slice(0, budget);
  const lastHeading = head.lastIndexOf("\n## ");
  if (lastHeading > budget * 0.5) {
    return head.slice(0, lastHeading) + "\n\n[...truncated]\n";
  }
  const lastNewline = head.lastIndexOf("\n");
  return head.slice(0, lastNewline > 0 ? lastNewline : budget) + "\n\n[...truncated]\n";
}

async function main() {
  // Drain stdin so the harness doesn't block; payload is not used here.
  for await (const _ of process.stdin) {
    // discard
  }

  let content;
  try {
    content = await readFile(ARCH_PATH, "utf8");
  } catch {
    return;
  }
  if (!content.trim()) return;

  const trimmed = truncateToBudget(content, CHAR_BUDGET);
  process.stdout.write(`<architecture-context path="${ARCH_PATH}">\n`);
  process.stdout.write(trimmed);
  if (!trimmed.endsWith("\n")) process.stdout.write("\n");
  process.stdout.write(`</architecture-context>\n`);
}

main();
