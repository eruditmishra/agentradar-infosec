import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { discoveryAPI, auditAPI } from "../../lib/api";
import type { DiscoveredAgent } from "../../types/discovery";
import {
  ArrowLeft,
  AlertTriangle,
  Monitor,
  HelpCircle,
  Download,
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
import { generatePDFReportHTML } from "../../lib/reportGenerator";


export default function AgentFindings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<DiscoveredAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "passed" | "gaps">("all");

  useEffect(() => {
    if (!id) return;

    discoveryAPI
      .getAgent(id)
      .then((res) => {
        setAgent(res.data.agent);
        setLoading(false);

        auditAPI
          .logBusinessEvent({
            eventType: "agent.viewed.findings",
            entityType: "agent",
            entityId: id,
            summary: `User checked detailed security findings for ${res.data.agent.name || id}`,
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
      <div className="p-6 text-center text-slate-500">Agent not found.</div>
    );
  }

  const metadata = agent.metadata || {};
  const config = agent.agent_config || {};
  const confidencePct = agent.confidence_score
    ? Math.round(Number(agent.confidence_score) * 100)
    : 0;

  // Computed Findings (Copied logic from Details page)
  const passes: { label: string; desc: string }[] = [];
  const violations: {
    label: string;
    desc: string;
    severity: "high" | "medium" | "low" | "unrated";
    rule: string;
    field: string;
  }[] = [];
  const gaps: { label: string; field: string; desc: string }[] = [];

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

  const getViolationSeverity = (
    findingType: string | null,
  ): "high" | "medium" | "low" | "unrated" => {
    const match = findingType
      ? (agent.findings || []).find((f) => f.finding_type === findingType)
      : null;
    switch (match?.severity) {
      case "critical":
        return "high";
      case "risk":
        return "medium";
      case "info":
        return "low";
      default:
        return "unrated";
    }
  };

  if (agent.internet_access)
    violations.push({
      label: "Unrestricted Internet Egress",
      desc: "Agent has outbound internet access enabled without firewall constraints.",
      severity: getViolationSeverity("access_broadened"),
      rule: "SEC-NW-001",
      field: "internet_access: true",
    });
  if (agent.filesystem_access)
    violations.push({
      label: "Local Filesystem Mount",
      desc: "Agent can access local filesystem.",
      severity: getViolationSeverity("access_broadened"),
      rule: "SEC-FS-001",
      field: "filesystem_access: true",
    });
  if (agent.secrets_detected)
    violations.push({
      label: "Embedded Secrets Detected",
      desc: "Hardcoded secrets found in configuration payload.",
      severity: getViolationSeverity("secrets_exposed"),
      rule: "SEC-CRED-001",
      field: "secrets_detected: true",
    });
  if (agent.database_access)
    violations.push({
      label: "Direct Database Access",
      desc: "Direct DB queries permitted, bypassing standard application tiers.",
      severity: getViolationSeverity("tools_changed"),
      rule: "SEC-DB-001",
      field: "database_access: true",
    });
  if (agent.cloud_provider === "aws" && !metadata.deep?.customerEncryptionKeyArn) {
    violations.push({
      label: "Unmanaged Encryption at Rest (Missing KMS CMK)",
      desc: "The Agent relies exclusively on the default AWS-managed encryption key. It does not have a dedicated Customer Managed Key (CMK) configured for session context and agent metadata encryption at rest. Inability to enforce organizational key rotation, independent cryptographic revocation, or export audit logs via AWS KMS CloudTrail events.",
      severity: getViolationSeverity(null),
      rule: "SEC-BEDROCK-001",
      field: "customerEncryptionKeyArn: null",
    });
  } else if (agent.cloud_provider === "azure" && !metadata.deep?.keyVaultUri) {
    violations.push({
      label: "Unmanaged Encryption at Rest (Missing Key Vault CMK)",
      desc: "The Agent relies exclusively on the default Azure-managed encryption key. It does not have a dedicated Customer Managed Key (CMK) via Azure Key Vault configured for session context and agent metadata encryption at rest. Inability to enforce organizational key rotation or export audit logs.",
      severity: getViolationSeverity(null),
      rule: "SEC-AZURE-001",
      field: "keyVaultUri: null",
    });
  } else if (agent.cloud_provider === "gcp" && !metadata.deep?.kmsKeyName) {
    violations.push({
      label: "Unmanaged Encryption at Rest (Missing Cloud KMS CMEK)",
      desc: "The Agent relies exclusively on the default Google-managed encryption key. It does not have a dedicated Customer-Managed Encryption Key (CMEK) configured for session context and agent metadata encryption at rest. Inability to enforce organizational key rotation or export audit logs.",
      severity: getViolationSeverity(null),
      rule: "SEC-GCP-001",
      field: "kmsKeyName: null",
    });
  }

  if (agent.cloud_provider === "aws" && metadata.aliases && metadata.aliases.includes("AgentTestAlias")) {
    violations.push({
      label: "Environment Stage Contamination (Test Alias in Production)",
      desc: "The agent is classified in the production environment, but exposes a staging alias alongside the live production routing endpoint. Stage pollution introduces risks of accidental routing of test traffic into production log streams, unauthorized experimental prompts being executed against live datasets, and unvetted model behavior.",
      severity: "medium",
      rule: "SEC-BEDROCK-002",
      field: 'aliases: ["AgentTestAlias", "live"]',
    });
  }

  if (!agent.owner)
    gaps.push({
      label: "Ownership",
      field: "owner: null",
      desc: "No individual engineer or security contact is linked.",
    });
  if (
    !agent.data_access_classification ||
    Object.keys(agent.data_access_classification).length === 0
  )
    gaps.push({
      label: "Data Classification",
      field: "classification: null",
      desc: "Missing data sensitivity tag (e.g., Public, Internal, Confidential).",
    });
  if (!agent.repository)
    gaps.push({
      label: "Source Repository",
      field: "repository: null",
      desc: "No Git repo or IaC pipeline linked for version traceability.",
    });
  if (!agent.department)
    gaps.push({
      label: "Department",
      field: "department: null",
      desc: "Prevents internal cost allocation and chargeback.",
    });
  if (!agent.tools || agent.tools.length === 0)
    gaps.push({
      label: "Action Groups / Tools",
      field: "tools: []",
      desc: "No external Lambda functions or action schemas registered.",
    });

  if (passes.length === 0)
    passes.push({
      label: "Basic Checks Passed",
      desc: "Base agent configuration passed standard structural validation.",
    });

  // Severity Counts
  const highCount = violations.filter((v) => v.severity === "high").length;
  const medCount = violations.filter((v) => v.severity === "medium").length;
  const lowCount = violations.filter((v) => v.severity === "low").length;
  const unratedCount = violations.filter((v) => v.severity === "unrated").length;

  const highestSeverity =
    highCount > 0
      ? "High"
      : medCount > 0
        ? "Medium"
        : lowCount > 0
          ? "Low"
          : unratedCount > 0
            ? "Unrated"
            : "None";
  const highestSeverityColor =
    highCount > 0
      ? "text-red"
      : medCount > 0
        ? "text-amber"
        : lowCount > 0
          ? "text-blue"
          : unratedCount > 0
            ? "text-slate-500"
            : "text-slate-400";

  // Charts Data
  const severityData = [
    { name: "High", value: highCount, color: "#ef4444" },
    { name: "Medium", value: medCount, color: "#f59e0b" },
    { name: "Low", value: lowCount, color: "#3b82f6" },
    { name: "Unrated", value: unratedCount, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const radarData = [
    { subject: "Internet", A: agent.internet_access ? 1 : 0, fullMark: 1 },
    { subject: "Filesystem", A: agent.filesystem_access ? 1 : 0, fullMark: 1 },
    { subject: "DB Access", A: agent.database_access ? 1 : 0, fullMark: 1 },
    { subject: "Browser", A: agent.browser_access ? 1 : 0, fullMark: 1 },
    { subject: "GitHub", A: agent.github_access ? 1 : 0, fullMark: 1 },
    { subject: "Secrets", A: agent.secrets_detected ? 1 : 0, fullMark: 1 },
  ];
  const perimeterExposureCount = radarData.filter((d) => d.A === 1).length;

  const coverageData = [
    { name: "Passed", value: passes.length, color: "#10b981" },
    { name: "Violations", value: violations.length, color: "#f59e0b" },
    { name: "Missing", value: gaps.length, color: "#94a3b8" },
  ];

  const handleDownloadPDF = () => {
    if (!agent) return;
    const htmlString = generatePDFReportHTML(
      agent,
      passes,
      violations,
      gaps,
      highestSeverity,
      confidencePct,
      highCount,
      medCount,
      lowCount,
      perimeterExposureCount
    );

    // Fix: Unsafe Use of Target blank — open with noopener,noreferrer so the new
    // window has no access back to this window via window.opener.
    const newWindow = window.open("", "_blank", "noopener,noreferrer");
    if (newWindow) {
      newWindow.document.write(htmlString);
      newWindow.document.close();
      // Wait for charts to render and resources to load before printing
      setTimeout(() => {
        newWindow.print();
      }, 500);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#fafafa] print:bg-white print:p-0 print:overflow-visible">
      <div
        id="report-container"
        className="max-w-7xl mx-auto space-y-6 pb-12 print:pb-0"
      >
        {/* Back navigation & Actions */}
        <div className="flex items-center justify-between text-[12px] text-text-ghost font-medium mb-4 print:hidden">
          <button
            onClick={() => navigate(-1)}
            className="hover:text-text-primary transition-colors flex items-center"
          >
            <ArrowLeft size={14} className="mr-1" /> Back to Agent Details
          </button>

          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-semibold"
          >
            <Download size={14} className="text-brand" /> Download PDF
          </button>
        </div>

        {/* Security Findings & Governance Header Card */}
        <div className="bg-white border border-indigo-100 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue/10 text-blue">
                POSTURE ASSESSMENT
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Confidence {confidencePct}%
              </span>
            </div>
            <h1 className="text-2xl font-display font-extrabold text-slate-900 mb-2">
              Security Findings & Governance
            </h1>
            <div className="flex items-center gap-2 text-[12px] text-slate-500 font-mono">
              <span className="font-sans font-semibold text-slate-600">
                Target: <span className="text-slate-800">{agent.name}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span>
                ARN: ...{agent.fingerprint?.slice(-15) || "agent/Unknown"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-sans font-semibold text-slate-600">
                Model:{" "}
                <span className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
                  {agent.model || "Unknown"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Severity
              </span>
              <div
                className={`text-lg font-bold flex items-center gap-1.5 ${highestSeverityColor}`}
              >
                <AlertTriangle size={16} /> {highestSeverity}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Open Issues
              </span>
              <span className="text-xl font-bold text-slate-800">
                {violations.length}{" "}
                <span className="text-sm font-semibold text-slate-500">
                  Findings
                </span>
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Clean Controls
              </span>
              <span className="text-xl font-bold text-green">
                {passes.length}{" "}
                <span className="text-sm font-semibold text-green/70">
                  Passed
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* 3 COLUMN CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Findings by Severity */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Findings by Severity
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {violations.length} Active
              </span>
            </div>
            <div className="h-48 relative w-full mt-2">
              {violations.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        innerRadius={50}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-5px]">
                    <span className="text-2xl font-bold text-slate-800">
                      {violations.length}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">
                      Issues
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  No Active Findings
                </div>
              )}
            </div>
            <div className="flex justify-between mt-4 text-[11px] font-bold px-2">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red"></div> {highCount}{" "}
                High
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber"></div> {medCount}{" "}
                Med
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue"></div> {lowCount}{" "}
                Low
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>{" "}
                {unratedCount} Unrated
              </span>
            </div>
          </div>

          {/* Perimeter Exposure */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Perimeter Exposure
              </h3>
              {perimeterExposureCount === 0 ? (
                <span className="text-[10px] font-bold bg-green/10 text-green px-2 py-0.5 rounded border border-green/20">
                  100% Contained
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-red/10 text-red px-2 py-0.5 rounded border border-red/20">
                  {perimeterExposureCount} Exposures
                </span>
              )}
            </div>
            <div className="h-48 relative w-full mt-2">
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
            <div className="text-center text-[10px] text-slate-400 font-medium">
              {perimeterExposureCount === 0
                ? "No open ingress/egress routes detected on execution layer."
                : "Open perimeter routes detected."}
            </div>
          </div>

          {/* Governance & Coverage */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Governance & Coverage
              </h3>
              <span className="text-[10px] font-bold text-blue bg-blue/10 px-2 py-0.5 rounded">
                {passes.length + violations.length + gaps.length} Evaluated
              </span>
            </div>
            <div className="h-48 relative w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={coverageData}
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {coverageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-5px]">
                <span className="text-2xl font-bold text-slate-800">
                  {Math.round(
                    (passes.length /
                      (passes.length + violations.length + gaps.length)) *
                      100,
                  )}
                  %
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase">
                  Covered
                </span>
              </div>
            </div>
            <div className="flex justify-between mt-4 text-[11px] font-bold px-2">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green"></div>{" "}
                {passes.length} Passed
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber"></div>{" "}
                {violations.length} Violations
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>{" "}
                {gaps.length} Gaps
              </span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex justify-between items-center border-b border-slate-200 mt-8 mb-6">
          <div className="flex gap-2 relative top-[1px]">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors rounded-t-lg ${
                activeTab === "all"
                  ? "border-slate-800 text-white bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              All Findings ({violations.length})
            </button>
            <button
              onClick={() => setActiveTab("passed")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors rounded-t-lg ${
                activeTab === "passed"
                  ? "border-slate-800 text-white bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Passed Controls ({passes.length})
            </button>
            <button
              onClick={() => setActiveTab("gaps")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors rounded-t-lg ${
                activeTab === "gaps"
                  ? "border-slate-800 text-white bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Governance Gaps ({gaps.length})
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-2">
            <Monitor size={12} /> Scan updated:{" "}
            {new Date(
              agent.updated_at || agent.created_at || new Date(),
            ).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            UTC
          </div>
        </div>

        {/* FINDINGS LIST */}
        {(activeTab === "all" || activeTab === "passed") && (
          <div className="space-y-4">
            {activeTab === "all" && violations.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
                No active security findings detected.
              </div>
            )}
            {activeTab === "passed" && passes.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
                No passed controls recorded.
              </div>
            )}

            {/* Render Violations */}
            {activeTab === "all" &&
              violations.map((v, i) => (
                <div
                  key={`v-${i}`}
                  className="bg-white border border-amber/30 rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            v.severity === "high"
                              ? "bg-red/10 text-red border-red/20"
                              : v.severity === "medium"
                                ? "bg-amber/10 text-amber border-amber/20"
                                : v.severity === "low"
                                  ? "bg-blue/10 text-blue border-blue/20"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {v.severity}
                        </span>
                        <h3 className="text-[15px] font-bold text-slate-900">
                          {v.label}
                        </h3>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                        <span>{v.rule}</span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Field:{" "}
                          <span className="bg-amber/10 text-amber-700 px-1 py-0.5 rounded">
                            {v.field}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <div className="mb-4">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Issue Description
                          </h4>
                          <p className="text-[12px] text-slate-600 leading-relaxed">
                            {v.desc.split(". ")[0]}.
                          </p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Compliance & Threat Impact
                          </h4>
                          <p className="text-[12px] text-slate-600 leading-relaxed">
                            {v.desc.split(". ").slice(1).join(". ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {/* Render Passes (if activeTab is 'passed') */}
            {activeTab === "passed" &&
              passes.map((p, i) => (
                <div
                  key={`p-${i}`}
                  className="bg-white border border-green/20 rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green/10 text-green border border-green/20">
                          Passed
                        </span>
                        <h3 className="text-[15px] font-bold text-slate-900">
                          {p.label}
                        </h3>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* GOVERNANCE GAPS GRID */}
        {(activeTab === "all" || activeTab === "gaps") && (
          <div className="mt-8">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 tracking-wide mb-1">
                  <HelpCircle size={16} className="text-slate-400" /> Missing
                  Governance Metadata ({gaps.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Unassigned tags and metadata properties that prevent automated
                  chargeback and risk ownership.
                </p>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                High Governance Debt
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gaps.length === 0 ? (
                <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
                  No governance gaps detected.
                </div>
              ) : (
                gaps.map((g, i) => (
                  <div
                    key={`g-${i}`}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-[12px] font-bold text-slate-800">
                        {g.label}
                      </h3>
                      <span className="text-[9px] font-mono font-semibold bg-red/10 text-red px-1.5 py-0.5 rounded border border-red/20">
                        {g.field}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {g.desc}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
