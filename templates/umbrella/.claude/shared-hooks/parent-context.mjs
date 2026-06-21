#!/usr/bin/env node
// SessionStart hook: pulls fresh agentmemory context from the umbrella (parent)
// project and injects it into the child session as a <parent-project-context>
// block. Each child keeps its own namespace (project=cwd) but starts every
// session aware of recent umbrella activity.
//
// PARENT_PROJECT defaults to the parent directory of the current child project
// (the standard layout: children are direct subdirs of the umbrella). Override
// with AGENTMEMORY_PARENT_PROJECT if your layout differs.

import { dirname } from "node:path";

const REST_URL = process.env.AGENTMEMORY_URL || "http://127.0.0.1:3111";
const SECRET = process.env.AGENTMEMORY_SECRET || "";
const PARENT_PROJECT =
  process.env.AGENTMEMORY_PARENT_PROJECT ||
  dirname(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const BUDGET = Number(process.env.AGENTMEMORY_PARENT_BUDGET || 1200);

function headers() {
  const h = { "Content-Type": "application/json" };
  if (SECRET) h.Authorization = `Bearer ${SECRET}`;
  return h;
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let data = {};
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  if (
    process.env.AGENTMEMORY_SDK_CHILD === "1" ||
    (data && typeof data === "object" && data.entrypoint === "sdk-ts")
  )
    return;

  const sessionId = data.session_id || `ses_${Date.now().toString(36)}`;

  try {
    const res = await fetch(`${REST_URL}/agentmemory/context`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        sessionId,
        project: PARENT_PROJECT,
        budget: BUDGET,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const result = await res.json();
    if (result && typeof result.context === "string" && result.context.trim()) {
      process.stdout.write(
        `<parent-project-context project="${PARENT_PROJECT}">\n`
      );
      process.stdout.write(result.context);
      if (!result.context.endsWith("\n")) process.stdout.write("\n");
      process.stdout.write(`</parent-project-context>\n`);
    }
  } catch {
    // best-effort: parent-context is informational; never block the session
  }
}

main();
