// Sonde lecture seule : forme réelle des signaux et des mappings du workspace.
// Question : comment rattacher un signal à un domaine sans company mapping ?
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

for (const ligne of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const transport = new StreamableHTTPClientTransport(new URL(process.env.SILLAGE_API_BASE_URL), {
  requestInit: { headers: { Authorization: `Bearer ${process.env.SILLAGE_API_KEY}` } },
});
const client = new Client({ name: 'probe-signals', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

async function call(name, args) {
  const r = await client.callTool({ name: `sillage_v2_${name}`, arguments: args });
  if (r.isError) return { erreur: r.content?.[0]?.text ?? 'erreur sans message' };
  return r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? 'null');
}

const mappings = await call('list_company_mappings', { page: 1, page_size: 10 });
console.log('=== MAPPINGS (10 premiers) ===');
for (const m of mappings.data ?? []) {
  console.log(`  mapping ${m.id} → company ${m.company?.id} (${m.company?.name}, ${m.company?.domain})`);
}

const signaux = await call('list_signals', { page_size: 5 });
console.log('\n=== SIGNAUX (5 premiers, forme brute) ===');
console.log(JSON.stringify(signaux, null, 2).slice(0, 3000));

await client.close();
