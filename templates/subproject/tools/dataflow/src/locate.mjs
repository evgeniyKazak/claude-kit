import ts from 'typescript';
import { lineOf, ownerClass } from './program.mjs';

const isCallableDecl = (n) =>
  ts.isMethodDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isConstructorDeclaration(n) ||
  (ts.isPropertyDeclaration(n) && n.initializer &&
    (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) ||
  (ts.isVariableDeclaration(n) && n.initializer &&
    (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)));

/** Collect every named, callable declaration plus classes in a source file. */
export function listSymbols(sourceFile) {
  const out = [];
  const visit = (n) => {
    if (ts.isClassDeclaration(n) && n.name) {
      out.push({ kind: 'class', class: null, name: n.name.getText(), line: lineOf(n), node: n });
    } else if (isCallableDecl(n) && n.name) {
      out.push({
        kind: ts.isConstructorDeclaration(n) ? 'constructor' : 'function',
        class: ownerClass(n),
        name: n.name.getText(),
        line: lineOf(n),
        node: n,
      });
    } else if (ts.isConstructorDeclaration(n)) {
      out.push({ kind: 'constructor', class: ownerClass(n), name: 'constructor', line: lineOf(n), node: n });
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return out;
}

/**
 * Resolve a symbol spec against a file.
 * Accepted forms: "method", "Class.method", "Class", "123" (a 1-based line number).
 */
export function locate(sourceFile, spec) {
  const symbols = listSymbols(sourceFile);
  if (/^\d+$/.test(spec)) {
    const line = Number(spec);
    const hit = symbols.find((s) => s.line === line);
    if (!hit) throw new Error(`no declaration starts on line ${line}`);
    return hit;
  }
  const [a, b] = spec.split('.');
  const matches = b
    ? symbols.filter((s) => s.class === a && s.name === b)
    : symbols.filter((s) => s.name === a);
  if (matches.length === 0) {
    const near = symbols.slice(0, 40).map((s) => `${s.class ? s.class + '.' : ''}${s.name}:${s.line}`);
    throw new Error(`symbol "${spec}" not found. Available: ${near.join(', ')}${symbols.length > 40 ? ', …' : ''}`);
  }
  if (matches.length > 1 && !b) {
    const qualified = matches.map((s) => `${s.class ?? '<file>'}.${s.name}`).join(', ');
    throw new Error(`"${spec}" is ambiguous, qualify it: ${qualified}`);
  }
  return matches[0];
}

/** Position of the identifier itself — what the language service wants. */
export function namePosition(decl) {
  const nameNode = decl.name ?? decl;
  return nameNode.getStart();
}
