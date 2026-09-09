/**
 * Edge classification: channel + action.
 *
 * The resolved declaration's module tells us WHICH channel an edge belongs to
 * (persistence, queue, HTTP, …). The method name tells us whether the edge is an
 * actual operation on that channel or just a helper that happens to live in the
 * same package — `mapOptions` in database-core reads nothing, and
 * `getRabbitMQExchangeName` in shared/rmq publishes nothing.
 *
 * Only an action edge counts as a side effect, and only an action edge on a
 * remote channel is a `boundary` — the point where the type checker can see the
 * near side of a call but never the far side.
 */

const CHANNELS = [
  {
    match: [/\/node_modules\/typeorm\//, /\/shared\/database-core\//, /\/shared\/database\//],
    channel: 'db',
    remote: false,
    actions: [
      [/^(save|insert|update|delete|softDelete|softRemove|remove|upsert|increment|decrement|execute)$/, 'db.write'],
      [/^(find|findAll|findAllBy|findByIds|findOne|findBy|findOneBy|findOneOrFail|findAndCount|count|exist|createQueryBuilder|getRawMany|getRawOne|getMany|getOne|getCount|query)$/, 'db.read'],
    ],
  },
  {
    match: [/\/node_modules\/mongodb\//, /\/node_modules\/mongoose\//, /\/shared\/mongo-leads-db\//],
    channel: 'db.mongo',
    remote: false,
    actions: [
      [/^(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|bulkWrite|findOneAndUpdate|findOneAndDelete)$/, 'db.mongo.write'],
      [/^(find|findOne|aggregate|countDocuments|distinct)$/, 'db.mongo.read'],
    ],
  },
  {
    match: [/\/node_modules\/@golevelup\/nestjs-rabbitmq\//, /\/node_modules\/amqplib\//, /\/shared\/rmq\//],
    channel: 'queue.amqp',
    remote: true,
    actions: [[/^(publish|sendToQueue|assertQueue|consume|subscribe|request)$/, 'queue.amqp']],
  },
  {
    match: [/\/shared\/queue-core\//],
    channel: 'queue.lambda',
    remote: true,
    actions: [[/^(addTask|createTask|enqueue|push|invoke|send)$/, 'queue.lambda']],
  },
  {
    match: [/\/node_modules\/@aws-sdk\//, /\/node_modules\/aws-sdk\//, /\/shared\/aws\//],
    channel: 'aws',
    remote: true,
    actions: [[/^(send|invoke|upload|download|getObject|putObject|deleteObject|copyObject|listObjects|getSignedUrl|detectText|detectLabels|sendMessage|receiveMessage)$/, 'aws']],
  },
  {
    match: [/\/node_modules\/axios\//, /\/node_modules\/@nestjs\/axios\//, /\/node_modules\/node-fetch\//],
    channel: 'http.out',
    remote: true,
    actions: [[/^(get|post|put|patch|delete|head|options|request|axiosRef|fetch)$/, 'http.out']],
  },
  {
    // Node's own network clients — APNs runs over raw http2 in this repo.
    match: [/\/node_modules\/@types\/node\/http2?\.d\.ts$/, /\/node_modules\/@types\/node\/https\.d\.ts$/],
    channel: 'http.out',
    remote: true,
    actions: [[/^(connect|request|get|post|write|end)$/, 'http.out']],
  },
  {
    // Vendor SDKs that talk to a remote service on our behalf.
    match: [
      /\/node_modules\/google-auth-library\//, /\/node_modules\/googleapis\//,
      /\/node_modules\/twilio\//, /\/node_modules\/nodemailer\//,
      /\/node_modules\/@sendgrid\//, /\/node_modules\/sparkpost\//,
      /\/node_modules\/@sib-api-v3-sdk\//,
    ],
    channel: 'http.out',
    remote: true,
    actions: [[/^(get|post|put|patch|send|create|list|request|authorize|getClient|getAccessToken|fetchIdToken|sendMail|transmissions)$/, 'http.out']],
  },
  {
    match: [/\/node_modules\/ioredis\//, /\/node_modules\/redis\//, /\/shared\/database-cache\//],
    channel: 'cache',
    remote: false,
    actions: [[/^(get|set|del|expire|ttl|hget|hset|hdel|incr|decr|mget|mset|flushdb)$/, 'cache']],
  },
  {
    match: [/\/node_modules\/@nestjs\/event-emitter\//],
    channel: 'event',
    remote: false,
    actions: [[/^(emit|emitAsync|on|once)$/, 'event']],
  },
  {
    match: [/\/shared\/json-logger\//, /\/shared\/app-logger\//],
    channel: 'log',
    remote: false,
    actions: [[/^(debug|log|warn|error|verbose|child)$/, 'log']],
  },
  {
    match: [/\/node_modules\/@nestjs\/common\/exceptions\//],
    channel: 'throw',
    remote: false,
    actions: [[/.*/, 'throw']],
  },
];

// Used only when the module gives no signal at all (unresolved target, or a call
// into plain application code that nevertheless reads like an operation).
const NAME_FALLBACK = [
  [/^(publish|sendToQueue)$/, 'queue.amqp', true],
  [/^(addTask|createTask|enqueue)$/, 'queue.lambda', true],
];

export function classify({ targetFile, methodName, isNew }) {
  if (targetFile) {
    for (const ch of CHANNELS) {
      if (!ch.match.some((re) => re.test(targetFile))) continue;
      for (const [re, kind] of ch.actions) {
        if (re.test(methodName)) return { kind, boundary: ch.remote };
      }
      return { kind: `${ch.channel}.helper`, boundary: false };
    }
  }
  for (const [re, kind, remote] of NAME_FALLBACK) {
    if (re.test(methodName)) return { kind, boundary: remote };
  }
  if (isNew) return { kind: 'construct', boundary: false };
  return { kind: 'call', boundary: false };
}

/** Kinds that represent a real effect on the world, not a helper hop. */
export const SIDE_EFFECT_KINDS = new Set([
  'db.read', 'db.write', 'db.mongo.read', 'db.mongo.write',
  'queue.amqp', 'queue.lambda', 'http.out', 'aws', 'cache', 'event',
]);
