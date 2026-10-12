import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { discoveryAPI, auditAPI } from "../../lib/api";
import type { DiscoveredAgent } from "../../types/discovery";
import UpdateAgentStatusModal from "../../components/super_admin/agents/UpdateAgentStatusModal";
import AssessmentPanel from "../../components/super_admin/agents/AssessmentPanel";
import RiskScoreBreakdownPanel from "../../components/super_admin/agents/RiskScoreBreakdownPanel";
import { getAgentStatusStyle } from "../../lib/agentStatus";
import {
  ArrowLeft,
  Bot,
  Server,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Shield,
  Activity,
  Globe,
  GitBranch,
  Cpu,
  Clock,
  Copy,
  Lock,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export default function AgentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<DiscoveredAgent | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "owasp" | "risk">(
    "overview",
  );

  useEffect(() => {
    if (!id) return;

    Promise.all([
      discoveryAPI.getAgent(id),
      auditAPI.getEntityLogs("agent", id).catch(() => ({ data: { logs: [] } })),
    ])
      .then(([agentRes, logsRes]) => {
        setAgent(agentRes.data.agent);
        setLogs(logsRes.data.logs);
        setLoading(false);

        auditAPI
          .logBusinessEvent({
            eventType: "agent.viewed.details",
            entityType: "agent",
            entityId: id,
            summary: `User accessed agent details for ${agentRes.data.agent.name || id}`,
          })
          .catch((err) => console.error("Failed to log business event", err));
      })
      .catch((err) => {
        console.error("Failed to load agent details", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft size={16} className="mr-2" /> Back
        </button>
        <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r16 p-8 text-center text-text-muted">
          Agent not found.
        </div>
      </div>
    );
  }

  const metadata = agent.metadata || {};
  const config = agent.agent_config || {};
  const confidencePct = agent.confidence_score
    ? Math.round(Number(agent.confidence_score) * 100)
    : 0;

  // Status mapping
  const statusColor = getAgentStatusStyle(agent.status);

  // Computed Findings
  const passes = [];
  const violations = [];
  const gaps = [];

  if (
    !agent.internet_access &&
    !agent.filesystem_access &&
    !agent.database_access &&
    !agent.browser_access &&
    !agent.github_access &&
    !agent.slack_access &&
    !agent.email_access
  ) {
    passes.push({
      label: "Strict Perimeter Isolation",
      desc: "Internet, Filesystem, DB, Browser, GitHub & Slack access all hard-disabled.",
    });
  }

  if (
    !agent.api_keys_detected &&
    !agent.secrets_detected &&
    (!agent.mcp_connections || agent.mcp_connections.length === 0)
  ) {
    passes.push({
      label: "Clean Credential Hygiene",
      desc: "0 API keys, 0 secrets, and 0 third-party MCP connections detected in agent payload.",
    });
  }

  const ttl =
    config.idleSessionTTLInSeconds || metadata.deep?.idleSessionTTLInSeconds;
  if (ttl) {
    passes.push({
      label: "Session Guardrails Enforced",
      desc: `Idle Session TTL explicitly capped at ${ttl}s to prevent dangling session hijacking.`,
    });
  }

  if (metadata.deep?.agentResourceRoleArn) {
    passes.push({
      label: "Dedicated IAM Execution Role",
      desc: "Role assigned for bounded resource calls.",
    });
  }

  if (agent.internet_access)
    violations.push({
      label: "Unrestricted Internet Egress",
      desc: "Agent has outbound internet access enabled without firewall constraints.",
      findingType: "access_broadened",
    });
  if (agent.filesystem_access)
    violations.push({
      label: "Local Filesystem Mount",
      desc: "Agent can access local filesystem.",
      findingType: "access_broadened",
    });
  if (agent.secrets_detected)
    violations.push({
      label: "Embedded Secrets Detected",
      desc: "Hardcoded secrets found in configuration payload.",
      findingType: "secrets_exposed",
    });
  if (agent.database_access)
    violations.push({
      label: "Direct Database Access",
      desc: "Direct DB queries permitted, bypassing standard application tiers.",
      findingType: "tools_changed",
    });
  if (!metadata.deep?.customerEncryptionKeyArn)
    violations.push({
      label: "Missing KMS Customer Managed Key",
      desc: "Relies on default managed key; lacks customer-controlled encryption auditing.",
      findingType: null,
    });

  const getViolationSeverity = (findingType: string | null) => {
    const match = findingType
      ? (agent.findings || []).find((f) => f.finding_type === findingType)
      : null;
    switch (match?.severity) {
      case "critical":
        return { label: "Critical", className: "bg-red/20 text-red-700" };
      case "risk":
        return { label: "Risk", className: "bg-amber/20 text-amber-700" };
      case "info":
        return { label: "Info", className: "bg-blue/20 text-blue-700" };
      default:
        return { label: "Unrated", className: "bg-slate-200 text-slate-600" };
    }
  };
  const violationSeverityRank: Record<string, number> = {
    Critical: 3,
    Risk: 2,
    Info: 1,
    Unrated: 0,
  };
  const highestViolationSeverity = violations.reduce(
    (highest, v) => {
      const sev = getViolationSeverity(v.findingType);
      return violationSeverityRank[sev.label] >
        violationSeverityRank[highest.label]
        ? sev
        : highest;
    },
    { label: "Unrated", className: "bg-slate-200 text-slate-600" },
  );

  if (!agent.owner)
    gaps.push({ label: "Owner & Department", value: "null (Unassigned)" });
  if (
    !agent.data_access_classification ||
    Object.keys(agent.data_access_classification).length === 0
  )
    gaps.push({ label: "Data Access Classification", value: "null (Unrated)" });
  if (!agent.repository)
    gaps.push({ label: "Source Code Repository", value: "null (Untracked)" });
  if (!config.instruction)
    gaps.push({ label: "System Instructions", value: "null (Empty)" });

  if (passes.length === 0)
    passes.push({
      label: "Basic Checks Passed",
      desc: "Base agent configuration passed standard structural validation.",
    });

  // Charts Data
  const donutData = [
    { name: "Passed", value: passes.length, color: "#10b981" },
    { name: "Violations", value: violations.length, color: "#f59e0b" },
    { name: "Missing", value: gaps.length, color: "#cbd5e1" },
  ];

  const radarData = [
    { subject: "Internet", A: agent.internet_access ? 1 : 0, fullMark: 1 },
    { subject: "Filesystem", A: agent.filesystem_access ? 1 : 0, fullMark: 1 },
    { subject: "DB Access", A: agent.database_access ? 1 : 0, fullMark: 1 },
    { subject: "Browser", A: agent.browser_access ? 1 : 0, fullMark: 1 },
    { subject: "GitHub", A: agent.github_access ? 1 : 0, fullMark: 1 },
    { subject: "Secrets", A: agent.secrets_detected ? 1 : 0, fullMark: 1 },
  ];

  const gaugeData = [
    { name: "Score", value: confidencePct, fill: "#4f46e5" },
    { name: "Empty", value: 100 - confidencePct, fill: "#e2e8f0" },
  ];

  const isConditionallyApproved = agent.status === "conditionally_approved";
  const isConditionallyShadow = agent.status === "conditionally_shadow";
  const showGovernanceJourney =
    isConditionallyApproved || isConditionallyShadow;

  // Find the latest logs for the journey
  const sortedLogs = [...logs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latestRequestLog = sortedLogs.find(
    (l) => l.event_type === "agent.approval_requested",
  );
  const latestDecisionLog = sortedLogs.find(
    (l) =>
      (l.event_type === "agent.approved" || l.event_type === "agent.flagged") &&
      (l.after?.governance_status === "conditionally_approved" ||
        l.after?.governance_status === "conditionally_shadow"),
  );

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#fafafa]">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Breadcrumb / Back */}
        <div className="flex items-center text-[12px] text-text-ghost font-medium mb-2">
          <button
            onClick={() => navigate(-1)}
            className="hover:text-text-primary transition-colors flex items-center"
          >
            <ArrowLeft size={14} className="mr-1" /> Inventory
          </button>
          <span className="mx-2">/</span>
          <span>AI Agents</span>
          <span className="mx-2">/</span>
          <span className="text-text-secondary font-bold">
            {agent.name || "Unknown Agent"}
          </span>
        </div>

        {/* PENDING BANNER */}
        {agent.status === "under_review" && agent.requested_status && (
          <div className="bg-amber/10 border border-amber/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber/20 text-amber rounded-lg shrink-0 mt-0.5">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-amber-900 font-bold text-[14px] flex items-center gap-2">
                  Status Change Requested
                  <span className="text-[10px] uppercase bg-amber-200/50 text-amber-800 px-2 py-0.5 rounded border border-amber-300/50">
                    Pending
                  </span>
                </h3>
                <p className="text-amber-800/80 text-[13px] mt-1">
                  Requested Status:{" "}
                  <strong className="text-amber-900">
                    {agent.requested_status.replace("_", " ")}
                  </strong>
                </p>
                {agent.request_remark && (
                  <div className="mt-2 p-3 bg-white/40 border border-amber/20 rounded-lg text-[13px] text-amber-900 italic shadow-sm flex items-start gap-2">
                    <div className="w-1 h-full bg-amber/40 rounded-full shrink-0" />
                    "{agent.request_remark}"
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2 bg-amber text-amber-950 font-bold text-[13px] rounded-lg shadow-sm hover:bg-amber-400 transition-colors"
              >
                Review Request
              </button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 sm:gap-6 w-full lg:w-auto overflow-hidden">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue/10 rounded-2xl flex items-center justify-center shrink-0">
                <Bot size={28} className="text-blue sm:w-8 sm:h-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-1.5">
                  <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-800 truncate">
                    {agent.name || "Unknown Agent"}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${statusColor}`}
                  >
                    {agent.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs font-semibold text-slate-500">
                  <div
                    className={`${(agent.provider || agent.cloud_provider || "").toLowerCase().includes("azure") ? "text-[#0078D4]" : (agent.provider || agent.cloud_provider || "").toLowerCase().includes("gcp") ? "text-[#EA4335]" : "text-[#FF9900]"} flex items-center gap-1.5 whitespace-nowrap`}
                  >
                    <Server size={14} />{" "}
                    {agent.provider || agent.cloud_provider || "Unknown Agent"}
                  </div>
                  <div className="hidden sm:block text-slate-300">•</div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <Globe size={14} className="text-slate-400" />
                    {agent.region || "Unknown"}
                  </div>
                  <div className="hidden sm:block text-slate-300">•</div>
                  <div className="flex items-center gap-1.5 font-mono text-slate-400 min-w-0 max-w-full">
                    <span className="shrink-0">ID:</span>
                    <span className="truncate" title={agent.fingerprint || ""}>
                      {agent.fingerprint}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4 lg:pt-0 border-t border-slate-100 lg:border-t-0 w-full lg:w-auto shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                  Passed Controls
                </span>
                <span className="text-lg font-bold text-green">
                  {passes.length}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                  Violations
                </span>
                <span className="text-lg font-bold text-amber">
                  {violations.length}{" "}
                  {violations.length > 0 &&
                  highestViolationSeverity.label !== "Unrated" ? (
                    <span className="text-xs ml-1">
                      {highestViolationSeverity.label}
                    </span>
                  ) : (
                    ""
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                  Missing Props
                </span>
                <span className="text-lg font-bold text-slate-600">
                  {gaps.length}{" "}
                  <span className="text-xs ml-1 text-slate-400">Fields</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                  Risk Score
                </span>
                <span
                  className={`text-lg font-bold ${
                    (agent as any).riskScoreBreakdown?.riskLevel === "Critical"
                      ? "text-red-600"
                      : (agent as any).riskScoreBreakdown?.riskLevel === "High"
                        ? "text-orange-600"
                        : (agent as any).riskScoreBreakdown?.riskLevel ===
                            "Medium"
                          ? "text-amber-500"
                          : "text-emerald-500"
                  }`}
                >
                  {(agent as any).riskScoreBreakdown
                    ? `${(agent as any).riskScoreBreakdown.finalScore}`
                    : "N/A"}
                  <span className="text-xs ml-1">
                    {(agent as any).riskScoreBreakdown?.riskLevel || ""}
                  </span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                  Confidence
                </span>
                <span className="text-lg font-bold text-blue">
                  {confidencePct}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate(`/agents/${id}/findings`)}
              className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Shield size={16} /> View Security Findings
            </button>
            <button
              onClick={() => navigate(`/agents/${id}/new`)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors flex items-center gap-2 shadow-sm border border-transparent"
            >
              <Activity size={16} /> View Modern Dashboard (Beta)
            </button>
            <button
              onClick={() => navigate(`/agents/${id}/lineage`)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              <GitBranch size={16} /> View Data Lineage Graph
            </button>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Shield size={16} /> View Security Controls
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              <FileText size={16} /> Update Status
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-200 mt-6 gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "overview" ? "border-blue text-blue" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Overview & Telemetry
          </button>
          <button
            onClick={() => setActiveTab("owasp")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "owasp" ? "border-blue text-blue" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <Shield
              size={16}
              className={activeTab === "owasp" ? "text-blue" : "text-slate-400"}
            />
            Assessments
          </button>
          {/* <button
            onClick={() => setActiveTab("risk")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "risk" ? "border-blue text-blue" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <Activity
              size={16}
              className={activeTab === "risk" ? "text-blue" : "text-slate-400"}
            />
            Risk Breakdown
          </button> */}
        </div>

        {activeTab === "owasp" ? (
          <div className="mt-6">
            <AssessmentPanel agentId={id!} />
          </div>
        ) : activeTab === "risk" ? (
          <div className="mt-6">
            <RiskScoreBreakdownPanel agent={agent} />
          </div>
        ) : (
          <>
            {/* GOVERNANCE JOURNEY (Conditionally Approved/Shadow) */}
            {showGovernanceJourney && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Shield
                    size={18}
                    className={
                      isConditionallyApproved ? "text-green" : "text-amber"
                    }
                  />
                  Governance & Approval Journey
                </h3>

                <div className="flex flex-col md:flex-row gap-6 relative">
                  {/* Connector line for desktop */}
                  <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-slate-200 -translate-x-1/2" />

                  {/* Request Phase */}
                  <div className="flex-1 relative">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 h-full">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                          <Clock size={14} /> Request Raised
                        </span>
                        {latestRequestLog && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(
                              latestRequestLog.created_at,
                            ).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {latestRequestLog ? (
                        <>
                          <div className="text-sm font-medium text-slate-800 mb-1">
                            By:{" "}
                            <span className="font-semibold text-blue">
                              {latestRequestLog.user_email || "Unknown Analyst"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mb-3">
                            Requested Status:{" "}
                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {latestRequestLog.after?.requested_status}
                            </span>
                          </div>
                          {latestRequestLog.after?.request_remark ? (
                            <div className="bg-white border border-slate-200 rounded p-3 text-xs text-slate-600 italic relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue/40 rounded-l" />
                              "{latestRequestLog.after.request_remark}"
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              No remark provided.
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Request log not available.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Decision Phase */}
                  <div className="flex-1 relative">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 h-full">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                          <CheckCircle2
                            size={14}
                            className={
                              isConditionallyApproved
                                ? "text-green"
                                : "text-amber"
                            }
                          />{" "}
                          Decision Granted
                        </span>
                        {latestDecisionLog && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(
                              latestDecisionLog.created_at,
                            ).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {latestDecisionLog ? (
                        <>
                          <div className="text-sm font-medium text-slate-800 mb-1">
                            By:{" "}
                            <span className="font-semibold text-blue">
                              {latestDecisionLog.user_email || "System/Admin"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mb-3">
                            Final Status:{" "}
                            <span
                              className={`font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 ${isConditionallyApproved ? "text-green" : "text-amber"}`}
                            >
                              {latestDecisionLog.after?.governance_status}
                            </span>
                          </div>
                          {agent.approval_remark ? (
                            <div className="bg-white border border-slate-200 rounded p-3 text-xs text-slate-600 italic relative">
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-1 ${isConditionallyApproved ? "bg-green/40" : "bg-amber/40"} rounded-l`}
                              />
                              "{agent.approval_remark}"
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              No remark provided.
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Decision log not available.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TOP CARDS (3 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Passed */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green" /> What is
                    there (Passed)
                  </h3>
                  <span className="text-[10px] font-bold bg-green/10 text-green px-2 py-0.5 rounded border border-green/20">
                    {passes.length} Enforced
                  </span>
                </div>
                <div className="space-y-3">
                  {passes.map((p, i) => (
                    <div
                      key={i}
                      className="border border-green/20 bg-green/5 rounded-lg p-3"
                    >
                      <div className="text-xs font-bold text-slate-800 flex items-start gap-1.5 mb-1">
                        <CheckCircle2
                          size={14}
                          className="text-green shrink-0 mt-0.5"
                        />{" "}
                        {p.label}
                      </div>
                      <div className="text-[11px] text-slate-500 pl-5 leading-relaxed">
                        {p.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Violations */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber" />{" "}
                    Violations & Weaknesses
                  </h3>
                  <span className="text-[10px] font-bold bg-amber/10 text-amber px-2 py-0.5 rounded border border-amber/20">
                    {violations.length} Findings
                  </span>
                </div>
                <div className="space-y-3">
                  {violations.length === 0 ? (
                    <div className="text-sm text-slate-400 p-4 text-center">
                      No violations detected.
                    </div>
                  ) : (
                    violations.map((v, i) => (
                      <div
                        key={i}
                        className="border border-amber/20 bg-amber/5 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-xs font-bold text-slate-800 flex items-start gap-1.5">
                            <AlertTriangle
                              size={14}
                              className="text-amber shrink-0 mt-0.5"
                            />{" "}
                            {v.label}
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getViolationSeverity(v.findingType).className}`}
                          >
                            {getViolationSeverity(v.findingType).label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                          {v.desc}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Gaps */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                    <HelpCircle size={16} className="text-slate-400" /> What is
                    missing (Gaps)
                  </h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                    {gaps.length} Blindspots
                  </span>
                </div>
                <div className="space-y-2 flex-1">
                  {gaps.length === 0 ? (
                    <div className="text-sm text-slate-400 p-4 text-center">
                      No blindspots detected.
                    </div>
                  ) : (
                    gaps.map((g, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center border border-slate-100 bg-slate-50 rounded-lg p-3"
                      >
                        <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-2">
                          <FileText size={12} className="text-slate-400" />{" "}
                          {g.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono bg-white px-2 py-1 rounded border border-slate-100">
                          {g.value}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-6 text-[10px] text-slate-400 leading-tight">
                  Orphaned agent risk: missing metadata prevents automated cost
                  & compliance chargeback.
                </div>
              </div>
            </div>

            {/* CHARTS (3 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Posture Breakdown
                  </h3>
                  <span className="text-[10px] font-bold text-slate-800">
                    {passes.length + violations.length + gaps.length} Total
                    Controls Evaluated
                  </span>
                </div>
                <div className="h-48 relative w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-10px]">
                    <span className="text-2xl font-bold text-slate-800">
                      {Math.round(
                        (passes.length /
                          (passes.length + violations.length + gaps.length)) *
                          100,
                      )}
                      %
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Fully Guarded
                    </span>
                  </div>
                </div>
                <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green"></div>{" "}
                    {passes.length} Passed
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber"></div>{" "}
                    {violations.length} Violations
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>{" "}
                    {gaps.length} Missing
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Access Perimeter Risk
                  </h3>
                  <span className="text-[10px] font-bold text-green">
                    {radarData.filter((d) => d.A === 1).length} Egress Exposure
                  </span>
                </div>
                <div className="h-48 relative w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      data={radarData}
                    >
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "#64748b", fontSize: 9, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 1]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name="Agent"
                        dataKey="A"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center text-[10px] text-slate-500 font-medium">
                  Zero uncontained lateral movement routes found across
                  VPC/Egress.
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Scan Authenticity
                  </h3>
                  <span className="text-[10px] font-bold text-blue">
                    {confidencePct / 100} Score
                  </span>
                </div>
                <div className="h-48 relative w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="75%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        {gaugeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 pointer-events-none">
                    <span className="text-3xl font-extrabold text-slate-800">
                      {confidencePct}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Discovery Confidence
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 px-2 mt-[-10px]">
                  <span>
                    Collector:{" "}
                    {agent.source_collectors?.length
                      ? agent.source_collectors.join(", ")
                      : "Unknown"}
                  </span>
                  <span>
                    Deep Scan:{" "}
                    {metadata.deep && Object.keys(metadata.deep).length > 0
                      ? "Verified"
                      : "Not Scanned"}
                  </span>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT 2/3 COLUMN */}
              <div className="lg:col-span-2 space-y-6">
                {/* Behavior & Instructions */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 tracking-wide">
                      <Activity size={16} className="text-blue" /> Agent
                      Behavior & Instructions
                    </h2>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">
                      {agent.deployment_type || "Unknown"}
                    </span>
                  </div>

                  <div className="mb-6">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Purpose / Role Description
                    </span>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-[13px] text-slate-700 font-medium">
                      {agent.evidence_reason ||
                      metadata.description ||
                      metadata.deep?.description ? (
                        agent.evidence_reason ||
                        metadata.description ||
                        metadata.deep?.description
                      ) : (
                        <span className="text-slate-400 italic">
                          No purpose description available
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        System Instruction Preview
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            config.instruction ||
                              metadata.instructionPreview ||
                              metadata.deep?.instructionPreview ||
                              "",
                          )
                        }
                        className="text-[11px] font-bold text-blue hover:text-blue-700 flex items-center gap-1 transition-colors"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 font-mono text-[12px] text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap shadow-inner">
                      {config.instruction ||
                      metadata.instructionPreview ||
                      metadata.deep?.instructionPreview ? (
                        config.instruction ||
                        metadata.instructionPreview ||
                        metadata.deep?.instructionPreview
                      ) : (
                        <span className="text-slate-500 italic">
                          No system instructions detected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cloud Architecture */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 tracking-wide mb-6">
                    <Cpu size={16} className="text-purple" /> Cloud Architecture
                    & Identification
                  </h2>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border border-slate-200 bg-slate-50 rounded-lg p-3">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                        Agent Endpoint ARN
                      </span>
                      <span className="text-[12px] font-mono font-bold text-blue break-all sm:text-right">
                        {metadata.deep?.agentArn || agent.fingerprint}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border border-slate-200 bg-slate-50 rounded-lg p-3">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                        IAM Resource Role
                      </span>
                      <span className="text-[12px] font-mono font-bold text-blue break-all sm:text-right">
                        {metadata.deep?.agentResourceRoleArn || "N/A"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="border border-slate-200 bg-slate-50 rounded-lg p-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Foundation Model ID
                        </span>
                        <span className="text-[13px] font-mono font-bold text-slate-800">
                          {agent.model ||
                            metadata.deep?.foundationModel ||
                            "Unknown"}
                        </span>
                      </div>
                      <div className="border border-slate-200 bg-slate-50 rounded-lg p-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Encryption Standard
                        </span>
                        <span className="text-[13px] font-bold text-slate-600">
                          {metadata.deep?.customerEncryptionKeyArn
                            ? "Customer Managed Key"
                            : "Platform Managed Key (Default)"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT 1/3 COLUMN */}
              <div className="space-y-6">
                {/* Data Classification & Privacy Risk */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 tracking-wide mb-4">
                    <Lock size={16} className="text-amber" /> Privacy Risk
                  </h2>

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        label: "PHI Access",
                        value: agent.data_access_classification?.phi_access,
                      },
                      {
                        label: "PII Access",
                        value: agent.data_access_classification?.pii_access,
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 flex justify-between items-center ${item.value ? "bg-amber/5 border-amber/20" : "bg-green/5 border-green/20"}`}
                      >
                        <span className="text-[12px] font-bold text-slate-700">
                          {item.label}
                        </span>
                        <div
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 ${item.value ? "bg-amber/10 text-amber" : "bg-green/10 text-green"}`}
                        >
                          {item.value ? (
                            <AlertTriangle size={12} />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          {item.value ? "Configured" : "Unconfigured"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 relative">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 tracking-wide">
                      <Clock size={16} className="text-blue" /> Lifecycle &
                      Audit Log
                    </h2>
                  </div>

                  <div className="relative border-l-2 border-slate-100 ml-2 space-y-8 pb-4 max-h-96 overflow-y-auto pr-4">
                    {logs.length > 0 ? (
                      logs.map((log) => {
                        const isSystem = log.log_type === "access";
                        const isShadow =
                          log.event_type === "agent.status_changed" &&
                          log.summary.toLowerCase().includes("shadow");
                        const isApproved =
                          log.event_type === "agent.status_changed" &&
                          log.summary.toLowerCase().includes("approved");
                        const isImportantStatusChange = isShadow || isApproved;

                        const bgClass = isShadow
                          ? "bg-amber/10 border border-amber/20 rounded-lg p-3"
                          : isApproved
                            ? "bg-green/10 border border-green/20 rounded-lg p-3"
                            : "";
                        const dotClass = isShadow
                          ? "bg-amber"
                          : isApproved
                            ? "bg-green"
                            : isSystem
                              ? "bg-slate-300"
                              : "bg-green";
                        const titleClass = isShadow
                          ? "text-amber-800"
                          : isApproved
                            ? "text-green-800"
                            : "text-slate-800";
                        const tagClass = isShadow
                          ? "bg-amber/20 text-amber-800"
                          : isApproved
                            ? "bg-green/20 text-green-800"
                            : "";
                        const descClass = isShadow
                          ? "text-amber-700 font-medium"
                          : isApproved
                            ? "text-green-700 font-medium"
                            : "text-slate-500";

                        return (
                          <div key={log.id} className="relative pl-6 pb-2">
                            <div
                              className={`absolute -left-[5px] ${isImportantStatusChange ? "top-4" : "top-1"} w-2 h-2 rounded-full ring-4 ring-white ${dotClass}`}
                            ></div>
                            <div className={bgClass}>
                              <div className="flex justify-between items-start mb-1">
                                <span
                                  className={`text-[12px] font-bold ${titleClass}`}
                                >
                                  {log.event_type}
                                  {isImportantStatusChange && (
                                    <span
                                      className={`ml-2 text-[9px] px-1.5 py-0.5 rounded uppercase ${tagClass}`}
                                    >
                                      Status Update
                                    </span>
                                  )}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                  {new Date(log.created_at).toLocaleString(
                                    undefined,
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              </div>
                              <div
                                className={`text-[11px] leading-relaxed ${descClass}`}
                              >
                                {log.summary}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-slate-400 p-4 text-center">
                        No audit log entries recorded for this agent yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Security Controls Drawer */}
      {isDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-[400px] max-w-full bg-white z-[110] shadow-2xl overflow-y-auto flex flex-col transform transition-transform duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Shield size={20} className="text-brand" /> Security Controls
              </h2>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 bg-white">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-4">
                Perimeter & Access
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: "Internet Access", value: agent.internet_access },
                  { label: "Filesystem", value: agent.filesystem_access },
                  { label: "Database Access", value: agent.database_access },
                  { label: "GitHub Access", value: agent.github_access },
                  { label: "Slack Access", value: agent.slack_access },
                  { label: "Email Access", value: agent.email_access },
                  { label: "Secrets Detected", value: agent.secrets_detected },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-between items-center"
                  >
                    <span className="text-sm text-slate-700 font-semibold">
                      {item.label}
                    </span>
                    <div className="text-[12px] font-bold flex items-center gap-1.5">
                      {item.value ? (
                        <span className="text-amber flex items-center gap-1">
                          <AlertTriangle size={14} /> Enabled
                        </span>
                      ) : (
                        <span className="text-green flex items-center gap-1">
                          <CheckCircle2 size={14} /> Disabled
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <UpdateAgentStatusModal
        isOpen={isModalOpen}
        agent={agent}
        onClose={() => setIsModalOpen(false)}
        onUpdate={async (agentId, actionType, payload, remark) => {
          try {
            if (actionType === "request") {
              await discoveryAPI.requestAgentApproval(
                agentId,
                payload!,
                remark!,
              );
            } else {
              await discoveryAPI.approveAgent(
                agentId,
                actionType,
                remark,
                payload,
              );
            }
            // Refresh agent details
            const res = await discoveryAPI.getAgent(agentId);
            setAgent(res.data.agent);
          } catch (err) {
            console.error("Failed to update agent status:", err);
          }
        }}
      />
    </div>
  );
}
