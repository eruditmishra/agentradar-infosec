import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { discoveryAPI } from "../../lib/api";
import Chart from "chart.js/auto";

export default function NewAgentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("analytics");
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [toolFilter, setToolFilter] = useState<"all" | "modifying" | "readonly">("all");

  // Chart refs
  const dataSensitivityChartRef = useRef<HTMLCanvasElement>(null);
  const toolRiskDoughnutRef = useRef<HTMLCanvasElement>(null);
  const confidenceScoreChartRef = useRef<HTMLCanvasElement>(null);
  const radarPostureChartRef = useRef<HTMLCanvasElement>(null);
  const toolPermissionsBarRef = useRef<HTMLCanvasElement>(null);
  const defenseControlsChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances to destroy on unmount/re-render
  const chartsRef = useRef<{ [key: string]: Chart }>({});

  useEffect(() => {
    if (id) {
      discoveryAPI
        .getAgent(id)
        .then((res) => {
          setAgent(res.data.agent);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [id]);

  useEffect(() => {
    if (!agent || activeTab !== "analytics") return;

    const surface = agent.metadata?.adversarial_surface || {};
    const tools = surface.tools || [];
    const kbs = surface.memory_and_context?.knowledge_bases || [];
    const deep = agent.metadata?.deep || {};

    const destroyCharts = () => {
      Object.values(chartsRef.current).forEach((chart) => chart.destroy());
      chartsRef.current = {};
    };

    destroyCharts();

    // Chart 1: Data Sensitivity (Pie)
    if (dataSensitivityChartRef.current) {
      const phiTools = tools.filter((t: any) => t.risk_flags?.can_access_phi).length;
      const piiTools = tools.filter((t: any) => t.risk_flags?.can_access_pii).length;
      const secTools = tools.filter((t: any) => t.risk_flags?.can_access_secrets).length;
      const publicData = Math.max(1, tools.length - (phiTools+piiTools+secTools));
      
      chartsRef.current.sensitivity = new Chart(dataSensitivityChartRef.current, {
        type: "pie",
        data: {
          labels: ["PHI (Health Records)", "PII (Identifiers)", "Public / Policy Knowledge"],
          datasets: [
            {
              data: [phiTools, piiTools, publicData],
              backgroundColor: ["#F43F5E", "#F59E0B", "#38BDF8"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    }

    // Chart 2: Tool Risk (Doughnut)
    if (toolRiskDoughnutRef.current) {
      const stateMod = tools.filter((t: any) => t.risk_flags?.can_modify_state).length;
      const readOnly = tools.length - stateMod;
      const kbSearch = kbs.length;
      chartsRef.current.toolRisk = new Chart(toolRiskDoughnutRef.current, {
        type: "doughnut",
        data: {
          labels: ["State Modifying", "Read-Only", "KB Search"],
          datasets: [
            {
              data: [Math.max(1, stateMod), Math.max(1, readOnly), Math.max(1, kbSearch)],
              backgroundColor: ["#F43F5E", "#38BDF8", "#A855F7"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "75%",
          plugins: { legend: { display: false } },
        },
      });
    }

    // Chart 3: Confidence Score (Doughnut as Gauge)
    if (confidenceScoreChartRef.current) {
      const score = Math.round((surface.confidence_score || agent.confidence_score || 0) * 100);
      chartsRef.current.confidence = new Chart(confidenceScoreChartRef.current, {
        type: "doughnut",
        data: {
          labels: ["Confidence", ""],
          datasets: [
            {
              data: [score, 100 - score],
              backgroundColor: ["#38BDF8", "#e2e8f0"],
              borderWidth: 0,
              circumference: 180,
              rotation: 270,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "80%",
          plugins: { legend: { display: false } },
        },
      });
    }

    // Chart 4: Radar Posture
    if (radarPostureChartRef.current) {
      chartsRef.current.radar = new Chart(radarPostureChartRef.current, {
        type: "radar",
        data: {
          labels: ["Encryption & KMS", "Guardrails", "IAM Privilege"],
          datasets: [
            {
              label: "Current Score",
              data: [
                deep.customerEncryptionKeyArn ? 100 : 0,
                deep.guardrails?.present ? 100 : 0,
                surface.identity_and_access?.over_permissioned ? 0 : 100,
              ],
              backgroundColor: "rgba(244, 63, 94, 0.2)",
              borderColor: "#F43F5E",
              pointBackgroundColor: "#F43F5E",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: { color: "#e2e8f0" },
              grid: { color: "#e2e8f0" },
              pointLabels: { color: "#64748b", font: { size: 10 } },
              ticks: { display: false },
              min: 0,
              max: 100,
            },
          },
          plugins: { legend: { display: false } },
        },
      });
    }

    // Chart 5: Tool Permissions Bar
    if (toolPermissionsBarRef.current && tools.length > 0) {
      const names = tools.map((t: any) => t.name).slice(0, 5);
      const permCounts = tools.map((t: any) => t.permissions?.length || 1).slice(0, 5);
      chartsRef.current.permissions = new Chart(toolPermissionsBarRef.current, {
        type: "bar",
        data: {
          labels: names,
          datasets: [
            {
              label: "Assumed IAM Actions",
              data: permCounts,
              backgroundColor: "#A855F7",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { grid: { color: "#e2e8f0" }, ticks: { color: "#64748b" } },
            x: { grid: { display: false }, ticks: { color: "#64748b" } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }

    // Chart 6: Defense Controls
    if (defenseControlsChartRef.current) {
      chartsRef.current.defense = new Chart(defenseControlsChartRef.current, {
        type: "bar",
        data: {
          labels: ["KMS", "Guardrails", "IAM Boundary", "VPC"],
          datasets: [
            {
              label: "Status",
              data: [
                deep.customerEncryptionKeyArn ? 1 : 0.5,
                deep.guardrails?.present ? 1 : 0,
                surface.identity_and_access?.over_permissioned ? 0.5 : 1,
                deep.vpcConfigured ? 1 : 0,
              ],
              backgroundColor: ["#10B981", "#10B981", "#F59E0B", "#EF4444"],
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { max: 1, display: false },
            y: { grid: { display: false }, ticks: { color: "#64748b" } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }

    return () => destroyCharts();
  }, [agent, activeTab]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast here
  };

  if (loading) {
    return (
      <div className="bg-[#fafafa] text-text-primary font-sans min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!agent) {
    return <div className="bg-[#fafafa] text-text-primary font-sans min-h-screen flex items-center justify-center">Agent not found.</div>;
  }

  const deep = agent.metadata?.deep || {};
  const surface = agent.metadata?.adversarial_surface || {};
  const tools = surface.tools || [];
  const kbs = surface.memory_and_context?.knowledge_bases || [];

  const confidencePct = Math.round((surface.confidence_score || agent.confidence_score || 0) * 100);
  const stateModifyingTools = tools.filter((t: any) => t.risk_flags?.can_modify_state).length;
  const phiKbs = kbs.filter((k: any) => k.sensitivity === "phi").length;

  const providerLabel = agent.provider || agent.cloud_provider || "Agent";
  const hasPHI = phiKbs > 0 || tools.some((t: any) => t.risk_flags?.can_access_phi);
  const hasPII = tools.some((t: any) => t.risk_flags?.can_access_pii);
  const blastRadius = (stateModifyingTools > 0 || hasPHI) ? "HIGH" : (tools.length > 0) ? "MEDIUM" : "LOW";
  
  let blastBadgeClass = "bg-green/10 text-green border-green/20";
  let blastDotClass = "bg-green/100";
  if (blastRadius === "HIGH") {
    blastBadgeClass = "bg-red/10 text-red border-red/20";
    blastDotClass = "bg-red/100";
  } else if (blastRadius === "MEDIUM") {
    blastBadgeClass = "bg-amber/10 text-amber border-amber/20";
    blastDotClass = "bg-amber/100";
  }

  const renderTopology = () => {
    // Dynamic generation of SVG topology based on tools and KBs
    const ySpacing = 90;
    const allNodes = [
      ...tools.map((t: any) => ({ type: 'tool', name: t.name, desc: t.description, isDanger: t.risk_flags?.can_modify_state, res: "Action Tool Execution Privilege" })),
      ...kbs.map((k: any) => ({ type: 'kb', name: k.name, desc: "Knowledge Base", isDanger: false, res: `Object Storage / Vector DB (${k.sensitivity})` }))
    ];
    
    const svgHeight = Math.max(340, allNodes.length * ySpacing + 120);
    
    return (
      <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-xl p-5 shadow-glass relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-glass-border pb-3 mb-4">
            <div>
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <i className="fa-solid fa-network-wired text-brand"></i> Node Topology & Execution Graph
                </h2>
                <p className="text-xs text-text-secondary">Click any component node to inspect downstream blast radius and security boundaries.</p>
            </div>
            <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red/10 text-red border border-red/20 rounded-md">
                    <span className="w-2 h-2 rounded-full bg-red"></span> State Modifying
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber/10 text-amber border border-amber/20 rounded-md">
                    <span className="w-2 h-2 rounded-full bg-amber/100"></span> PHI Access
                </span>
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 bg-slate-50/50 rounded-xl border border-glass-border p-2 relative flex items-start justify-center min-h-[380px] max-h-[600px] overflow-auto custom-scrollbar">
            <svg viewBox={`0 0 750 ${svgHeight}`} className="w-full min-w-[650px]" style={{ height: `${svgHeight}px` }}>
                <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
                    </marker>
                    <marker id="arrow-danger" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444"/>
                    </marker>
                    <marker id="arrow-kb" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
                    </marker>
                </defs>

                {/* Base Connection Lines */}
                <line x1="80" y1="170" x2="220" y2="170" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5" className="node-path" markerEnd="url(#arrow)"/>
                
                {/* Dynamically draw lines to tools/kbs */}
                {allNodes.map((n: any, i: number) => {
                  const y = 80 + (i * ySpacing);
                  const isDanger = n.isDanger;
                  const isKb = n.type === 'kb';
                  return (
                    <React.Fragment key={`line-${i}`}>
                      <line x1="220" y1="170" x2="380" y2={y} stroke={isKb ? "#38bdf8" : (isDanger ? "#ef4444" : "#f59e0b")} strokeWidth="2" strokeDasharray="5" className="node-path" markerEnd={isKb ? "url(#arrow-kb)" : (isDanger ? "url(#arrow-danger)" : "url(#arrow)")}/>
                      <line x1="380" y1={y} x2="540" y2={y} stroke={isKb ? "#38bdf8" : (isDanger ? "#ef4444" : "#f59e0b")} strokeWidth="2" strokeDasharray="5" className="node-path" markerEnd={isKb ? "url(#arrow-kb)" : (isDanger ? "url(#arrow-danger)" : "url(#arrow)")}/>
                      <line x1="540" y1={y} x2="680" y2={y} stroke={isKb ? "#38bdf8" : (isDanger ? "#ef4444" : "#f59e0b")} strokeWidth="2" strokeDasharray="5" className="node-path" markerEnd={isKb ? "url(#arrow-kb)" : (isDanger ? "url(#arrow-danger)" : "url(#arrow)")}/>
                    </React.Fragment>
                  );
                })}

                {/* Agent Node */}
                <g className="node-circle cursor-pointer" onClick={() => setSelectedNode({ title: agent.name, desc: `${providerLabel} Orchestrator`, res: deep.agentArn, impact: "Central orchestrator capable of invoking mapped tools and KBs based on system prompt." })}>
                    <circle cx="220" cy="170" r="28" fill="#ffffff" stroke="#a855f7" strokeWidth="2"/>
                    <text x="220" y="175" textAnchor="middle" fill="#a855f7" fontSize="18" className="fa">&#xf5dc;</text>
                    <text x="220" y="215" textAnchor="middle" fill="#a855f7" fontSize="11" fontWeight="bold">{providerLabel} Agent</text>
                </g>

                {/* User Ingress */}
                <g className="node-circle">
                    <circle cx="80" cy="170" r="24" fill="#ffffff" stroke="#38bdf8" strokeWidth="2"/>
                    <text x="80" y="174" textAnchor="middle" fill="#38bdf8" fontSize="16" className="fa">&#xf007;</text>
                    <text x="80" y="210" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="bold">User / Ingress</text>
                </g>

                {/* Tools & KBs */}
                {allNodes.map((n: any, i: number) => {
                  const y = 80 + (i * ySpacing);
                  const isDanger = n.isDanger;
                  const isKb = n.type === 'kb';
                  return (
                    <g key={`node-${i}`} className="node-circle cursor-pointer" onClick={() => setSelectedNode({ title: n.name, desc: n.desc, res: n.res, impact: isDanger ? "State modification permitted." : "Read-only access." })}>
                        <circle cx="380" cy={y} r="22" fill={isDanger ? "#450a0a" : "#1e293b"} stroke={isKb ? "#38bdf8" : (isDanger ? "#ef4444" : "#f59e0b")} strokeWidth={isDanger || isKb ? "2.5" : "2"}/>
                        <text x="380" y={y+4} textAnchor="middle" fill={isKb ? "#38bdf8" : (isDanger ? "#ef4444" : "#f59e0b")} fontSize="14" className="fa">{isKb ? "\uf1c0" : (isDanger ? "\uf0e7" : "\uf002")}</text>
                        <text x="380" y={y+38} textAnchor="middle" fill={isKb ? "#93c5fd" : (isDanger ? "#fca5a5" : "#fcd34d")} fontSize="10" fontWeight="bold">{(n.name || "Unknown").substring(0, 15)}</text>
                        
                        {!isKb ? (
                          <>
                            {/* Lambda */}
                            <rect x="518" y={y-20} width="44" height="40" rx="8" fill={isDanger ? "#450a0a" : "#1e293b"} stroke={isDanger ? "#ef4444" : "#f59e0b"} strokeWidth="2"/>
                            <text x="540" y={y+5} textAnchor="middle" fill={isDanger ? "#ef4444" : "#f59e0b"} fontSize="14" className="fa">&#xf126;</text>
                            <text x="540" y={y+38} textAnchor="middle" fill="#64748b" fontSize="10">Compute Handler</text>

                            {/* DB */}
                            <circle cx="680" cy={y} r="24" fill={isDanger ? "#450a0a" : "#1e293b"} stroke={isDanger ? "#ef4444" : "#f59e0b"} strokeWidth="2.5"/>
                            <text x="680" y={y+5} textAnchor="middle" fill={isDanger ? "#ef4444" : "#f59e0b"} fontSize="16" className="fa">&#xf1c0;</text>
                            <text x="680" y={y+40} textAnchor="middle" fill={isDanger ? "#fca5a5" : "#fcd34d"} fontSize="10" fontWeight="bold">Data Store</text>
                          </>
                        ) : (
                          <>
                            {/* DB directly for KB */}
                            <circle cx="540" cy={y} r="24" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5"/>
                            <text x="540" y={y+5} textAnchor="middle" fill="#38bdf8" fontSize="16" className="fa">&#xf1c0;</text>
                            <text x="540" y={y+38} textAnchor="middle" fill="#64748b" fontSize="10">Vector DB</text>

                            <circle cx="680" cy={y} r="24" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5"/>
                            <text x="680" y={y+5} textAnchor="middle" fill="#38bdf8" fontSize="16" className="fa">&#xf07b;</text>
                            <text x="680" y={y+40} textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="bold">Object Storage</text>
                          </>
                        )}
                    </g>
                  );
                })}
            </svg>
          </div>

          <div className="bg-white border border-glass-border rounded-xl p-4 space-y-3">
              <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider flex items-center justify-between border-b border-glass-border pb-2">
                  <span>Selected Node Telemetry</span>
              </div>
              <div>
                  <div className="text-[11px] text-text-secondary">Component Identifier</div>
                  <div className="text-sm font-bold text-text-primary font-mono">{selectedNode?.title || "Select a node"}</div>
              </div>
              <div>
                  <div className="text-[11px] text-text-secondary">Role & Function</div>
                  <div className="text-xs text-slate-700 mt-0.5">{selectedNode?.desc || "-"}</div>
              </div>
              <div>
                  <div className="text-[11px] text-text-secondary">Resource Target / Privilege</div>
                  <div className="text-xs font-mono text-brand mt-0.5">{selectedNode?.res || "-"}</div>
              </div>
              <div className="p-3 bg-red/10 border border-red/20 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-red-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-triangle-exclamation"></i> Security Impact
                  </div>
                  <div className="text-slate-700 text-[11px]">{selectedNode?.impact || "-"}</div>
              </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#fafafa] text-text-primary font-sans antialiased h-full overflow-y-auto flex flex-col custom-scrollbar">
      
      {/* Ambient Glowing Light Effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-sky-500/10 via-purple-500/5 to-transparent pointer-events-none z-0 blur-3xl"></div>

      <header className="border-b border-glass-border bg-white/75 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-3.5">
                  <button onClick={() => navigate(-1)} className="p-2 text-text-secondary hover:text-text-primary transition mr-2">
                      <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <div className="p-2.5 bg-brand/10 border border-brand/30 rounded-xl text-brand shadow-lg shadow-sky-500/10">
                      <i className="fa-solid fa-shield-cat text-xl"></i>
                  </div>
                  <div>
                      <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">{agent.provider || agent.cloud_provider || "Unknown Provider"}</span>
                          <span className="text-xs text-text-secondary font-mono">{agent.region || "Unknown"}</span>
                      </div>
                      <h1 className="text-lg font-extrabold text-text-primary leading-none mt-1 tracking-tight flex items-center gap-2">
                          {agent.name} <span className="text-xs font-mono font-normal text-text-secondary">(AI Agent)</span>
                      </h1>
                  </div>
              </div>

              <div className="flex items-center space-x-2.5">
                  <span className={`${blastBadgeClass} text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-2 shadow-sm border`}>
                      <span className={`w-2 h-2 rounded-full ${blastDotClass} animate-ping`}></span> Blast Radius: {blastRadius}
                  </span>
                  {(hasPHI || hasPII) && (
                    <span className="bg-amber/10 text-amber border border-amber/20 text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 hidden md:flex">
                        <i className="fa-solid fa-notes-medical text-xs"></i> Reach: {hasPHI && hasPII ? "PHI / PII" : hasPHI ? "PHI" : "PII"}
                    </span>
                  )}
                  {deep.guardrails?.present && (
                    <span className="bg-green/10 text-green border border-green/20 text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 hidden sm:flex">
                        <i className="fa-solid fa-circle-check text-xs"></i> Guardrail Active
                    </span>
                  )}
              </div>
          </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
          {/* Resource Meta Header Panel */}
          <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2 space-y-1.5">
                      <div className="text-[11px] text-text-secondary uppercase tracking-wider font-semibold">Resource ARN</div>
                      <div className="flex items-center space-x-2 bg-slate-50/80 border border-glass-border rounded-lg p-2 text-xs font-mono text-slate-700">
                          <span className="truncate flex-grow">{deep.agentArn || agent.fingerprint}</span>
                          <button onClick={() => copyToClipboard(deep.agentArn || agent.fingerprint)} className="text-text-secondary hover:text-brand transition p-1" title="Copy ARN">
                              <i className="fa-regular fa-copy"></i>
                          </button>
                      </div>
                  </div>
                  <div>
                      <div className="text-[11px] text-text-secondary uppercase tracking-wider font-semibold">Foundation Model</div>
                      <div className="text-sm font-semibold text-text-primary mt-1.5 flex items-center gap-2">
                          <i className="fa-solid fa-brain text-purple-400"></i> {agent.model || deep.foundationModel || "Unknown"}
                      </div>
                      <div className="text-[11px] text-text-secondary font-mono mt-0.5">{deep.agentVersion || "DRAFT"}</div>
                  </div>
                  <div>
                      <div className="text-[11px] text-text-secondary uppercase tracking-wider font-semibold">Owner & Environment</div>
                      <div className="text-sm font-semibold text-text-primary mt-1.5 flex items-center gap-2">
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md text-xs font-mono">{surface.ownership?.owner || "unassigned"}</span>
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5 font-mono">Account: {surface.platform?.account_id || "Unknown"}</div>
                  </div>
              </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 min-[1300px]:grid-cols-6 gap-3.5">
              <div className="bg-white border border-glass-border rounded-xl p-3.5 shadow-md min-w-0">
                  <div className="text-text-secondary text-xs font-medium truncate">Confidence Score</div>
                  <div className="text-2xl font-bold text-brand mt-1 truncate">{confidencePct}%</div>
                  <div className="text-[10px] text-text-secondary mt-0.5 truncate">Discovery Accuracy</div>
              </div>
              <div className="bg-white border border-glass-border rounded-xl p-3.5 shadow-md min-w-0">
                  <div className="text-text-secondary text-xs font-medium truncate">Deployment</div>
                  <div className="text-xl font-bold text-green mt-1 uppercase truncate" title={deep.deploymentStatus || agent.status || "Unknown"}>{deep.deploymentStatus || agent.status || "Unknown"}</div>
                  <div className="text-[10px] text-text-secondary mt-0.5 truncate">Lifecycle Status</div>
              </div>
              <div className="bg-white border border-glass-border rounded-xl p-3.5 shadow-md min-w-0">
                  <div className="text-text-secondary text-xs font-medium truncate">Runtime Status</div>
                  <div className="text-xl font-bold text-amber mt-1 capitalize truncate" title={deep.agentRuntimeStatus || "Unknown"}>{deep.agentRuntimeStatus || "Unknown"}</div>
                  <div className="text-[10px] text-text-secondary mt-0.5 truncate">Lifecycle Only</div>
              </div>
              <div className="bg-white border border-glass-border rounded-xl p-3.5 shadow-md min-w-0">
                  <div className="text-text-secondary text-xs font-medium truncate">Action Tools</div>
                  <div className="text-2xl font-bold text-text-primary mt-1 truncate">{tools.length} Active</div>
                  <div className="text-[10px] text-red mt-0.5 font-semibold truncate">{stateModifyingTools} State Modifying</div>
              </div>
              <div className="bg-white border border-glass-border rounded-xl p-3.5 shadow-md min-w-0">
                  <div className="text-text-secondary text-xs font-medium truncate">Knowledge Bases</div>
                  <div className="text-2xl font-bold text-text-primary mt-1 truncate">{kbs.length} Attached</div>
                  <div className="text-[10px] text-red mt-0.5 font-semibold truncate">{phiKbs} Contain PHI</div>
              </div>
              <div className="bg-white border border-glass-border rounded-xl p-3.5 shadow-md min-w-0">
                  <div className="text-text-secondary text-xs font-medium truncate">Session TTL</div>
                  <div className="text-2xl font-bold text-purple-400 mt-1 truncate">{deep.idleSessionTTLInSeconds || "N/A"}s</div>
                  <div className="text-[10px] text-text-secondary mt-0.5 truncate">Inactivity TTL</div>
              </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-glass-border flex space-x-2 sm:space-x-4 text-xs sm:text-sm font-semibold overflow-x-auto custom-scrollbar">
              <button onClick={() => setActiveTab('analytics')} className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'analytics' ? 'border-sky-600 text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i className="fa-solid fa-chart-pie"></i> Visual Telemetry & Radar
              </button>
              <button onClick={() => setActiveTab('topology')} className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'topology' ? 'border-sky-600 text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i className="fa-solid fa-circle-nodes"></i> Blast Radius & Attack Topology
              </button>
              <button onClick={() => setActiveTab('threats')} className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'threats' ? 'border-sky-600 text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i className="fa-solid fa-triangle-exclamation"></i> Threat Vectors & IAM Posture
              </button>
              <button onClick={() => setActiveTab('tools')} className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'tools' ? 'border-sky-600 text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i className="fa-solid fa-wrench"></i> Tool Surface & Risk ({tools.length})
              </button>
              <button onClick={() => setActiveTab('kb')} className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'kb' ? 'border-sky-600 text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i className="fa-solid fa-database"></i> Knowledge Bases ({kbs.length})
              </button>
              <button onClick={() => setActiveTab('raw')} className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'raw' ? 'border-sky-600 text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                  <i className="fa-solid fa-code"></i> Instructions & Raw Payload
              </button>
          </div>

          <div id="tab-contents">
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white border border-glass-border rounded-xl p-5 space-y-3 shadow-lg">
                            <div className="flex items-center justify-between border-b border-glass-border pb-2">
                                <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                    <i className="fa-solid fa-pie-chart text-amber"></i> Data Access Sensitivity
                                </h3>
                                {(hasPHI || hasPII) && (
                                  <span className="text-[10px] uppercase font-bold text-amber border border-amber/20 px-2 py-0.5 rounded">
                                    {hasPHI && hasPII ? "PHI / PII Reach" : hasPHI ? "PHI Reach" : "PII Reach"}
                                  </span>
                                )}
                            </div>
                            <div className="h-48 relative"><canvas ref={dataSensitivityChartRef}></canvas></div>
                            <div className="text-center pt-2">
                                <div className="flex flex-wrap justify-center gap-3 text-[10px] text-text-secondary font-bold mb-2">
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red/100 rounded-sm"></span> PHI (Health Records)</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber/100 rounded-sm"></span> PII (Identifiers)</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-sky-400 rounded-sm"></span> Public / Policy Knowledge</div>
                                </div>
                                <div className="text-[10px] text-text-secondary">Breakdown of sensitive data domains accessed across tools and KBs.</div>
                            </div>
                        </div>
                        <div className="bg-white border border-glass-border rounded-xl p-5 space-y-3 shadow-lg">
                            <div className="flex items-center justify-between border-b border-glass-border pb-2">
                                <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                    <i className="fa-solid fa-chart-pie text-red"></i> Tool Capabilities & Risk
                                </h3>
                                <span className="text-[10px] uppercase font-bold text-red bg-red/10 border border-rose-500/20 px-2 py-0.5 rounded">{stateModifyingTools} State Change</span>
                            </div>
                            <div className="h-48 relative"><canvas ref={toolRiskDoughnutRef}></canvas></div>
                            <div className="text-center pt-2">
                                <div className="flex flex-wrap justify-center gap-3 text-[10px] text-text-secondary font-bold mb-2">
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red/100 rounded-sm"></span> State Modifying</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-sky-400 rounded-sm"></span> Read-Only</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-purple-500 rounded-sm"></span> KB Search</div>
                                </div>
                                <div className="text-[10px] text-text-secondary">{stateModifyingTools} tool allows state modification; {phiKbs + tools.filter((t: any) => t.risk_flags?.can_access_phi || t.risk_flags?.can_access_pii).length} access PHI/PII data.</div>
                            </div>
                        </div>
                        <div className="bg-white border border-glass-border rounded-xl p-5 space-y-3 shadow-lg">
                            <div className="flex items-center justify-between border-b border-glass-border pb-2">
                                <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                    <i className="fa-solid fa-gauge-simple-high text-brand"></i> Discovery Confidence Score
                                </h3>
                                <span className="text-[10px] uppercase font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                                  {confidencePct}% {confidencePct >= 80 ? "High" : confidencePct >= 50 ? "Medium" : "Low"}
                                </span>
                            </div>
                            <div className="h-48 relative flex items-center justify-center">
                                <canvas ref={confidenceScoreChartRef}></canvas>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                  <span className="text-2xl font-bold">{confidencePct}%</span>
                                </div>
                            </div>
                            <div className="text-center pt-2">
                                <div className="text-[10px] text-text-secondary mt-2">Confidence based on deep cloud API scan & metadata verification.</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white border border-glass-border rounded-xl p-5 space-y-3 shadow-lg">
                            <div className="border-b border-glass-border pb-2 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                    <i className="fa-solid fa-spider text-brand"></i> Multi-Axis Security Posture Evaluation
                                </h3>
                            </div>
                            <div className="h-60 relative"><canvas ref={radarPostureChartRef}></canvas></div>
                            <div className="text-center pt-2">
                                <div className="flex justify-center gap-6 text-[10px] text-text-secondary font-bold">
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-rose-500 bg-red/100/20"></span> Current Score</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-glass-border rounded-xl p-5 space-y-4 shadow-lg">
                            <h3 className="text-xs font-bold text-text-primary border-b border-glass-border pb-2">Defense Posture Status</h3>
                            <div className="h-56 relative"><canvas ref={defenseControlsChartRef}></canvas></div>
                        </div>
                    </div>
                </div>
              )}

              {activeTab === 'topology' && (
                <div className="space-y-6">
                  {renderTopology()}
                  {/* Toxic matrix table */}
                  <div className="bg-white border border-glass-border rounded-xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-glass-border pb-3">
                          <div>
                              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                  <i className="fa-solid fa-border-all text-red"></i> Toxic Combinations Risk Matrix
                              </h2>
                          </div>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                  <tr className="border-b border-glass-border text-text-secondary font-mono uppercase bg-slate-50/50">
                                      <th className="p-3">Action Tool / Resource</th>
                                      <th className="p-3 text-center">State Mutation</th>
                                      <th className="p-3 text-center">PHI Access</th>
                                      <th className="p-3 text-center">PII Access</th>
                                      <th className="p-3 text-center">Compounded Risk</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {tools.map((t: any, i: number) => {
                                  const isToxic = t.risk_flags?.can_modify_state && (t.risk_flags?.can_access_phi || t.risk_flags?.can_access_pii);
                                  return (
                                    <tr key={i} className={isToxic ? "bg-red-500/5 hover:bg-red/10" : "hover:bg-slate-50/50"}>
                                      <td className="p-3 font-mono font-bold text-text-primary"><i className="fa-solid fa-bolt text-red mr-2"></i> {t.name}</td>
                                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded font-mono ${t.risk_flags?.can_modify_state ? "bg-red/10 text-red" : "bg-slate-100 border border-glass-border-dim text-text-secondary"}`}>{t.risk_flags?.can_modify_state ? "YES" : "NO"}</span></td>
                                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded font-mono ${t.risk_flags?.can_access_phi ? "bg-amber/20 text-amber" : "bg-slate-100 border border-glass-border-dim text-text-secondary"}`}>{t.risk_flags?.can_access_phi ? "YES" : "NO"}</span></td>
                                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded font-mono ${t.risk_flags?.can_access_pii ? "bg-amber/20 text-amber" : "bg-slate-100 border border-glass-border-dim text-text-secondary"}`}>{t.risk_flags?.can_access_pii ? "YES" : "NO"}</span></td>
                                      <td className="p-3 text-center">
                                        {isToxic ? (
                                          <span className="px-2.5 py-1 bg-red-600 text-text-primary font-bold rounded shadow animate-pulse">CRITICAL</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-brand/100/20 text-brand border border-brand/30 font-bold rounded">STANDARD</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {tools.length === 0 && (
                                  <tr><td colSpan={5} className="p-4 text-center text-text-secondary">No tools detected.</td></tr>
                                )}
                              </tbody>
                          </table>
                      </div>
                  </div>
                </div>
              )}

              {activeTab === 'threats' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Threats */}
                  <div className="lg:col-span-2 bg-white border border-glass-border rounded-xl p-5 shadow-lg">
                      <h2 className="text-md font-bold text-text-primary flex items-center gap-2 border-b border-glass-border pb-3 mb-4">
                          <i className="fa-solid fa-triangle-exclamation text-rose-500"></i> Adversarial Surface & Threat Vectors
                      </h2>
                      <div className="space-y-3">
                          {stateModifyingTools > 0 && (
                            <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4 flex gap-4">
                                <div className="p-2 bg-red/10 rounded border border-rose-500/20 text-red h-fit">
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-rose-300">State Modification Capability Detected</div>
                                    <div className="text-xs text-text-secondary mt-1">
                                      The agent can invoke {stateModifyingTools} state-changing tools. Prompt injection risks must be mitigated to prevent unverified alterations.
                                    </div>
                                </div>
                            </div>
                          )}
                          {(hasPHI || hasPII) && (
                            <div className="bg-amber-500/5 border border-amber/20 rounded-lg p-4 flex gap-4">
                                <div className="p-2 bg-amber/10 rounded border border-amber/20 text-amber h-fit">
                                    <i className="fa-solid fa-file-medical"></i>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-amber-300">PHI and PII Data Exposure</div>
                                    <div className="text-xs text-text-secondary mt-1">
                                      Data stores and tools expose protected health or personal information to model responses. Output redactions rely on active guardrail rules.
                                    </div>
                                </div>
                            </div>
                          )}
                          <div className="bg-sky-500/5 border border-brand/20 rounded-lg p-4 flex gap-4">
                              <div className="p-2 bg-brand/10 rounded border border-brand/20 text-brand h-fit">
                                  <i className="fa-solid fa-sitemap"></i>
                              </div>
                              <div>
                                  <div className="text-sm font-bold text-sky-300">Request-Driven Architecture</div>
                                  <div className="text-xs text-text-secondary mt-1">
                                    This agent is request-driven; status reflects lifecycle deployment state rather than an active continuously running server daemon.
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Identity */}
                  <div className="bg-white border border-glass-border rounded-xl p-5 shadow-lg">
                      <h2 className="text-md font-bold text-text-primary flex items-center gap-2 border-b border-glass-border pb-3 mb-5">
                          <i className="fa-solid fa-key text-brand"></i> Identity & IAM Role
                      </h2>
                      <div className="space-y-4">
                          <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Role Name</div>
                              <div className="text-sm font-mono font-bold text-text-primary">
                                {surface.identity_and_access?.name || deep.agentResourceRoleArn?.split('/').pop() || "Unknown"}
                              </div>
                          </div>
                          <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Identity Type</div>
                              <div className="text-xs text-slate-700">{surface.identity_and_access?.identity_type || "Unknown"}</div>
                          </div>
                          <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Role ARN</div>
                              <div className="text-[11px] font-mono text-text-secondary bg-slate-50 border border-glass-border p-2 rounded break-all">
                                {surface.identity_and_access?.arn || deep.agentResourceRoleArn || "-"}
                              </div>
                          </div>
                          <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Encryption Key Status</div>
                              {deep.customerEncryptionKeyArn ? (
                                <div className="text-xs font-bold text-green flex items-center gap-1.5">
                                    <i className="fa-solid fa-lock"></i> Customer Managed Key Active
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-amber flex items-center gap-1.5">
                                    <i className="fa-solid fa-unlock-keyhole"></i> Platform Managed Key (Default)
                                </div>
                              )}
                          </div>
                      </div>
                  </div>
                </div>
              )}

              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <div className="bg-white border border-glass-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="relative w-full md:w-80">
                          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"></i>
                          <input
                            type="text"
                            value={toolSearch}
                            onChange={(e) => setToolSearch(e.target.value)}
                            placeholder="Search tools or Lambda handlers..."
                            className="w-full bg-slate-50 border border-glass-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder-slate-500 focus:outline-none focus:border-brand transition"
                          />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs w-full md:w-auto">
                          <button onClick={() => setToolFilter("all")} className={`px-3 py-1.5 rounded-lg font-bold transition border border-slate-200 ${toolFilter === "all" ? "bg-sky-500 text-text-primary" : "bg-slate-100 border-glass-border-dim text-slate-700 hover:bg-slate-700"}`}>All ({tools.length})</button>
                          <button onClick={() => setToolFilter("modifying")} className={`px-3 py-1.5 rounded-lg font-bold transition border border-slate-200 ${toolFilter === "modifying" ? "bg-sky-500 text-text-primary" : "bg-slate-100 border-glass-border-dim text-slate-700 hover:bg-slate-700"}`}>State Modifying ({stateModifyingTools})</button>
                          <button onClick={() => setToolFilter("readonly")} className={`px-3 py-1.5 rounded-lg font-bold transition border border-slate-200 ${toolFilter === "readonly" ? "bg-sky-500 text-text-primary" : "bg-slate-100 border-glass-border-dim text-slate-700 hover:bg-slate-700"}`}>Read Only ({tools.length - stateModifyingTools})</button>
                      </div>
                  </div>

                  <div className="space-y-4">
                    {tools
                      .filter((t: any) => {
                        if (toolFilter === "modifying" && !t.risk_flags?.can_modify_state) return false;
                        if (toolFilter === "readonly" && t.risk_flags?.can_modify_state) return false;
                        if (toolSearch && !(t.name || "").toLowerCase().includes(toolSearch.toLowerCase()) && !(t.description || "").toLowerCase().includes(toolSearch.toLowerCase())) return false;
                        return true;
                      })
                      .map((t: any, i: number) => {
                      const isDanger = t.risk_flags?.can_modify_state;
                      const hasPhiPii = t.risk_flags?.can_access_phi || t.risk_flags?.can_access_pii;

                      return (
                        <div key={i} className="bg-white border border-glass-border rounded-xl p-5 shadow-lg flex gap-4">
                            <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${isDanger ? 'bg-red/10 border-rose-500/20 text-red' : 'bg-brand/10 border-brand/20 text-brand'}`}>
                                <i className={`fa-solid ${isDanger ? 'fa-bolt' : 'fa-magnifying-glass'}`}></i>
                            </div>
                            <div className="flex-grow space-y-4 min-w-0">
                                <div className="flex flex-col md:flex-row items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-sm font-bold font-mono text-text-primary truncate">{t.name}</h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {isDanger ? (
                                                  <span className="text-[9px] font-mono font-bold bg-red/10 text-red border border-rose-500/20 px-2 py-0.5 rounded">CAN MODIFY STATE</span>
                                                ) : (
                                                  <span className="text-[9px] font-mono font-bold bg-slate-100 border border-glass-border-dim text-slate-700 border border-slate-200 px-2 py-0.5 rounded">READ ONLY</span>
                                                )}
                                                {hasPhiPii && (
                                                  <span className="text-[9px] font-mono font-bold bg-amber/10 text-amber border border-amber/20 px-2 py-0.5 rounded">PHI/PII ACCESS</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-text-secondary mt-1.5">{t.description}</div>
                                    </div>
                                    <div className="text-[10px] font-mono text-text-muted whitespace-nowrap">Source: {t.source || "unknown_source"}</div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <div className="text-[9px] uppercase tracking-wider font-bold text-text-muted">{isDanger ? "Invocation Target / Permission" : "Permission Action"}</div>
                                        <div className="bg-slate-50 border border-glass-border rounded-lg p-2.5 text-xs font-mono text-slate-700 break-all h-full">
                                            {t.permissions?.[0] || t.arn || "invoke:arn:aws:lambda:...:function:..."}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="text-[9px] uppercase tracking-wider font-bold text-text-muted">Parameters Schema</div>
                                        <div className="bg-slate-50 border border-glass-border rounded-lg p-2.5 text-xs font-mono text-slate-700 h-full overflow-x-auto">
                                            {t.parameters_schema ? (
                                              <pre className="whitespace-pre-wrap">{JSON.stringify(t.parameters_schema, null, 2)}</pre>
                                            ) : (
                                              <span className="text-slate-600 italic">No schema defined</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                      );
                    })}
                    {tools.length === 0 && (
                      <div className="bg-white border border-glass-border rounded-xl p-8 text-center text-text-secondary">
                        No action group tools found for this agent.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'kb' && (
                <div className="bg-white border border-glass-border rounded-xl p-5 space-y-4 shadow-lg">
                  <h2 className="text-md font-bold text-text-primary mb-4"><i className="fa-solid fa-database text-brand mr-2"></i> Knowledge Bases</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {kbs.map((k: any, i: number) => (
                      <div key={i} className="bg-slate-50 border border-glass-border rounded-lg p-4">
                        <div className="font-bold text-amber mb-2">{k.name}</div>
                        <div className="text-xs text-text-secondary mb-2">Sensitivity: <span className="font-mono text-text-primary">{k.sensitivity}</span></div>
                      </div>
                    ))}
                    {kbs.length === 0 && <div className="text-text-secondary text-sm">No knowledge bases attached.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="space-y-6">
                  <div className="bg-white border border-glass-border rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between border-b border-glass-border pb-3 mb-4">
                      <div>
                        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                          <span className="text-brand font-mono">&gt;_</span> System Instruction Capture Preview
                        </h2>
                        <div className="text-xs text-text-secondary mt-1.5 font-mono">Captured via bedrock_get_agent (Length: {String(agent.agent_config?.instruction || agent.metadata?.instructionPreview || deep.instructionPreview || deep.instruction || "").length} characters)</div>
                      </div>
                      <button onClick={() => copyToClipboard(agent.agent_config?.instruction || agent.metadata?.instructionPreview || deep.instructionPreview || deep.instruction || "")} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-glass-border-dim border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                        <i className="fa-regular fa-copy"></i> Copy Instruction
                      </button>
                    </div>
                    <div className="bg-slate-50 border border-glass-border rounded-lg p-5">
                      <p className="font-mono text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {agent.agent_config?.instruction || agent.metadata?.instructionPreview || deep.instructionPreview || deep.instruction ? `"${agent.agent_config?.instruction || agent.metadata?.instructionPreview || deep.instructionPreview || deep.instruction}"` : <span className="text-text-secondary italic">No system instructions detected</span>}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-glass-border rounded-xl p-5 shadow-lg">
                    <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-code text-brand"></i> Raw Agent JSON
                    </h2>
                    <pre className="bg-slate-50 border border-glass-border p-4 rounded-lg overflow-x-auto text-[11px] text-slate-700 custom-scrollbar max-h-[600px] overflow-y-auto">
                      {JSON.stringify(agent, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

          </div>
      </main>
    </div>
  );
}
