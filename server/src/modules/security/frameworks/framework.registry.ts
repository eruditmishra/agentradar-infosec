// @ts-nocheck
/**
 * framework.registry.ts
 *
 * Central registry of compliance frameworks the platform testifies agents
 * against. Adding a new framework means adding one entry here plus a new
 * `*.rules.ts` file — nothing else in the pipeline needs to change.
 */

import type { ControlAssessment, FrameworkMeta, SecurityDomains } from "../evidence.types";
import { runOwaspAiAgents2026 } from "./owasp-ai-agents-2026.rules";
import { runNistAiRmf, NIST_AI_RMF_CONTROL_COUNT } from "./nist-ai-rmf.rules";
import { runIso42001, ISO_42001_CONTROL_COUNT } from "./iso-42001.rules";

export interface FrameworkDefinition {
  meta: FrameworkMeta;
  run: (domains: SecurityDomains) => Record<string, ControlAssessment>;
}

export const FRAMEWORKS: FrameworkDefinition[] = [
  {
    meta: {
      id: "owasp_ai_agents_2026",
      name: "OWASP AI Agents Top 10",
      version: "2026",
      controlCount: 10,
      category: "Security",
      description: "OWASP's agentic AI threat taxonomy — authorization hijacking, goal manipulation, excessive agency, memory poisoning, and related agent-specific threats.",
    },
    run: runOwaspAiAgents2026,
  },
  {
    meta: {
      id: "nist_ai_rmf",
      name: "NIST AI RMF",
      version: "1.0",
      controlCount: NIST_AI_RMF_CONTROL_COUNT,
      category: "Regulation",
      description: "NIST AI Risk Management Framework — Govern, Map, Measure, Manage functions, assessed at category granularity.",
    },
    run: runNistAiRmf,
  },
  {
    meta: {
      id: "iso_42001",
      name: "ISO/IEC 42001",
      version: "2023",
      controlCount: ISO_42001_CONTROL_COUNT,
      category: "Standard",
      description: "AI Management System standard — full Annex A control set across policies, resources, impact assessment, life cycle, data, and third-party use.",
    },
    run: runIso42001,
  },
];

export function getFrameworkMeta(): FrameworkMeta[] {
  return FRAMEWORKS.map((f) => f.meta);
}

export function getFramework(id: string): FrameworkDefinition | undefined {
  return FRAMEWORKS.find((f) => f.meta.id === id);
}

/** Run every registered framework's rules against normalized domains. */
export function runAllFrameworks(domains: SecurityDomains): Record<string, { meta: FrameworkMeta; controls: Record<string, ControlAssessment> }> {
  const out: Record<string, { meta: FrameworkMeta; controls: Record<string, ControlAssessment> }> = {};
  for (const f of FRAMEWORKS) {
    out[f.meta.id] = { meta: f.meta, controls: f.run(domains) };
  }
  return out;
}
