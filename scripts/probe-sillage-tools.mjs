// Sonde ponctuelle : liste les outils MCP Sillage et leurs schémas d'entrée,
// pour savoir si on peut résoudre domaine → company_id sans company mapping.
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Charge .env à la main (pas de dotenv en dépendance)
for (const ligne of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const baseUrl = process.env.SILLAGE_API_BASE_URL;
const apiKey = process.env.SILLAGE_API_KEY;
if (!baseUrl || !apiKey) {
  console.error('SILLAGE_API_BASE_URL ou SILLAGE_API_KEY manquante dans .env');
  process.exit(1);
}

const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
  requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
});
const client = new Client({ name: 'probe-tools', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`${tools.length} outils exposés :\n`);
for (const t of tools) {
  const props = Object.keys(t.inputSchema?.properties ?? {});
  console.log(`- ${t.name}(${props.join(', ')})`);
}
await client.close();
