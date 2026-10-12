export function emptyAgentBlock(overrides: Record<string, any> = {}) {
  return {
    detected: false,
    detectionMethod: null,
    agentId: null,
    agentName: null,
    agentType: null,
    agentStatus: null,
    runtimeStatus: null,
    deploymentStatus: null,
    lastSeenAt: null,
    source: null,
    ...overrides,
  };
}

export function emptyRuntimeBlock(overrides: Record<string, any> = {}) {
  return {
    detected: false,
    status: null,
    runtimeType: null,
    runtimeId: null,
    runtimeName: null,
    resourceId: null,
    region: null,
    ...overrides,
  };
}

export function normalizeRuntimeStatus(raw: string | null | undefined): string {
  const v = String(raw || "").toLowerCase();
  if (!v || v === "null" || v === "undefined") return "unknown";
  if (/^(running|ready|succeeded|active|online|healthy|started)$/.test(v))
    return "running";
  if (/^(stopped|deallocated|disabled|inactive|suspended|offline)$/.test(v))
    return "stopped";
  if (/^(failed|error|unhealthy|crashloop|terminated)$/.test(v))
    return "failed";
  if (/starting|stopping|updating|creating|deleting|pending|provisioning/.test(v))
    return "unknown";
  return "unknown";
}

export function buildAgentAndRuntime({
  agentDetected = false,
  detectionMethod = null,
  agentId = null,
  agentName = null,
  agentType = null,
  agentStatus = null,
  agentRuntimeStatus = null,
  deploymentStatus = null,
  lastSeenAt = null,
  source = null,
  runtimeDetected = false,
  runtimeStatus = null,
  runtimeType = null,
  runtimeId = null,
  runtimeName = null,
  resourceId = null,
  region = null,
}: any = {}): Record<string, any> {
  return {
    agent: emptyAgentBlock({
      detected: agentDetected,
      detectionMethod,
      agentId,
      agentName,
      agentType,
      agentStatus,
      runtimeStatus: agentRuntimeStatus,
      deploymentStatus,
      lastSeenAt,
      source,
    }),
    runtime: emptyRuntimeBlock({
      detected: runtimeDetected,
      status: runtimeStatus,
      runtimeType,
      runtimeId,
      runtimeName,
      resourceId,
      region,
    }),
  };
}

export function sanitizeCloudError(msg: string | Error): string {
  const errStr = typeof msg === "string" ? msg : msg?.message || String(msg);
  return errStr.substring(0, 500);
}

export function emptyDiscoveryStats(): Record<string, any> {
  return {
    scanned: 0,
    found: 0,
    errors: 0,
    deepScanned: 0,
    discoveryErrors: [],
    nonAiResourcesSkipped: 0,
  };
}

export function tallyDiscoveryObservation(stats: any, obs: any) {
  stats.scanned++;
  if (obs) {
    stats.found++;
  }
}

export function dedupeObservationsByFingerprint(observations: any[]) {
  const map = new Map();
  for (const obs of observations) {
    if (!obs || !obs.fingerprint) continue;
    map.set(obs.fingerprint, obs);
  }
  return Array.from(map.values());
}

export function safeEnvNames(envVars: Record<string, any> | string[]) {
  if (Array.isArray(envVars)) {
    return envVars.filter(
      (k) => !/secret|token|key|password|cred/i.test(String(k))
    );
  }
  if (typeof envVars === "object" && envVars !== null) {
    return Object.keys(envVars).filter(
      (k) => !/secret|token|key|password|cred/i.test(k)
    );
  }
  return [];
}
