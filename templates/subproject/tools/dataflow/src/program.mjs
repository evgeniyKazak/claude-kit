import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const rel = (f) => path.relative(ROOT, f);
export const isExternal = (f) => f.includes('/node_modules/') || f.endsWith('.d.ts');

function readConfig() {
  const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json');
  if (!cfgPath) throw new Error(`tsconfig.json not found under ${ROOT}`);
  const raw = ts.readConfigFile(cfgPath, ts.sys.readFile);
  if (raw.error) throw new Error(ts.flattenDiagnosticMessageText(raw.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(raw.config, ts.sys, ROOT);
}

/**
 * scope 'seed' -> root files = [entryFile]; module resolution pulls in exactly the
 *                 reachable subgraph. Cheap (~3 s), but sees nothing that does not
 *                 import (transitively) from the entry file.
 * scope 'repo' -> root files = every .ts in tsconfig minus specs/e2e. Expensive
 *                 (~19 s, ~2.7 GB) but required for reverse lookups.
 */
export function createService({ scope = 'seed', entryFile = null, includeSpecs = false } = {}) {
  const cfg = readConfig();
  let roots;
  if (scope === 'seed') {
    if (!entryFile) throw new Error('scope "seed" requires an entry file');
    roots = [path.resolve(ROOT, entryFile)];
  } else {
    roots = cfg.fileNames.filter(
      (f) => includeSpecs || (!f.endsWith('.spec.ts') && !f.endsWith('.e2e-spec.ts') && !f.includes('/test/')),
    );
  }

  const options = { ...cfg.options, noEmit: true, skipLibCheck: true, incremental: false };
  const host = {
    getScriptFileNames: () => roots,
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) => {
      const text = ts.sys.readFile(f);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => ROOT,
    getCompilationSettings: () => options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const program = service.getProgram();
  return { service, program, checker: program.getTypeChecker(), rootCount: roots.length };
}

export const lineOf = (node) =>
  node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;

export function ownerClass(decl) {
  let p = decl.parent;
  while (p && !ts.isClassDeclaration(p) && !ts.isClassExpression(p) && !ts.isInterfaceDeclaration(p) && !ts.isSourceFile(p)) {
    p = p.parent;
  }
  return p && !ts.isSourceFile(p) ? p.name?.getText() ?? null : null;
}
