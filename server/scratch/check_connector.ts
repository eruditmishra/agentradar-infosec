import { db } from '../src/db/client';

async function main() {
  const res = await db.query(
    "SELECT id, name, provider, config, secrets_encrypted FROM integration_connections WHERE provider = 'azure' LIMIT 3"
  );
  for (const row of res.rows) {
    const c = { ...row.config };
    if (c.clientId) c.clientId = c.clientId?.slice(0, 8) + '...';
    if (c.tenantId) c.tenantId = c.tenantId?.slice(0, 8) + '...';
    const hasSe = row.secrets_encrypted != null && row.secrets_encrypted !== '';
    const seLen = typeof row.secrets_encrypted === 'string' ? row.secrets_encrypted.length : 0;
    console.log(`\n=== Connector: ${row.name} (${row.id}) ===`);
    console.log('  config:', JSON.stringify(c));
    console.log(`  secrets_encrypted: ${hasSe ? `[present, ${seLen} chars]` : 'NULL / EMPTY'}`);
    console.log('  secrets_encrypted preview:', String(row.secrets_encrypted || '').slice(0, 60));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
