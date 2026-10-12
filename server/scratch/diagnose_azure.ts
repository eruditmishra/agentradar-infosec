/**
 * Diagnostic: Run the Azure ecosystem scanner directly and print all
 * discovery errors + per-collector stats.
 *
 * Run:  npx tsx scratch/diagnose_azure.ts
 */
import { db } from '../src/db/client';
import { decryptSecrets } from '../src/lib/encryption';

// False positive (Client Privacy Violation / Insecure Storage of Sensitive
// Data): the scan traced `decipher`/`ciphertextB64` (encryption.ts) into the
// console.log calls below via the `decrypted` variable. Only Object.keys()
// (field names) and a boolean presence check are ever logged — the actual
// decrypted secret values (e.g. clientSecret) are never printed. This is
// also a local, manually-run diagnostic script (not part of any deployed
// request path).
async function main() {
  // Load the first Azure connector
  const res = await db.query(
    "SELECT id, name, provider, config, secrets_encrypted FROM integration_connections WHERE provider = 'azure' LIMIT 1"
  );
  const connector = res.rows[0];
  if (!connector) { console.log('No Azure connector found'); process.exit(1); }

  console.log(`Using connector: ${connector.name} (${connector.id})\n`);

  const decrypted = decryptSecrets(connector.secrets_encrypted) as any;
  const conn = {
    id: connector.id,
    name: connector.name,
    environment: connector.environment,
    provider: connector.provider,
    config: connector.config,
    secrets: decrypted,
  };

  console.log('Config keys:', Object.keys(conn.config as object));
  console.log('Secrets keys:', Object.keys(decrypted || {}));
  console.log('clientSecret present:', !!(decrypted as any)?.clientSecret);
  console.log('');

  // Dynamic import of the scanner (same as discovery.service.ts does)
  const scanner = await import('../src/modules/discovery/scanners/azure/azure.deepscanner.js') as any;
  console.log('Scanner exports:', Object.keys(scanner).join(', '));
  console.log('');

  console.log('=== Running discoverAzureEcosystem... ===\n');
  const result = await scanner.discoverAzureEcosystem(conn);

  console.log(`\nTotal observations: ${result.observations.length}`);
  console.log(`Total discovery errors: ${(result.discoveryErrors || []).length}`);
  console.log('\n--- Discovery Errors ---');
  for (const err of result.discoveryErrors || []) {
    console.log(`  [${err.collector || err.discoveryType}] ${err.discoveryStatus}: ${err.error}`);
  }

  console.log('\n--- Stats by collector ---');
  console.log(JSON.stringify(result.stats, null, 2));

  console.log('\n--- Observations summary ---');
  for (const obs of result.observations) {
    const meta = obs.metadata || {};
    console.log(`  [${obs.fingerprint}] agentStatus=${meta.agentStatus} inventoryClass=${meta.inventoryClass} collector=${obs.collector_id}`);
  }
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e.message || e);
  process.exit(1);
});
