// @ts-nocheck
/**
 * security.controller.ts
 *
 * HTTP handlers for the OWASP security assessment API.
 */

import { asyncHandler } from "../../shared/asyncHandler";
import { getOrComputeAssessment, assessAndStore, bulkReassessTenant } from "./security.service";
import { getDriftHistory, listAgentControlReviews } from "./security.repo";
import { getFrameworkMeta, getFramework } from "./frameworks/framework.registry";

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function getTenant(req: any): string | null {
  return req.user?.tenantId ?? req.tenantId ?? null;
}

/**
 * GET /api/discovery/agents/:agentId/security-assessment
 *
 * Returns the stored OWASP security assessment for an agent,
 * or computes it on-the-fly if not yet stored.
 */
export const getSecurityAssessmentHandler = asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  if (!isUUID(agentId)) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const assessment = await getOrComputeAssessment(agentId, getTenant(req));
  if (!assessment) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const framework = typeof req.query.framework === "string" ? req.query.framework : null;
  if (framework && framework !== "all" && assessment.frameworks?.[framework]) {
    res.json({ assessment: { ...assessment, frameworks: { [framework]: assessment.frameworks[framework] } } });
    return;
  }

  res.json({ assessment });
});

/**
 * GET /api/discovery/frameworks
 *
 * List the compliance frameworks agents are testified against
 * (OWASP AI Agents 2026, NIST AI RMF, ISO/IEC 42001), with control counts.
 */
export const getFrameworksHandler = asyncHandler(async (_req, res) => {
  res.json({ frameworks: getFrameworkMeta() });
});

/**
 * GET /api/discovery/assessments?framework=<id>
 *
 * Tenant-wide "Agent control reviews" list for the Assessments page:
 * per agent, posture/score/pass/partial/fail against the selected framework.
 */
export const listAssessmentsHandler = asyncHandler(async (req, res) => {
  const frameworkId = typeof req.query.framework === "string" ? req.query.framework : null;
  const framework = frameworkId ? getFramework(frameworkId) : undefined;
  if (!frameworkId || !framework) {
    res.status(400).json({ error: "A valid ?framework= query parameter is required" });
    return;
  }

  const rows = await listAgentControlReviews(getTenant(req), frameworkId);
  res.json({ framework: framework.meta, agents: rows, total: rows.length });
});

/**
 * POST /api/discovery/agents/:agentId/security-assessment/refresh
 *
 * Trigger a fresh security assessment for an agent (stores result).
 */
export const refreshSecurityAssessmentHandler = asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  if (!isUUID(agentId)) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await assessAndStore(agentId, getTenant(req), null);
  const assessment = await getOrComputeAssessment(agentId, getTenant(req));

  res.json({ assessment, refreshed: true });
});

/**
 * GET /api/discovery/agents/:agentId/security-assessment/drift
 *
 * Returns the security drift history for an agent.
 */
export const getSecurityDriftHandler = asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  if (!isUUID(agentId)) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const history = await getDriftHistory(agentId, getTenant(req), limit);

  res.json({ drift: history, total: history.length });
});
