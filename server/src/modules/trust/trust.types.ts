import type { ModelValidationStatus, AgentGovernanceStatus } from "../discovery/discovery.types";

export interface ApproveModelInput {
  status?: ModelValidationStatus; // usually 'approved'
}

export interface ApproveModelResult {
  modelId: string;
  previousStatus: ModelValidationStatus;
  newStatus: ModelValidationStatus;
  agentsUpdated: number;
}
