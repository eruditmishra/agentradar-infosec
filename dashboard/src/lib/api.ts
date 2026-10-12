import axios from "axios";
import { getAuthEpoch } from "./authEpoch";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000,
});



api.interceptors.request.use(async (config) => {
  (config as any)._authEpoch = getAuthEpoch();
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Endpoints where a 401 means "you supplied the wrong credential/code for this
// specific request" — not "your session has expired". These must never trigger
// the silent refresh-and-retry-then-logout flow below, or a simple wrong MFA
// code ends up wiping the session and bouncing the user back to the login
// screen instead of just showing an inline error.
const AUTH_401_EXEMPT_PATHS = ['/auth/refresh', '/auth/logout', '/auth/mfa/confirm', '/auth/mfa/challenge'];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !AUTH_401_EXEMPT_PATHS.includes(err.config.url)) {
      const originalRequest = err.config;
      if (!originalRequest._retryAuth) {
        originalRequest._retryAuth = true;

        if (isRefreshing) {
          return new Promise(function (resolve, reject) {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        isRefreshing = true;

        try {
          await axios.post('/api/auth/refresh', {}, { withCredentials: true });
          isRefreshing = false;
          processQueue(null);
          // If refresh succeeds, the new access_token cookie is automatically set
          // We just need to retry the original request
          return api(originalRequest);
        } catch (refreshErr) {
          isRefreshing = false;
          processQueue(refreshErr);
          if (originalRequest._authEpoch === getAuthEpoch()) {
            window.dispatchEvent(new CustomEvent("auth:logout"));
          }
          return Promise.reject(refreshErr);
        }
      } else {
        if (originalRequest._authEpoch === getAuthEpoch()) {
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }
      }
    }

    return Promise.reject(err);
  },
);

export default api;

export const authAPI = {
  login: (email?: string, password?: string) =>
    api.post("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),

  getPublicSSOConfig: () => api.get('/auth/sso-config'),
  getSSOSettings: () => api.get('/auth/sso/settings'),
  updateSSOSettings: (data: { providerId: string; providerType: string; ssoConfig: any; isActive: boolean }) => 
    api.post('/auth/sso/settings', data),

  ssoAzure: () => {
    window.location.href = "/api/auth/sso/azure";
  },
  ssoOkta: () => {
    window.location.href = "/api/auth/sso/okta";
  },

  setupMfa: () => api.post<{ otpauthUrl: string; qrCodeDataUrl: string }>("/auth/mfa/setup"),
  confirmMfa: (token: string) => api.post<{ backupCodes: string[] }>("/auth/mfa/confirm", { token }),
  verifyMfaChallenge: (token: string) => api.post("/auth/mfa/challenge", { token }),
};

export const dashboardAPI = {
  getStats: () => api.get("/dashboard/stats"),
  getShadowStats: () => api.get("/dashboard/shadow-stats"),
  getModelStats: () => api.get("/dashboard/model-stats"),
  getVerifiedStats: () => api.get("/dashboard/verified-stats"),
};

export const discoveryAPI = {
  startScan: (integration_ids?: string[], scan_all?: boolean) => api.post<{ scanId: string }>("/discovery/scans", { integration_ids, scan_all }),
  getScan: (id: string) => api.get<{ scan: any }>(`/discovery/scans/${id}`),
  getAgents: (params: Record<string, any> = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    );
    return api.get('/discovery/agents', { params: cleanParams });
  },
  getAgentFilters: () => api.get('/discovery/agents/filters'),
  getAgentDetails: (id: string) => api.get(`/discovery/agents/${id}`),
  getAgent: (id: string) => api.get(`/discovery/agents/${id}`),
  getSecurityAssessment: (id: string, framework?: string) => api.get(`/discovery/agents/${id}/security-assessment`, { params: framework ? { framework } : {} }),
  refreshSecurityAssessment: (id: string) => api.post(`/discovery/agents/${id}/security-assessment/refresh`),
  getSecurityDrift: (id: string, params: Record<string, any> = {}) => api.get(`/discovery/agents/${id}/security-assessment/drift`, { params }),
  getFrameworks: () => api.get<{ frameworks: import("../types/discovery").FrameworkMeta[] }>("/discovery/frameworks"),
  getAssessments: (params: { framework: string }) =>
    api.get<{ framework: import("../types/discovery").FrameworkMeta; agents: import("../types/discovery").AgentControlReviewRow[]; total: number }>(
      "/discovery/assessments",
      { params },
    ),
  requestAgentApproval: (id: string, requested_status: string, request_remark: string) => api.post(`/discovery/agents/${id}/request-approval`, { requested_status, request_remark }),
  approveAgent: (id: string, action: string, approval_remark?: string, status?: string) => api.post(`/discovery/agents/${id}/approve`, { action, approval_remark, status }),

  getModels: (params: Record<string, any> = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    );
    return api.get('/discovery/models', { params: cleanParams });
  },
  getModelFilters: () => api.get('/discovery/models/filters'),
  updateModel: (id: string, data: any) => api.patch(`/discovery/models/${id}`, data),
  getSettings: () => api.get<{ is_enabled: boolean; auto_scan_frequency: string }>("/discovery/settings"),
  updateSettings: (is_enabled: boolean, auto_scan_frequency: string) => api.put("/discovery/settings", { is_enabled, auto_scan_frequency }),
  getAutoFindings: () => api.get<{ findings: any[] }>("/discovery/auto-findings"),
  requestModelApproval: (id: string, requested_status: string) => api.post(`/discovery/models/${id}/request-approval`, { requested_status }),
  approveModel: (id: string, action: string) => api.post(`/discovery/models/${id}/approve`, { action }),
};

export const integrationsAPI = {
  listIntegrations: (params: Record<string, any> = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    );
    return api.get('/integrations', { params: cleanParams });
  },
  createIntegration: (data: any) => api.post('/integrations', data),
  updateIntegration: (id: string, data: any) => api.patch(`/integrations/${id}`, data),
  testIntegration: (id: string) => api.post(`/integrations/${id}/test`),
  deleteIntegration: (id: string) => api.delete(`/integrations/${id}`),
};

export const auditAPI = {
  sendTelemetryEvent: (payload: { type: 'pageview' | 'click'; path: string; metadata?: any; timestamp?: string }) => {
    // Use the axios instance so it includes credentials and handles refresh interceptors
    api.post('/audit/event', payload).catch(() => {});
  },
  getUnifiedLogs: (params?: { limit?: number; offset?: number }) =>
    api.get<{ logs: any[]; total: number }>('/audit/all', { params }),
  getAuditLogs: (params?: { limit?: number; offset?: number }) =>
    api.get<{ logs: any[]; total: number }>('/audit/logs', { params }),
  getEntityLogs: (entityType: string, entityId: string) =>
    api.get<{ logs: any[]; total: number }>(`/audit/logs/${entityType}/${entityId}`),
  logBusinessEvent: (payload: { eventType: string; entityType?: string; entityId?: string; summary: string; details?: any }) =>
    api.post('/audit/business-event', payload),
};

export const trustAPI = {
  updateModelStatus: (id: string, status: string) => api.post(`/trust/models/${id}/approve`, { status }),
};
