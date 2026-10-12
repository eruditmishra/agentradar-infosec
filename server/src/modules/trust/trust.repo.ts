import { db } from "../../db/client";
import type { ModelValidationStatus, AgentGovernanceStatus } from "../discovery/discovery.types";

export async function findModelValidationStatus(
  modelId: string,
  tenantId: string | null,
): Promise<ModelValidationStatus | null> {
  const res = tenantId
    ? await db.query(
        `SELECT validation_status FROM discovered_models WHERE id = $1 AND tenant_id = $2`,
        [modelId, tenantId],
      )
    : await db.query(
        `SELECT validation_status FROM discovered_models WHERE id = $1 AND tenant_id IS NULL`,
        [modelId],
      );
  return res.rows[0]?.validation_status ?? null;
}

export async function updateModelValidationStatus(
  modelId: string,
  tenantId: string | null,
  status: ModelValidationStatus,
  reviewedBy: string | null,
): Promise<{ id: string; name: string } | null> {
  const res = tenantId
    ? await db.query(
        `UPDATE discovered_models 
         SET validation_status = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, name`,
        [modelId, tenantId, status, reviewedBy],
      )
    : await db.query(
        `UPDATE discovered_models 
         SET validation_status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
         WHERE id = $1 AND tenant_id IS NULL
         RETURNING id, name`,
        [modelId, status, reviewedBy],
      );
  return res.rows[0] ?? null;
}

export async function findAgentGovernanceStatus(
  agentId: string,
  tenantId: string | null,
): Promise<AgentGovernanceStatus | null> {
  const res = tenantId
    ? await db.query(
        `SELECT status FROM discovered_agents WHERE id = $1 AND tenant_id = $2`,
        [agentId, tenantId],
      )
    : await db.query(
        `SELECT status FROM discovered_agents WHERE id = $1 AND tenant_id IS NULL`,
        [agentId],
      );
  return res.rows[0]?.status ?? null;
}

export async function updateAgentGovernanceStatus(
  agentId: string,
  tenantId: string | null,
  status: AgentGovernanceStatus,
): Promise<{ id: string; agent_config: any } | null> {
  const res = tenantId
    ? await db.query(
        `UPDATE discovered_agents 
         SET status = $3, updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, agent_config`,
        [agentId, tenantId, status],
      )
    : await db.query(
        `UPDATE discovered_agents 
         SET status = $2, updated_at = now()
         WHERE id = $1 AND tenant_id IS NULL
         RETURNING id, agent_config`,
        [agentId, status],
      );
  return res.rows[0] ?? null;
}

export async function approveAgentsByModel(
  modelId: string,
  tenantId: string | null,
): Promise<{ id: string; name: string | null }[]> {
  const res = tenantId
    ? await db.query(
        `UPDATE discovered_agents da
         SET status = 'approved', updated_at = now()
         FROM agent_model_usage amu
         WHERE da.id = amu.agent_id
           AND amu.model_id = $1
           AND da.tenant_id = $2
           AND da.status != 'approved'
           AND da.owner IS NOT NULL AND TRIM(da.owner) != ''
         RETURNING da.id, da.name`,
        [modelId, tenantId],
      )
    : await db.query(
        `UPDATE discovered_agents da
         SET status = 'approved', updated_at = now()
         FROM agent_model_usage amu
         WHERE da.id = amu.agent_id
           AND amu.model_id = $1
           AND da.tenant_id IS NULL
           AND da.status != 'approved'
           AND da.owner IS NOT NULL AND TRIM(da.owner) != ''
         RETURNING da.id, da.name`,
        [modelId],
      );
  return res.rows;
}

export async function shadowAgentsByModel(
  modelId: string,
  tenantId: string | null,
): Promise<{ id: string; name: string | null }[]> {
  const res = tenantId
    ? await db.query(
        `UPDATE discovered_agents da
         SET status = 'shadow', updated_at = now()
         FROM agent_model_usage amu
         WHERE da.id = amu.agent_id
           AND amu.model_id = $1
           AND da.tenant_id = $2
           AND da.status != 'shadow'
         RETURNING da.id, da.name`,
        [modelId, tenantId],
      )
    : await db.query(
        `UPDATE discovered_agents da
         SET status = 'shadow', updated_at = now()
         FROM agent_model_usage amu
         WHERE da.id = amu.agent_id
           AND amu.model_id = $1
           AND da.tenant_id IS NULL
           AND da.status != 'shadow'
         RETURNING da.id, da.name`,
        [modelId],
      );
  return res.rows;
}
