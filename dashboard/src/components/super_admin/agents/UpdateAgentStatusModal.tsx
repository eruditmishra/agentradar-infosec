import { X, Shield, ShieldAlert, Clock } from "lucide-react";
import type { DiscoveredAgent } from "../../../types/discovery";
import { useState, useEffect } from "react";
import { usePermission } from "../../../hooks/usePermission";

interface UpdateAgentStatusModalProps {
  isOpen: boolean;
  agent: DiscoveredAgent | null;
  onClose: () => void;
  onUpdate: (
    agentId: string,
    actionType: "request" | "approve" | "reject",
    payload?: string,
    remark?: string
  ) => void;
}

export default function UpdateAgentStatusModal({
  isOpen,
  agent,
  onClose,
  onUpdate,
}: UpdateAgentStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [remark, setRemark] = useState<string>("");

  const canApprove = usePermission("agents", "approve");
  const canUpdate = usePermission("agents", "update");

  useEffect(() => {
    if (agent) {
      setSelectedStatus("");
      setRemark("");
    }
  }, [agent, isOpen]);

  if (!isOpen || !agent) return null;

  const isUnderReview = agent.status === "under_review";
  const isAlreadyApproved = agent.status === "approved" || agent.status === "conditionally_approved";
  const isAlreadyRejected = agent.status === "flagged" || agent.status === "shadow" || agent.status === "conditionally_shadow";

  let statuses: any[] = [];
  
  if (isUnderReview) {
    if (canApprove) {
      statuses = [
        {
          value: "approve_request",
          label: "Approve Request",
          icon: Shield,
          color: "text-green",
          bg: "bg-green/10",
          border: "border-green/20",
          dot: "bg-green",
        },
        {
          value: "reject_request",
          label: "Deny Request",
          icon: ShieldAlert,
          color: "text-amber",
          bg: "bg-amber/10",
          border: "border-amber/20",
          dot: "bg-amber",
        },
      ];
    }
  } else if (canUpdate) {
    if (canApprove) {
      statuses = [
        {
          value: "approve_direct",
          label: "Verify Agent",
          icon: Shield,
          color: "text-green",
          bg: "bg-green/10",
          border: "border-green/20",
          dot: "bg-green",
        },
        {
          value: "reject_direct",
          label: "Move to Shadow",
          icon: ShieldAlert,
          color: "text-amber",
          bg: "bg-amber/10",
          border: "border-amber/20",
          dot: "bg-amber",
        },
      ];
    } else {
      statuses = [];
      if (!isAlreadyApproved) {
        statuses.push({
          value: "request_approve",
          label: "Request to Verify",
          icon: Shield,
          color: "text-green",
          bg: "bg-green/10",
          border: "border-green/20",
          dot: "bg-green",
        });
      }
      if (!isAlreadyRejected) {
        statuses.push({
          value: "request_reject",
          label: "Request to Shadow",
          icon: ShieldAlert,
          color: "text-amber",
          bg: "bg-amber/10",
          border: "border-amber/20",
          dot: "bg-amber",
        });
      }
    }
  }

  const handleSubmit = () => {
    if (!selectedStatus) return;
    if (selectedStatus === "request_approve") {
      onUpdate(agent.id, "request", "conditionally_approved", remark);
    } else if (selectedStatus === "request_reject") {
      onUpdate(agent.id, "request", "conditionally_shadow", remark);
    } else if (selectedStatus === "approve_request") {
      onUpdate(agent.id, "approve", undefined, remark);
    } else if (selectedStatus === "approve_direct") {
      onUpdate(agent.id, "approve", "conditionally_approved", remark);
    } else if (selectedStatus === "reject_request") {
      onUpdate(agent.id, "reject", undefined, remark);
    } else if (selectedStatus === "reject_direct") {
      onUpdate(agent.id, "approve", "conditionally_shadow", remark); // using approve action but with shadow status
    }
    onClose();
  };

  const isSubmitDisabled = !selectedStatus || statuses.length === 0 || (!canApprove && !remark.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative bg-white backdrop-blur-glass border border-glass-border shadow-glass-lg rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">Update Agent Status</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          {isUnderReview && agent.requested_status && canApprove && (
            <div className="mb-5 p-4 bg-white/5 border border-glass-border rounded-xl shadow-glass-sm flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
              <div className="flex items-center gap-2 text-amber pl-1">
                <Clock size={16} />
                <h3 className="text-[13px] font-bold uppercase tracking-wider">
                  Pending Request
                </h3>
              </div>
              <p className="text-[13px] text-text-secondary leading-relaxed pl-1">
                An analyst requested to change the status to{" "}
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-white/10 border border-glass-border-dim text-text-primary shadow-sm capitalize">
                  {agent.requested_status.replace("_", " ")}
                </span>
                .
              </p>
              {agent.request_remark && (
                <div className="mt-2 p-3 bg-white/10 rounded-lg text-[13px] text-text-secondary italic pl-1 border-l-2 border-amber/30">
                  "{agent.request_remark}"
                </div>
              )}
              <p className="text-[12px] text-text-muted pl-1 mt-1">Please submit your decision.</p>
            </div>
          )}
          
          <p className="text-[13px] text-text-secondary mb-2">
            Select an action for{" "}
            <strong className="text-text-primary">
              {agent.agent_config?.name || agent.name || agent.id}
            </strong>
            .
          </p>

          <div className="flex flex-col gap-2 mt-4">
            {statuses.length === 0 ? (
              <div className="p-4 text-center bg-white/30 border border-glass-border rounded-lg">
                <p className="text-[13px] text-text-secondary font-medium">
                  {isUnderReview
                    ? "A status change request is currently pending review."
                    : "No further status changes are available."}
                </p>
              </div>
            ) : (
              statuses.map((s) => {
                const Icon = s.icon;
                const isSelected = selectedStatus === s.value;

                return (
                  <button
                    key={s.value}
                    onClick={() => setSelectedStatus(s.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                      isSelected
                        ? `${s.bg} ${s.border}`
                        : "bg-white/50 border-glass-border hover:bg-white/70"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={16}
                        className={isSelected ? s.color : "text-text-muted"}
                      />
                      <span
                        className={`text-[13px] font-semibold ${isSelected ? "text-text-primary" : "text-text-secondary"}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {isSelected && (
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${s.dot} shadow-sm animate-in zoom-in`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {statuses.length > 0 && selectedStatus && (
            <div className="mt-4">
              <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                Remark {(!canApprove) && <span className="text-red">*</span>}
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={!canApprove ? "Please provide a reason for this request..." : "Add an optional remark for your decision..."}
                className="w-full h-24 bg-white/50 border border-glass-border rounded-lg p-3 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-glass-border-dim">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="px-4 py-2 text-[13px] font-bold bg-brand text-white rounded-lg shadow-sm hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canApprove && isUnderReview
              ? "Submit Decision"
              : canApprove
                ? "Update Status"
                : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
