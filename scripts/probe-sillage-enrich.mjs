// Sonde : enrich_company(domain) renvoie-t-il un company_id exploitable pour
// filtrer les signaux, sans passer par un company mapping ?
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
const client = new Client({ name: 'probe-enrich', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

async function call(name, args) {
  const r = await client.callTool({ name: `sillage_v2_${name}`, arguments: args });
  if (r.isError) return { erreur: r.content?.[0]?.text ?? 'erreur sans message' };
  return r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? 'null');
}

console.log('=== enrich_company({ domain: "algolia.com" }) ===');
const enrich = await call('enrich_company', { domain: 'algolia.com' });
console.log(JSON.stringify(enrich, null, 2).slice(0, 2500));

await client.close();
