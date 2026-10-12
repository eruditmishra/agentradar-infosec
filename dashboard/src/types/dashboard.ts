export interface DashboardData {
  stats: {
    totalAgents: number;
    approvedAgents: number;
    shadowAgents: number;
    avgConfidence: number;
  };
  charts: {
    models: { name: string; value: number }[];
    risk: { name: string; value: number }[];
    provider: { name: string; value: number }[];
  };
  recentScans: {
    id: string;
    status: string;
    time: string;
    error: string | null;
    type: string;
    agentsFound: number;
    providersScanned: string[];
  }[];
  alerts: {
    sev: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    detail: string;
  }[];
}

export interface ShadowAgentStats {
  totalShadowAgents: number;
  atRiskAgents: number;
  rogueAgents: number;
  ownerless: number;
}

export interface ModelStats {
  totalModels: number;
  approvedModels: number;
  rejectedModels: number;
  pendingModels: number;
}

export interface VerifiedAgentStats {
  totalVerified: number;
  autoVerified: number;
  conditionallyVerified: number;
  underReview: number;
}
