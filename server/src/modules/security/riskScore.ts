export interface RiskFactor {
  name: string;
  points: number;
  applied: boolean;
  note?: string;
}

export interface RiskScoreBreakdown {
  rawScore: number;
  finalScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  components: {
    intrinsicAttackSurface: {
      score: number;
      max: 45;
      factors: RiskFactor[];
    };
    governanceDeficits: {
      score: number;
      max: 30;
      factors: RiskFactor[];
    };
    owaspVulnerabilities: {
      score: number;
      max: 40;
      factors: RiskFactor[];
    };
    unknownMultiplier: {
      applied: boolean;
      multiplier: number;
      reason: string | null;
    };
  };
}

export function calculateAgentRiskScore(
  agent: any,
  assessment: any,
): RiskScoreBreakdown {
  const domains = assessment?.domains || {};
  const owaspControls = assessment?.frameworks?.owasp_ai_agents_2026?.controls || {};
  const completeness = assessment?.evidence_completeness?.overall ?? 0;

  let rawScore = 0;

  // ─── Component A: Intrinsic Attack Surface (max 45) ───────────────────────
  // Measures the inherent exposure/blast radius of the agent regardless of
  // governance posture. Max raised to 45 to accommodate the two new factors.
  let componentA = 0;
  const factorsA: RiskFactor[] = [];

  // A1 — PII/PHI data access (+15)
  if (domains?.data_access?.has_pii === true || domains?.data_access?.has_phi === true) {
    componentA += 15;
    factorsA.push({
      name: "Access to sensitive data (PII/PHI)",
      points: 15,
      applied: true,
    });
  } else {
    factorsA.push({
      name: "Access to sensitive data (PII/PHI)",
      points: 15,
      applied: false,
    });
  }

  // A2 — Internet / egress access (+10)
  // Check both the top-level DB column and the normalised network domain.
  const internetAccessObserved =
    agent?.internet_access === true ||
    domains?.network?.internet_access?.value === true ||
    domains?.network?.unrestricted_egress === true;
  if (internetAccessObserved) {
    componentA += 10;
    factorsA.push({
      name: "Internet / unrestricted egress access",
      points: 10,
      applied: true,
    });
  } else {
    factorsA.push({
      name: "Internet / unrestricted egress access",
      points: 10,
      applied: false,
    });
  }

  // A3 — State-modifying or code-executing tools present (+10)
  const tools = domains?.tools?.items || [];
  const hasRiskyTools = tools.some(
    (t: any) => t.risk_flags?.can_modify_state || t.risk_flags?.can_execute_code,
  );
  if (hasRiskyTools) {
    componentA += 10;
    factorsA.push({
      name: "State-modifying or code-executing tools present",
      points: 10,
      applied: true,
    });
  } else {
    factorsA.push({
      name: "State-modifying or code-executing tools present",
      points: 10,
      applied: false,
    });
  }

  // A4 — Full autonomy (can act without human in the loop) (+5)
  // Uses human_oversight domain — a field that tools.requires_human_approval
  // never had access to (was the old broken path).
  if (domains?.human_oversight?.can_execute_without_user === true) {
    componentA += 5;
    factorsA.push({
      name: "Fully autonomous execution (no human-in-the-loop)",
      points: 5,
      applied: true,
    });
  } else {
    factorsA.push({
      name: "Fully autonomous execution (no human-in-the-loop)",
      points: 5,
      applied: false,
    });
  }

  // A5 — Data write/delete capability (+5)
  const canWriteOrDelete =
    domains?.human_oversight?.can_modify_data === true ||
    domains?.human_oversight?.can_delete_data === true ||
    domains?.memory?.write_capability?.value === true;
  if (canWriteOrDelete) {
    componentA += 5;
    factorsA.push({
      name: "Can modify or delete data",
      points: 5,
      applied: true,
    });
  } else {
    factorsA.push({
      name: "Can modify or delete data",
      points: 5,
      applied: false,
    });
  }

  // A6 — Multi-agent orchestration / delegation risk (+up to 5)
  const connectedAgentCount = domains?.inter_agent?.connected_agents?.length ?? 0;
  const mcpServerCount = domains?.inter_agent?.mcp_servers?.length ?? 0;
  const orchestrationRisk = connectedAgentCount > 0 || mcpServerCount > 0;
  if (orchestrationRisk) {
    const pts = Math.min(5, (connectedAgentCount + mcpServerCount) * 2);
    componentA += pts;
    factorsA.push({
      name: "Multi-agent orchestration or MCP server connections",
      points: pts,
      applied: true,
      note: `${connectedAgentCount} connected agent(s), ${mcpServerCount} MCP server(s)`,
    });
  } else {
    factorsA.push({
      name: "Multi-agent orchestration or MCP server connections",
      points: 5,
      applied: false,
    });
  }

  const finalComponentA = Math.min(45, componentA);
  rawScore += finalComponentA;

  // ─── Component B: Governance Deficits (max 30) ────────────────────────────
  // Measures missing controls and oversight gaps. Max raised to 30 to
  // accommodate the improved guardrail scoring.
  let componentB = 0;
  const factorsB: RiskFactor[] = [];

  // B1 — Shadow AI (unapproved / unmanaged) (+15)
  if (agent?.status === "shadow") {
    componentB += 15;
    factorsB.push({
      name: "Shadow AI (Unapproved / unmanaged)",
      points: 15,
      applied: true,
    });
  } else {
    factorsB.push({
      name: "Shadow AI (Unapproved / unmanaged)",
      points: 15,
      applied: false,
    });
  }

  // B2 — Missing guardrails
  // Previously only fired on strict `=== false`, meaning `null` (unknown) was
  // silently ignored and the factor never contributed any points. Now:
  //   • Confirmed absent  → +5 pts (high confidence risk)
  //   • Unknown/unscanned → +2 pts (partial/unknown risk — cannot rule it out)
  const guardrailsPresent = domains?.guardrails?.present;
  const guardrailsCollected = domains?.guardrails?.collection_status;
  if (guardrailsPresent === false) {
    componentB += 5;
    factorsB.push({
      name: "Missing foundational guardrails (confirmed absent)",
      points: 5,
      applied: true,
    });
  } else if (
    guardrailsPresent === null &&
    guardrailsCollected !== "not_collected" &&
    guardrailsCollected !== undefined
  ) {
    // Guardrail status was attempted but remains unknown — treat as partial risk
    componentB += 2;
    factorsB.push({
      name: "Guardrail status unknown (cannot confirm presence)",
      points: 2,
      applied: true,
      note: "Partial risk — scanner could not confirm guardrails are in place",
    });
  } else {
    factorsB.push({
      name: "Missing foundational guardrails",
      points: 5,
      applied: false,
    });
  }

  // B3 — State-modifying tools lack human approval
  // FIX: `requires_human_approval` does not exist on ToolItem. The correct
  // signal is `domains.human_oversight.human_approval_required.value`.
  const humanApprovalRequired = domains?.human_oversight?.human_approval_required?.value;
  if (hasRiskyTools && humanApprovalRequired === false) {
    componentB += 5;
    factorsB.push({
      name: "State-modifying tools operate without human approval",
      points: 5,
      applied: true,
    });
  } else if (hasRiskyTools && humanApprovalRequired === null) {
    // Has risky tools but we don't know if human approval is required
    componentB += 2;
    factorsB.push({
      name: "State-modifying tools — human approval status unknown",
      points: 2,
      applied: true,
      note: "Cannot confirm whether tool actions require human approval",
    });
  } else {
    factorsB.push({
      name: "State-modifying tools operate without human approval",
      points: 5,
      applied: false,
    });
  }

  // B4 — No owner / unaccountable agent (+3)
  const hasOwner =
    agent?.owner ||
    domains?.identity?.owner?.value ||
    domains?.identity?.owner?.status === "observed";
  if (!hasOwner) {
    componentB += 3;
    factorsB.push({
      name: "No identifiable owner or accountable team",
      points: 3,
      applied: true,
    });
  } else {
    factorsB.push({
      name: "No identifiable owner or accountable team",
      points: 3,
      applied: false,
    });
  }

  // B5 — Audit logging disabled or unknown (+2)
  // Only fire when the field has been observed as false (not just unknown)
  if (domains?.guardrails?.logging_enabled === false) {
    componentB += 2;
    factorsB.push({
      name: "Audit logging disabled",
      points: 2,
      applied: true,
    });
  } else {
    factorsB.push({
      name: "Audit logging disabled",
      points: 2,
      applied: false,
    });
  }

  const finalComponentB = Math.min(30, componentB);
  rawScore += finalComponentB;

  // ─── Component C: OWASP Vulnerability Signals (max 40) ───────────────────
  // Previously only counted "detected" (+15) and "control_gap" (+5) statuses,
  // but the vast majority of controls land on "unknown" (insufficient evidence)
  // which contributed 0 points, making Component C effectively dead.
  // Now "unknown" controls that represent a real threat category add +2 pts
  // to reflect the unverified-but-plausible risk.
  let componentC = 0;
  const factorsC: RiskFactor[] = [];
  const allOwasp = Object.values(owaspControls) as any[];

  for (const cat of allOwasp) {
    const label = cat.name || cat.control_id || cat.id || "Unknown control";
    if (cat.status === "detected") {
      componentC += 15;
      factorsC.push({
        name: `Vulnerability detected: ${label}`,
        points: 15,
        applied: true,
      });
    } else if (cat.status === "control_gap") {
      componentC += 5;
      factorsC.push({
        name: `Control gap: ${label}`,
        points: 5,
        applied: true,
      });
    } else if (cat.status === "unknown") {
      // "unknown" means the scanner couldn't collect enough evidence to confirm
      // or deny the vulnerability — the threat still plausibly exists.
      componentC += 2;
      factorsC.push({
        name: `Unverified threat (insufficient evidence): ${label}`,
        points: 2,
        applied: true,
        note: "Status unknown — risk cannot be ruled out",
      });
    }
  }

  const finalComponentC = Math.min(40, componentC);
  rawScore += finalComponentC;

  // ─── Component D: Evidence Completeness Multiplier ────────────────────────
  // When evidence is critically incomplete, the computed score under-represents
  // actual risk. Apply a 1.2× penalty. The threshold remains at 40%.
  let multiplierApplied = false;
  let multiplierReason: string | null = null;
  if (completeness < 0.4) {
    rawScore = Math.min(100, rawScore * 1.2);
    multiplierApplied = true;
    multiplierReason = `Evidence completeness is critically low (${Math.round(completeness * 100)}%)`;
  }

  const finalScore = Math.round(rawScore);
  let riskLevel: "Critical" | "High" | "Medium" | "Low" = "Low";
  if (finalScore > 75) riskLevel = "Critical";
  else if (finalScore > 50) riskLevel = "High";
  else if (finalScore > 25) riskLevel = "Medium";

  return {
    rawScore: Math.round(rawScore),
    finalScore,
    riskLevel,
    components: {
      intrinsicAttackSurface: {
        score: finalComponentA,
        max: 45,
        factors: factorsA,
      },
      governanceDeficits: {
        score: finalComponentB,
        max: 30,
        factors: factorsB,
      },
      owaspVulnerabilities: {
        score: finalComponentC,
        max: 40,
        factors: factorsC,
      },
      unknownMultiplier: {
        applied: multiplierApplied,
        multiplier: 1.2,
        reason: multiplierReason,
      },
    },
  };
}
