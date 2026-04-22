import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const channel = '6h61vhrg';
const collectionIds = [
  'VariableCollectionId:507:29161',
  'VariableCollectionId:11372:3442',
  'VariableCollectionId:11377:2038',
];
const transport = new StdioClientTransport({ command: 'bun', args: ['dist/server.js', '--server=localhost:3055'] });
const client = new Client({ name: 'codex-client', version: '1.0.0' });
const asJson = (toolResult) => toolResult?.structuredContent ?? JSON.parse(toolResult?.content?.[0]?.text ?? '{}');

await client.connect(transport);
await client.callTool({ name: 'join_channel', arguments: { channel } });
const variablesByCollection = [];
for (const collectionId of collectionIds) {
  const payload = asJson(await client.callTool({ name: 'list_variables_in_collection', arguments: { collectionId } }));
  variablesByCollection.push(...(payload.variables ?? []));
}
const variableIds = new Set(variablesByCollection.map((variable) => variable.id));
const broken = [];
for (const variable of variablesByCollection) {
  if (variable.collectionName !== 'Component - Migration' || variable.resolvedType !== 'COLOR') continue;
  for (const [modeId, value] of Object.entries(variable.valuesByMode ?? {})) {
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS' && !variableIds.has(value.id)) {
      broken.push({
        id: variable.id,
        name: variable.name,
        modeId,
        missingReferenceId: value.id,
      });
    }
  }
}
console.log(JSON.stringify({ brokenCount: broken.length, broken }, null, 2));
await client.close();
