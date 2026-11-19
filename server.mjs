import { createInterface } from 'node:readline';

const ORIGIN = 'https://agents.operya.ai';
const VERSION = '2025-06-18';
const MAX_TEXT = 256 * 1024;
const MAX_BINARY = 1024 * 1024;

const tools = [
  {
    name: 'agents_schema',
    description: 'Fetch the GraphQL schema for the currently configured Operya agent key. Use this to discover the exact operations and arguments available to this key.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'agents_graphql',
    description: 'Execute one GraphQL query or mutation against the Operya Agents gateway. The key determines the vertical and permissions. Discover the authenticated schema first; mutations change live business data.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'GraphQL document' },
        variables: { type: 'object', description: 'Optional GraphQL variables' },
        operationName: { type: 'string', description: 'Required if the document has multiple operations' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { openWorldHint: true },
  },
  {
    name: 'agents_http',
    description: 'Call a documented path on the Operya Agents gateway, including Dispatch queue REST routes and authorized downloads. Paths are relative to https://agents.operya.ai. POST may change live data.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST'] },
        path: { type: 'string', description: 'Absolute path on the gateway, optionally with query string; for example /v1/queues or /v1/jobs?queue=ID&state=queued' },
        body: { type: 'object', description: 'JSON request body for POST' },
      },
      required: ['method', 'path'],
      additionalProperties: false,
    },
    annotations: { openWorldHint: true },
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: '2.0', id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function token() {
  const value = process.env.OPERYA_AGENT_TOKEN;
  if (!value || value.startsWith('${user_config.')) throw new Error('Configure the Operya agent key in the plugin options.');
  if (/\s/.test(value)) throw new Error('The Operya agent key must not contain whitespace.');
  return value;
}

function gatewayUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('#') || path.includes('\\')) {
    throw new Error('Use a relative gateway path beginning with one slash.');
  }
  const url = new URL(path, ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith('/')) throw new Error('The path must stay on the Operya Agents gateway.');
  return url;
}

async function request(method, path, body) {
  const headers = { Authorization: `Bearer ${token()}`, Accept: 'application/json, text/plain, application/octet-stream' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(gatewayUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  const mime = (response.headers.get('content-type') ?? '').split(';')[0].toLowerCase();
  const binary = !mime.includes('json') && !mime.startsWith('text/') && mime !== 'application/graphql';
  const limit = binary ? MAX_BINARY : MAX_TEXT;
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > limit) throw new Error(`Response exceeds ${limit} bytes; use a dedicated download client.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > limit) throw new Error(`Response exceeds ${limit} bytes; use a dedicated download client.`);
  const payload = binary
    ? { encoding: 'base64', contentType: mime || 'application/octet-stream', data: Buffer.from(bytes).toString('base64') }
    : new TextDecoder().decode(bytes);
  return { status: response.status, contentType: mime, body: payload };
}

async function call(name, args) {
  if (name === 'agents_schema') return request('GET', '/schema.graphql');
  if (name === 'agents_graphql') {
    if (typeof args.query !== 'string' || !args.query.trim()) throw new Error('query must be a non-empty GraphQL document.');
    if (args.variables !== undefined && (args.variables === null || typeof args.variables !== 'object' || Array.isArray(args.variables))) throw new Error('variables must be an object.');
    if (args.operationName !== undefined && typeof args.operationName !== 'string') throw new Error('operationName must be a string.');
    return request('POST', '/graphql', { query: args.query, variables: args.variables, operationName: args.operationName });
  }
  if (name === 'agents_http') {
    if (!['GET', 'POST'].includes(args.method)) throw new Error('method must be GET or POST.');
    if (args.method === 'GET' && args.body !== undefined) throw new Error('GET does not accept a body.');
    if (args.method === 'POST' && (args.body === null || typeof args.body !== 'object' || Array.isArray(args.body))) throw new Error('POST body must be a JSON object.');
    return request(args.method, args.path, args.body);
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return;
  if (message.id === undefined) return;
  const { id, method } = message;
  if (method === 'initialize') return result(id, {
    protocolVersion: VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'operya-agents', version: '0.1.0' },
  });
  if (method === 'ping') return result(id, {});
  if (method === 'tools/list') return result(id, { tools });
  if (method === 'tools/call') {
    try {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.');
      const value = await call(name, args);
      return result(id, { content: [{ type: 'text', text: JSON.stringify(value) }], isError: value.status >= 400 });
    } catch (cause) {
      return result(id, { content: [{ type: 'text', text: cause instanceof Error ? cause.message : String(cause) }], isError: true });
    }
  }
  error(id, -32601, `Method not found: ${method}`);
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', (line) => {
  try {
    void handle(JSON.parse(line));
  } catch {
    error(null, -32700, 'Invalid JSON.');
  }
});
