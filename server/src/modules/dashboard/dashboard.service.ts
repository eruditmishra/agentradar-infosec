import { db } from "../../db/client";
import { calculateAgentRiskScore } from "../security/riskScore";

export async function getDashboardData(tenantId: string | null) {
  const tenantFilter = tenantId ? `tenant_id = $1` : `tenant_id IS NULL`;
  const params = tenantId ? [tenantId] : [];

  // 1. Fetch Agents for Stats and Pie Charts
  const agentsQuery = `
    SELECT
      da.status,
      da.confidence_score,
      da.model,
      da.cloud_provider,
      da.name,
      da.internet_access,
      asa.domains,
      asa.frameworks,
      asa.evidence_completeness
    FROM discovered_agents da
    LEFT JOIN agent_security_assessments asa 
      ON da.id = asa.agent_id 
      ${tenantId ? "AND da.tenant_id = asa.tenant_id" : ""}
    WHERE (da.${tenantFilter}) AND NOT (da.deployment_type = 'identity' AND (da.model IS NULL OR da.model = ''))
  `;
  const agentsRes = await db.query(agentsQuery, params);
  const agents = agentsRes.rows;

  let approvedAgents = 0;
  let shadowAgents = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  const modelsCount: Record<string, number> = {};
  const providerCount: Record<string, number> = {};
  const riskCount: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  
  const alerts: any[] = [];

  for (const agent of agents) {
    // Stats
    if (agent.status === "approved" || agent.status === "conditionally_approved") {
      approvedAgents++;
    } else {
      shadowAgents++; // All other statuses (shadow, under_review, flagged, etc.) are unapproved
    }
    if (agent.confidence_score != null) {
      totalConfidence += Number(agent.confidence_score);
      confidenceCount++;
    }

    // Models Pie Chart
    const modelName = agent.model || "Unknown";
    modelsCount[modelName] = (modelsCount[modelName] || 0) + 1;

    // Provider Pie Chart
    const providerName = agent.cloud_provider || "Unknown";
    providerCount[providerName] = (providerCount[providerName] || 0) + 1;

    // Calculate Risk Score (0-100)
    const riskBreakdown = calculateAgentRiskScore(agent, {
      domains: agent.domains,
      frameworks: agent.frameworks,
      evidence_completeness: agent.evidence_completeness
    });

    riskCount[riskBreakdown.riskLevel]++;

    // Generate Alerts dynamically
    if (riskBreakdown.riskLevel === "Critical" && agent.status === "shadow") {
      alerts.push({ sev: "critical", title: `Critical shadow AI: ${agent.name || 'Unknown Agent'}`, detail: `Shadow agent with critical risk indicators or internet access.` });
    } else if (riskBreakdown.riskLevel === "High" && agent.status === "shadow") {
      alerts.push({ sev: "high", title: `High-risk shadow: ${agent.name || 'Unknown Agent'}`, detail: `Shadow agent detected without governance registration.` });
    }
  }

  const avgConfidence = confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) : 0;

  // Format Pie Charts Data
  const modelsData = Object.entries(modelsCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const providerData = Object.entries(providerCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const riskData = [
    { name: 'Critical', value: riskCount.Critical },
    { name: 'High', value: riskCount.High },
    { name: 'Medium', value: riskCount.Medium },
    { name: 'Low', value: riskCount.Low },
  ];

  // 2. Fetch Recent Scans
  const scansQuery = `
    SELECT 
      ds.id, ds.status, ds.started_at, ds.completed_at, ds.error_message, ds.scan_all,
      (SELECT COALESCE(SUM(agents_found), 0) FROM scan_integrations si WHERE si.scan_id = ds.id) AS agents_found,
      (SELECT ARRAY_AGG(DISTINCT provider) FROM scan_integrations si WHERE si.scan_id = ds.id AND si.provider IS NOT NULL) AS providers_scanned
    FROM discovery_scans ds
    WHERE ds.${tenantFilter} 
    ORDER BY ds.created_at DESC 
    LIMIT 5
  `;
  const scansRes = await db.query(scansQuery, params);
  const recentScans = scansRes.rows.map(scan => ({
    id: scan.id,
    status: scan.status,
    time: scan.completed_at || scan.started_at,
    error: scan.error_message,
    type: scan.scan_all ? 'Full Scan' : 'Targeted Scan',
    agentsFound: Number(scan.agents_found),
    providersScanned: scan.providers_scanned || []
  }));

  // Sort Alerts by severity
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => (rank[a.sev as keyof typeof rank] || 3) - (rank[b.sev as keyof typeof rank] || 3));

  return {
    stats: {
      totalAgents: agents.length,
      approvedAgents,
      shadowAgents,
      avgConfidence
    },
    charts: {
      models: modelsData,
      risk: riskData,
      provider: providerData
    },
    recentScans,
    alerts: alerts.slice(0, 10) // Return top 10 alerts
  };
}

export async function getShadowAgentStats(tenantId: string | null) {
  const tenantFilter = tenantId ? `tenant_id = $1` : `tenant_id IS NULL`;
  const params = tenantId ? [tenantId] : [];
  
  const query = `
    SELECT 
      COUNT(*) as total_shadow,
      COUNT(*) FILTER (WHERE (a.owner IS NULL OR TRIM(a.owner) = '') AND (m.validation_status IS DISTINCT FROM 'approved')) as at_risk,
      COUNT(*) FILTER (WHERE (a.owner IS NOT NULL AND TRIM(a.owner) != '') AND (m.validation_status IS DISTINCT FROM 'approved')) as rogue,
      COUNT(*) FILTER (WHERE (a.owner IS NULL OR TRIM(a.owner) = '') AND m.validation_status = 'approved') as ownerless
    FROM discovered_agents a
    LEFT JOIN discovered_models m ON a.model = m.name AND (a.tenant_id = m.tenant_id OR (a.tenant_id IS NULL AND m.tenant_id IS NULL))
    WHERE a.status NOT IN ('approved', 'conditionally_approved') AND (a.${tenantFilter}) AND NOT (a.deployment_type = 'identity' AND (a.model IS NULL OR a.model = ''))
  `;
  const res = await db.query(query, params);
  const row = res.rows[0];
  
  return {
    totalShadowAgents: parseInt(row.total_shadow, 10) || 0,
    atRiskAgents: parseInt(row.at_risk, 10) || 0,
    rogueAgents: parseInt(row.rogue, 10) || 0,
    ownerless: parseInt(row.ownerless, 10) || 0,
  };
}

export async function getModelStats(tenantId: string | null) {
  const tenantFilter = tenantId ? `tenant_id = $1` : `tenant_id IS NULL`;
  const params = tenantId ? [tenantId] : [];
  
  const query = `
    SELECT 
      COUNT(*) as total_models,
      COUNT(*) FILTER (WHERE validation_status = 'approved') as approved_models,
      COUNT(*) FILTER (WHERE validation_status = 'flagged') as rejected_models,
      COUNT(*) FILTER (WHERE validation_status = 'pending') as pending_models
    FROM discovered_models
    WHERE ${tenantFilter}
  `;
  const res = await db.query(query, params);
  const row = res.rows[0];
  
  return {
    totalModels: parseInt(row.total_models, 10) || 0,
    approvedModels: parseInt(row.approved_models, 10) || 0,
    rejectedModels: parseInt(row.rejected_models, 10) || 0,
    pendingModels: parseInt(row.pending_models, 10) || 0,
  };
}

export async function getVerifiedAgentStats(tenantId: string | null) {
  const tenantFilter = tenantId ? `tenant_id = $1` : `tenant_id IS NULL`;
  const params = tenantId ? [tenantId] : [];
  
  const query = `
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('approved', 'conditionally_approved')) as total_verified,
      COUNT(*) FILTER (WHERE status = 'approved') as auto_verified,
      COUNT(*) FILTER (WHERE status = 'conditionally_approved') as conditionally_verified,
      COUNT(*) FILTER (WHERE status = 'under_review') as under_review
    FROM discovered_agents
    WHERE ${tenantFilter} AND NOT (deployment_type = 'identity' AND (model IS NULL OR model = ''))
  `;
  
  const res = await db.query(query, params);
  const row = res.rows[0];
  
  return {
    totalVerified: parseInt(row.total_verified, 10) || 0,
    autoVerified: parseInt(row.auto_verified, 10) || 0,
    conditionallyVerified: parseInt(row.conditionally_verified, 10) || 0,
    underReview: parseInt(row.under_review, 10) || 0,
  };
}
