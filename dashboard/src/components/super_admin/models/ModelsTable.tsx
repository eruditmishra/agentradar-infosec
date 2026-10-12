import { useState } from "react";
import { ArrowDown, ArrowUp, MoreVertical, Edit2 } from "lucide-react";
import type { DiscoveredModel } from "../../../types/discovery";
import { formatStatus } from "../../../pages/super-admin/DiscoveredModels";

interface ModelsTableProps {
  models: DiscoveredModel[];
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
  onOpenUpdateModal: (model: DiscoveredModel) => void;
}

export default function ModelsTable({
  models,
  sortBy,
  sortOrder,
  onSort,
  onOpenUpdateModal,
}: ModelsTableProps) {
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
            <tr className="border-b border-glass-border-dim text-[11px] font-extrabold text-text-ghost uppercase tracking-wider">
              <SortableHeader field="name" label="Model Name" />
              <SortableHeader field="provider" label="Provider" />
              <SortableHeader field="agent_count" label="Number of Agents" />
              <SortableHeader field="risk_level" label="Risk Level" />
              <SortableHeader field="validation_status" label="Status" align="right" />
              <th className="pb-3 text-right pr-4 w-12 select-none text-text-ghost">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-text-primary">
            {models.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10 text-text-muted text-[13px]"
                >
                  No models found matching your criteria
                </td>
              </tr>
            ) : (
              models.map((model) => (
                <tr
                  key={model.id}
                  className="border-b border-glass-border-dim last:border-0 hover:bg-white/30 transition-colors"
                >
                  <td className="py-3 px-3 first:pl-0 font-semibold">
                    {model.display_name || model.name || "Unknown Model"}
                  </td>
                  <td className="py-3 px-3 text-text-secondary text-[12px]">
                    {model.provider ? (
                      <span className="bg-bg-root border border-glass-border-dim px-2 py-0.5 rounded text-[10px] font-semibold text-text-secondary capitalize">
                        {model.provider}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-[12px] text-text-secondary">
                    {model.agent_count}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                        model.risk_level === "critical"
                          ? "bg-red/10 text-red border-red/20"
                          : model.risk_level === "high"
                          ? "bg-orange/10 text-orange border-orange/20"
                          : model.risk_level === "medium"
                          ? "bg-amber/10 text-amber border-amber/20"
                          : model.risk_level === "low"
                          ? "bg-green/10 text-green border-green/20"
                          : "bg-slate-100/10 text-slate-400 border-slate-200/20"
                      }`}
                    >
                      {model.risk_level}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                        model.validation_status === "approved"
                          ? "bg-green/10 text-green border-green/20"
                          : model.validation_status === "flagged" || model.validation_status === "deprecated"
                          ? "bg-red/10 text-red border-red/20"
                          : model.validation_status === "under_review"
                          ? "bg-blue/10 text-blue border-blue/20"
                          : "bg-amber/10 text-amber border-amber/20"
                      }`}
                    >
                      {formatStatus(model.validation_status)}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-4 relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === model.id ? null : model.id)}
                      className="p-1 rounded hover:bg-glass-border-dim transition-colors text-text-secondary hover:text-text-primary"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeDropdown === model.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActiveDropdown(null)}
                        />
                        <div className="absolute right-8 top-10 w-32 bg-glass-white backdrop-blur-glass border border-glass-border rounded-lg shadow-glass-lg py-1 z-20 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => {
                              onOpenUpdateModal(model);
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
