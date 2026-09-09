import ts from 'typescript';
import { rel, lineOf, ownerClass } from './program.mjs';

/**
 * What counts as a place a request can enter this monorepo.
 *
 * A reverse trace has to stop somewhere, and "nothing calls this any more" is the
 * wrong answer: a controller method is called by Nest's router, a @RabbitSubscribe
 * handler by the broker, a @Cron method by the scheduler. None of those callers
 * exist in the type graph, so without this table the traversal would report the
 * handler as an ordinary leaf and the diagram would lose the only fact the reader
 * actually asked for — where the path starts.
 *
 * Decorator names are matched, not resolved: the decorator's identity is a string
 * in the source either way, and matching the name avoids dragging the whole
 * @nestjs/common declaration graph into every query.
 */
const DECORATOR_KINDS = [
  { kind: 'http', names: ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options'] },
  { kind: 'queue.amqp', names: ['RabbitSubscribe', 'RabbitRPC', 'MessagePattern', 'EventPattern'] },
  { kind: 'schedule', names: ['Cron', 'Interval', 'Timeout'] },
  { kind: 'event', names: ['OnEvent'] },
];

function decoratorsOf(node) {
  const all = ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
  return all.map((d) => {
    const expr = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
    const args = ts.isCallExpression(d.expression) ? d.expression.arguments : [];
    return {
      name: expr.getText(),
      args: args.map((a) => (ts.isStringLiteral(a) ? a.text : a.getText().replace(/\s+/g, ' ').trim())),
      // @RabbitSubscribe/@RabbitRPC take an options object, so the routing key —
      // the only part that names the contract — has to be pulled out of it.
      routingKey: routingKeyOf(args),
    };
  });
}

function routingKeyOf(args) {
  for (const a of args) {
    if (!ts.isObjectLiteralExpression(a)) continue;
    for (const prop of a.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (prop.name?.getText?.() !== 'routingKey') continue;
      const v = prop.initializer;
      return ts.isStringLiteral(v) ? v.text : v.getText().replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

function classOf(decl) {
  let p = decl.parent;
  while (p && !ts.isClassDeclaration(p) && !ts.isSourceFile(p)) p = p.parent;
  return p && ts.isClassDeclaration(p) ? p : null;
}

/** HTTP route prefix declared on the owning @Controller('...'). */
function controllerPrefix(cls) {
  if (!cls) return null;
  const dec = decoratorsOf(cls).find((d) => d.name === 'Controller');
  if (!dec) return null;
  return dec.args[0] ?? '';
}

/**
 * Classify one declaration as an entry point, or return null.
 * Returns the channel it enters through plus a readable route/topic, which is what
 * the diagram labels the starting node with.
 */
export function entryPointOf(decl) {
  if (!decl || !decl.parent) return null;
  const own = decoratorsOf(decl);
  const cls = classOf(decl);

  for (const { kind, names } of DECORATOR_KINDS) {
    const hit = own.find((d) => names.includes(d.name));
    if (!hit) continue;

    if (kind === 'http') {
      const prefix = controllerPrefix(cls);
      // A route decorator outside a @Controller is not reachable over HTTP.
      if (prefix === null) continue;
      const segment = hit.args[0] ?? '';
      const route = ('/' + [prefix, segment].filter(Boolean).join('/')).replace(/\/+/g, '/');
      return { kind: 'http.in', label: `${hit.name.toUpperCase()} ${route}`, detail: route };
    }
    if (kind === 'queue.amqp') {
      const topic = hit.routingKey
        ?? hit.args.find((a) => /^[\w.#*-]+$/.test(a) && (a.includes('.') || a.includes('#') || a.includes('*')))
        ?? null;
      return { kind: 'queue.amqp.in', label: `${hit.name} ${topic ?? ''}`.trim(), detail: topic };
    }
    if (kind === 'schedule') {
      return { kind: 'schedule.in', label: `${hit.name}(${hit.args[0] ?? ''})`, detail: hit.args[0] ?? null };
    }
    return { kind: 'event.in', label: `OnEvent ${hit.args[0] ?? ''}`.trim(), detail: hit.args[0] ?? null };
  }

  // A Lambda handler is a plain exported function in a handler file — no decorator
  // marks it, so the file path is the only available signal.
  const file = decl.getSourceFile().fileName;
  if (/\/(handler|lambda|main)\.ts$/.test(file)) {
    const name = decl.name?.getText?.() ?? '';
    if (/^(handler|bootstrap|main)$/.test(name)) {
      return { kind: 'lambda.in', label: `${name}()`, detail: rel(file) };
    }
  }
  return null;
}

/** Entry-point kinds get a distinct archify node type so the diagram reads at a glance. */
export const ENTRY_NODE_TYPE = {
  'http.in': 'frontend',
  'queue.amqp.in': 'messagebus',
  'schedule.in': 'cloud',
  'event.in': 'messagebus',
  'lambda.in': 'cloud',
};

export function describe(decl) {
  return {
    class: ownerClass(decl),
    name: decl.name?.getText?.() ?? '<anonymous>',
    file: rel(decl.getSourceFile().fileName),
    line: lineOf(decl),
  };
}

export { decoratorsOf, classOf, controllerPrefix };
