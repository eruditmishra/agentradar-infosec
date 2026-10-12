import { bulkReassessTenant } from "../src/modules/security/security.service";
import { db } from "../src/db/client";

async function main() {
  console.log("[bulk-reassess] Starting...");
  // Reassess all tenants: pass null to cover no-tenant rows,
  // then find all distinct tenant_ids and reassess each.
  const noTenantResult = await bulkReassessTenant(null, 20);
  console.log("[bulk-reassess] No-tenant:", noTenantResult);

  const tenantsRes = await db.query(
    "SELECT DISTINCT tenant_id FROM discovered_agents WHERE tenant_id IS NOT NULL"
  );
  for (const row of tenantsRes.rows) {
    const r = await bulkReassessTenant(row.tenant_id, 20);
    console.log(`[bulk-reassess] tenant ${row.tenant_id}:`, r);
  }
  console.log("[bulk-reassess] All done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[bulk-reassess] Fatal:", e);
  process.exit(1);
});
