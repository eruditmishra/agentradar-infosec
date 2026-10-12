import { db } from "../src/db/client";

async function main() {
  const res = await db.query(`
    SELECT da.name, da.status, da.owner,
           asa.evidence_completeness->>'overall' as completeness,
           asa.frameworks->'owasp_ai_agents_2026' as owasp
    FROM discovered_agents da
    LEFT JOIN agent_security_assessments asa ON da.id = asa.agent_id
    ORDER BY da.name
    LIMIT 11
  `);
  for (const r of res.rows) {
    const controls = r.owasp?.controls ?? {};
    const controlCount = Object.keys(controls).length;
    const detected = Object.values(controls).filter((c: any) => c.status === "detected").length;
    const gap = Object.values(controls).filter((c: any) => c.status === "control_gap").length;
    const unknown = Object.values(controls).filter((c: any) => c.status === "unknown").length;
    console.log(JSON.stringify({
      name: r.name,
      status: r.status,
      owner: r.owner,
      completeness: r.completeness,
      controlCount,
      detected,
      gap,
      unknown,
    }));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
