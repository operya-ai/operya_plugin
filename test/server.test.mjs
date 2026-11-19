import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { test } from 'node:test';

test('stdio MCP handshake, tool discovery, and credential error', async () => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, OPERYA_AGENT_TOKEN: '' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const responses = [];
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => responses.push(JSON.parse(line)));
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'agents_schema', arguments: {} } })}\n`);
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('MCP server did not respond')), 3000);
    const check = setInterval(() => {
      if (responses.length === 3) {
        clearTimeout(deadline);
        clearInterval(check);
        resolve();
      }
    }, 10);
  });
  assert.equal(responses.find((x) => x.id === 1).result.serverInfo.name, 'operya-agents');
  assert.deepEqual(responses.find((x) => x.id === 2).result.tools.map((x) => x.name), ['agents_schema', 'agents_graphql', 'agents_http']);
  assert.equal(responses.find((x) => x.id === 3).result.isError, true);
  assert.match(responses.find((x) => x.id === 3).result.content[0].text, /Configure the Operya agent key/);
  child.kill();
});
