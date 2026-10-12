import cron from "node-cron";
import { startScan } from "../discovery/discovery.service";
import { db } from "../../db/client";

let scanTask: any = null;

export function startScheduler() {
  if (scanTask) return;

  // Run every hour at the top of the hour
  scanTask = cron.schedule("0 * * * *", async () => {
    console.log("[scheduler] Checking automated discovery scan schedules...");

    try {
      // Find all distinct tenants that have integrations configured
      const res = await db.query(`SELECT DISTINCT tenant_id FROM integrations WHERE is_active = true`);
      const tenants = res.rows.map(row => row.tenant_id);
      
      // If no tenants, maybe there is a null tenant (single-tenant mode)
      if (tenants.length === 0) {
        tenants.push(null);
      }

      for (const tenantId of tenants) {
        try {
          // Fetch settings for tenant
          const settingsRes = tenantId
            ? await db.query(`SELECT is_enabled, auto_scan_frequency FROM settings WHERE tenant_id = $1`, [tenantId])
            : await db.query(`SELECT is_enabled, auto_scan_frequency FROM settings WHERE tenant_id IS NULL`);
          const frequency = settingsRes.rows[0]?.auto_scan_frequency || 'daily';
          const isEnabled = settingsRes.rows[0]?.is_enabled || false;

          if (!isEnabled) {
            continue; // Skip this tenant if auto scan is not enabled
          }

          // Fetch last auto scan time for tenant
          const scanRes = tenantId
            ? await db.query(`SELECT created_at FROM discovery_scans WHERE tenant_id = $1 AND triggered_by IS NULL ORDER BY created_at DESC LIMIT 1`, [tenantId])
            : await db.query(`SELECT created_at FROM discovery_scans WHERE tenant_id IS NULL AND triggered_by IS NULL ORDER BY created_at DESC LIMIT 1`);
          const lastScan = scanRes.rows[0]?.created_at;

          let shouldScan = false;
          if (!lastScan) {
            shouldScan = true;
          } else {
            const hoursSince = (Date.now() - new Date(lastScan).getTime()) / (1000 * 60 * 60);
            switch (frequency) {
              case 'daily': shouldScan = hoursSince >= 24; break;
              case 'weekly': shouldScan = hoursSince >= (24 * 7); break;
              case 'monthly': shouldScan = hoursSince >= (24 * 30); break;
              case 'quarterly': shouldScan = hoursSince >= (24 * 90); break;
              case 'yearly': shouldScan = hoursSince >= (24 * 365); break;
              default: shouldScan = hoursSince >= 24; break;
            }
          }

          if (shouldScan) {
            console.log(`[scheduler] Starting auto-scan for tenant: ${tenantId}`);
            await startScan(
              tenantId,
              { scan_all: true },
              null, // triggeredBy
              null, // triggeredByEmail
              true  // isAuto
            );
          }
        } catch (err: any) {
          console.error(`[scheduler] Failed to process auto-scan for tenant ${tenantId}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error("[scheduler] Error during automated scan check:", err.message);
    }
  });

  console.log("[scheduler] Automated discovery scanner started. (Hourly check)");
}

export function stopScheduler() {
  if (scanTask) {
    scanTask.stop();
    scanTask = null;
    console.log("[scheduler] Automated discovery scanner stopped.");
  }
}
