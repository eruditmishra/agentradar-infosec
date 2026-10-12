import * as repo from "./trust.repo";
import type { ApproveModelResult } from "./trust.types";
import { NotFoundError } from "../../shared/errors";
import type { ModelValidationStatus, AgentGovernanceStatus } from "../discovery/discovery.types";
import * as audit from "../audit/audit.service";

export async function approveModel(
  modelId: string,
  tenantId: string | null,
  userId: string | null,
  status: ModelValidationStatus = "approved",
  actor?: { userEmail?: string | null },
): Promise<ApproveModelResult> {
  const previousStatus = await repo.findModelValidationStatus(modelId, tenantId);
  if (!previousStatus) {
    throw new NotFoundError("Model not found");
  }

  // 1. Update the model status
  const updatedModel = await repo.updateModelValidationStatus(modelId, tenantId, status, userId);

  // 2. Cascade status to agents
  let updatedAgents: { id: string; name: string | null }[] = [];
  if (status === "approved") {
    updatedAgents = await repo.approveAgentsByModel(modelId, tenantId);
  } else if (status === "flagged") {
    updatedAgents = await repo.shadowAgentsByModel(modelId, tenantId);
  }
  const agentsUpdated = updatedAgents.length;

  const modelName = updatedModel?.name ?? modelId;
  const userEmail = actor?.userEmail ?? null;

  // Audit: model status change
  const eventType =
    status === "approved"
      ? "model.approved"
      : status === "flagged"
        ? "model.flagged"
        : status === "deprecated"
          ? "model.deprecated"
          : "model.status_changed";

  audit.log({
    tenantId,
    userId,
    userEmail,
    eventType,
    entityType: "model",
    entityId: modelId,
    entityName: modelName,
    action: status === "approved" ? "approve" : status === "flagged" ? "flag" : "update",
    status: "success",
    summary:
      status === "approved"
        ? `${userEmail ?? "system"} approved model '${modelName}'. ${agentsUpdated} agent(s) promoted to approved.`
        : status === "flagged"
        ? `${userEmail ?? "system"} flagged model '${modelName}'. ${agentsUpdated} agent(s) demoted to shadow.`
        : `${userEmail ?? "system"} set model '${modelName}' to '${status}' (was: ${previousStatus})`,
    before: { validation_status: previousStatus },
    after: { validation_status: status },
    metadata: agentsUpdated > 0 ? { agents_cascaded: agentsUpdated } : null,
  });

  for (const agent of updatedAgents) {
    const agentName = agent.name ?? agent.id;
    const cascadeStatus = status === "approved" ? "approved" : "shadow";
    const cascadeAction = status === "approved" ? "approve" : "shadow";
    
    audit.log({
      tenantId,
      userId,
      userEmail,
      eventType: "agent.status_changed",
      entityType: "agent",
      entityId: agent.id,
      entityName: agentName,
      action: cascadeAction,
      status: "success",
      summary: `system auto-${cascadeStatus} agent '${agentName}' due to model '${modelName}' cascade`,
      before: { governance_status: "unknown" }, // We don't have the exact previous status easily here
      after: { governance_status: cascadeStatus },
      metadata: { triggered_by_model_id: modelId, cascade: true },
    });
  }

  return {
    modelId,
    previousStatus,
    newStatus: status,
    agentsUpdated,
  };
}

export async function approveAgent(
  agentId: string,
  tenantId: string | null,
  userId: string | null,
  status: AgentGovernanceStatus,
  actor?: { userEmail?: string | null; remark?: string },
): Promise<{ agentId: string; previousStatus: AgentGovernanceStatus; newStatus: AgentGovernanceStatus }> {
  const previousStatus = await repo.findAgentGovernanceStatus(agentId, tenantId);
  if (!previousStatus) {
    throw new NotFoundError("Agent not found");
  }

  // 1. Update the agent status
  const updatedAgent = await repo.updateAgentGovernanceStatus(agentId, tenantId, status);

  const agentName = updatedAgent?.agent_config?.name ?? agentId;
  const userEmail = actor?.userEmail ?? null;
  const remarkStr = actor?.remark ? ` Remark: ${actor.remark}` : "";

  // Audit: agent status change
  const eventType =
    status === "approved" || status === "conditionally_approved"
      ? "agent.approved"
      : status === "flagged" || status === "conditionally_shadow"
        ? "agent.flagged"
        : "agent.status_changed";

  audit.log({
    tenantId,
    userId,
    userEmail,
    eventType,
    entityType: "agent",
    entityId: agentId,
    entityName: agentName,
    action: status.includes("approved") ? "approve" : status.includes("flagged") || status.includes("shadow") ? "flag" : "update",
    status: "success",
    summary: `${userEmail ?? "system"} set agent '${agentName}' to '${status}' (was: ${previousStatus}).${remarkStr}`,
    before: { governance_status: previousStatus },
    after: { governance_status: status },
  });

  return {
    agentId,
    previousStatus,
    newStatus: status,
  };
}
