import { ShieldAlert, AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { DashboardData } from "../../../types/dashboard";

interface ActiveAlertsProps {
  alerts: DashboardData["alerts"];
}

export default function ActiveAlerts({ alerts }: ActiveAlertsProps) {
  return (
    <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r16 shadow-glass p-5 flex flex-col h-[350px] ">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="font-semibold text-text-primary text-[13px]">
          Active Alerts
        </div>
        {alerts.length > 0 && (
          <span className="bg-red-bg text-red border border-red-border px-2 py-0.5 rounded-full text-[10px] font-bold">
            {alerts.length} ALERTS
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-[12px]">
            No active alerts — governance posture is healthy
          </div>
        ) : (
          alerts.map((al, i) => {
            const colors = {
              critical: {
                bg: "bg-red-bg",
                border: "border-red-border",
                text: "text-red",
                icon: <ShieldAlert size={16} className="text-red" />,
              },
              high: {
                bg: "bg-amber-bg",
                border: "border-amber-border",
                text: "text-amber",
                icon: <AlertTriangle size={16} className="text-amber" />,
              },
              medium: {
                bg: "bg-brand-bg",
                border: "border-brand-border",
                text: "text-brand",
                icon: <AlertCircle size={16} className="text-brand" />,
              },
              low: {
                bg: "bg-green-bg",
                border: "border-green-border",
                text: "text-green",
                icon: <Info size={16} className="text-green" />,
              },
            }[al.sev];

            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-r8 border border-l-4 ${colors.bg} ${colors.border} border-l-${al.sev === "critical" ? "red" : al.sev === "high" ? "amber" : "brand"}`}
              >
                <div className="mt-0.5">{colors.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">
                    {al.title.includes(": ") ? (
                      <>
                        <span className={`font-bold ${colors.text}`}>
                          {al.title.substring(0, al.title.indexOf(": ") + 2)}
                        </span>
                        <span className="font-semibold text-text-primary">
                          {al.title.substring(al.title.indexOf(": ") + 2)}
                        </span>
                      </>
                    ) : (
                      <span className={`font-bold ${colors.text}`}>
                        {al.title}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5">
                    {al.detail}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
