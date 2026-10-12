import { CheckCircle, XCircle, Clock } from "lucide-react";
import type { DashboardData } from "../../../types/dashboard";

interface RecentScansProps {
  scans: DashboardData["recentScans"];
}

export default function RecentScans({ scans }: RecentScansProps) {
  return (
    <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r16 shadow-glass p-5 flex flex-col h-[350px]">
      <div className="font-semibold text-text-primary mb-4 text-[13px] shrink-0">
        Recent Scans
      </div>
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-glass-border-dim text-[11px] font-extrabold text-text-ghost uppercase tracking-wider">
              <th className="pb-3 pl-2">Status</th>
              <th className="pb-3">Time</th>
              <th className="pb-3">Type</th>
              <th className="pb-3">Providers</th>
              <th className="pb-3  pr-2">Agents Found</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-text-primary">
            {scans.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-6 text-text-muted text-[12px]"
                >
                  No recent scans found
                </td>
              </tr>
            ) : (
              scans.map((scan, i) => (
                <tr
                  key={i}
                  className="border-b border-glass-border-dim last:border-0 hover:bg-white/30 transition-colors"
                >
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-2">
                      {scan.status === "completed" ? (
                        <CheckCircle size={14} className="text-green" />
                      ) : scan.status === "failed" ? (
                        <XCircle size={14} className="text-red" />
                      ) : (
                        <Clock size={14} className="text-brand" />
                      )}
                      <span className="text-[12px] font-semibold uppercase text-text-muted">
                        {scan.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-[12px] text-text-muted">
                    {new Date(scan.time).toLocaleString()}
                  </td>
                  <td className="py-3 font-medium">{scan.type}</td>

                  <td className="py-3">
                    <div className="flex gap-1 flex-wrap">
                      {scan.providersScanned.length === 0 ? (
                        <span className="text-[11px] text-text-muted">—</span>
                      ) : (
                        scan.providersScanned.map((p, j) => (
                          <span
                            key={j}
                            className="bg-bg-root border border-glass-border-dim px-2 py-0.5 rounded text-[10px] font-semibold text-text-secondary"
                          >
                            {p}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3  pr-2 font-bold">{scan.agentsFound}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
