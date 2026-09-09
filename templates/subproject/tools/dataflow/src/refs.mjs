import { rel } from './program.mjs';
import { namePosition } from './locate.mjs';

/**
 * Reverse direction: every place the symbol is used. This is literally the IDE's
 * "Find All References" — same API, same result set.
 * Requires scope=repo, otherwise the program only contains files reachable from
 * the entry and the answer is silently incomplete.
 */
export function findReferences(ctx, sourceFile, target) {
  const { service, program } = ctx;
  const pos = namePosition(target.node);
  const hits = service.getReferencesAtPosition(sourceFile.fileName, pos) ?? [];

  const byFile = new Map();
  for (const h of hits) {
    const sf = program.getSourceFile(h.fileName);
    if (!sf) continue;
    const line = sf.getLineAndCharacterOfPosition(h.textSpan.start).line + 1;
    const text = sf.text.split('\n')[line - 1]?.trim() ?? '';
    const key = rel(h.fileName);
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push({
      line,
      definition: !!h.isDefinition,
      write: !!h.isWriteAccess,
      code: text.length > 160 ? text.slice(0, 157) + '…' : text,
    });
  }

  return {
    symbol: {
      class: target.class,
      name: target.name,
      file: rel(sourceFile.fileName),
      line: target.line,
    },
    total: hits.length,
    files: byFile.size,
    references: [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, uses]) => ({ file, uses: uses.sort((x, y) => x.line - y.line) })),
  };
}
