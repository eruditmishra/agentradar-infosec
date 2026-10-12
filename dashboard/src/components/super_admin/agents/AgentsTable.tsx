import { ArrowDown, ArrowUp, MoreVertical, Edit2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { DiscoveredAgent } from "../../../types/discovery";
import { formatStatus } from "../../../pages/super-admin/DiscoveredModels";
import { getAgentStatusStyle } from "../../../lib/agentStatus";

const PROVIDER_LABELS: Record<string, string> = {
  azure_ai_foundry: "Foundry",
  azure_openai: "Azure OpenAI",
  entra_agent_id: "Azure",
  power_platform: "Power Platform",
  microsoft_teams: "Microsoft Teams",
  m365_copilot: "M365 Copilot",
  openai: "OpenAI",
  salesforce: "Salesforce",
  workday: "Workday",
  servicenow: "ServiceNow",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
};

function formatProviderLabel(provider: string | null | undefined) {
  if (!provider) return null;
  return PROVIDER_LABELS[provider] || provider.replace(/_/g, " ");
}

interface AgentsTableProps {
  agents: DiscoveredAgent[];
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
  onOpenUpdateModal?: (agent: DiscoveredAgent) => void;
}

export default function AgentsTable({
  agents,
  sortBy,
  sortOrder,
  onSort,
  onOpenUpdateModal,
}: AgentsTableProps) {
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp size={12} className="ml-1 text-brand inline" />
    ) : (
      <ArrowDown size={12} className="ml-1 text-brand inline" />
    );
  };

  const SortableHeader = ({
    field,
    label,
    align = "left",
  }: {
    field: string;
    label: string;
    align?: "left" | "right";
  }) => (
    <th
      onClick={() => onSort(field)}
      className={`pb-3 px-3 first:pl-0 cursor-pointer hover:text-text-primary transition-colors select-none whitespace-nowrap ${align === "right" ? "text-right pr-4" : "text-left"}`}
    >
      <div
        className={`flex items-center ${align === "right" ? "justify-end" : ""}`}
      >
        {label} <SortIcon field={field} />
      </div>
    </th>
  );

  return (
    <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-t-r16 shadow-glass p-5 flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-glass-border-dim text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <SortableHeader field="name" label="Name" />
              <SortableHeader field="model" label="Model Used" />
              <SortableHeader field="cloud_provider" label="Provider" />
              <SortableHeader field="owner" label="Owner" />
              {/* <SortableHeader field="deployment_type" label="Type" /> */}
              <SortableHeader
                field="risk_score"
                label="Risk Score"
                align="right"
              />
              <SortableHeader field="created_at" label="Discovered At" />
              <SortableHeader field="status" label="Status" />
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-text-primary">
            {agents.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-10 text-text-muted text-[13px]"
                >
                  No agents found matching your criteria
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr
                  key={agent.id}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  className="border-b border-glass-border-dim last:border-0 hover:bg-white/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 first:pl-0 font-semibold">
                    {agent.name || "Unknown Agent"}
                  </td>
                  <td className="py-3 px-3 text-text-secondary text-[12px]">
                    {agent.model || "—"}
                  </td>
                  <td className="py-3 px-3">
                    {agent.provider || agent.cloud_provider ? (
                      <span className="bg-bg-root border border-glass-border-dim px-2 py-0.5 rounded text-[10px] font-semibold text-text-secondary capitalize">
                        {formatProviderLabel(agent.provider) ||
                          agent.cloud_provider}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-3 text-text-secondary text-[12px]">
                    {agent.owner || "—"}
                  </td>
                  {/* <td className="py-3 px-3 text-text-secondary text-[12px] capitalize">
                    {agent.deployment_type || "—"}
                  </td> */}
                  <td className="py-3 px-3 text-right pr-4 font-display">
                    {agent.riskScoreBreakdown ? (
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span
                          className={`text-[13px] font-bold ${
                            agent.riskScoreBreakdown.riskLevel === "Critical"
                              ? "text-red-700"
                              : agent.riskScoreBreakdown.riskLevel === "High"
                                ? "text-orange-700"
                                : agent.riskScoreBreakdown.riskLevel === "Medium"
                                  ? "text-amber-800"
                                  : "text-emerald-800"
                          }`}
                        >
                          {agent.riskScoreBreakdown.finalScore}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border shadow-xs ${
                            agent.riskScoreBreakdown.riskLevel === "Critical"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : agent.riskScoreBreakdown.riskLevel === "High"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : agent.riskScoreBreakdown.riskLevel === "Medium"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {agent.riskScoreBreakdown.riskLevel}
                        </span>
                      </div>
                    ) : agent.risk_score != null ? (
                      <span className="text-[13px] font-bold text-slate-800">
                        {agent.risk_score}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[12px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-text-secondary text-[12px] whitespace-nowrap">
                    {agent.created_at
                      ? new Date(agent.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getAgentStatusStyle(agent.status)}`}
                    >
                      {formatStatus(agent.status)}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-4 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === agent.id ? null : agent.id);
                      }}
                      className="p-1 rounded hover:bg-glass-border-dim transition-colors text-text-secondary hover:text-text-primary"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeDropdown === agent.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(null);
                          }}
                        />
                        <div className="absolute right-8 top-10 w-32 bg-glass-white backdrop-blur-glass border border-glass-border rounded-lg shadow-glass-lg py-1 z-20 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenUpdateModal?.(agent);
                              setActiveDropdown(null);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-text-primary hover:bg-white/50 transition-colors text-left"
                          >
                            <Edit2 size={14} className="text-brand" /> Update
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
