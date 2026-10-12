import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { discoveryAPI } from "../../lib/api";
import type { AgentControlReviewRow, FrameworkMeta } from "../../types/discovery";

const POSTURE_LABEL: Record<AgentControlReviewRow["posture"], { label: string; className: string }> = {
  compliant: { label: "COMPLIANT", className: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  partial: { label: "PARTIAL", className: "bg-amber-50 text-amber-700 border-amber-300" },
  non_compliant: { label: "NON COMPLIANT", className: "bg-red-50 text-red-700 border-red-300" },
  unassessed: { label: "UNASSESSED", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function Assessments() {
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState<FrameworkMeta[]>([]);
  const [activeFramework, setActiveFramework] = useState<string | null>(null);
  const [rows, setRows] = useState<AgentControlReviewRow[]>([]);
  const [loadingFrameworks, setLoadingFrameworks] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingFrameworks(true);
      const res = await discoveryAPI.getFrameworks();
      setFrameworks(res.data.frameworks);
      if (res.data.frameworks.length) setActiveFramework(res.data.frameworks[0].id);
      setLoadingFrameworks(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeFramework) return;
    (async () => {
      setLoadingRows(true);
      const res = await discoveryAPI.getAssessments({ framework: activeFramework });
      setRows(res.data.agents);
      setLoadingRows(false);
    })();
  }, [activeFramework]);

  const activeMeta = useMemo(() => frameworks.find((f) => f.id === activeFramework), [frameworks, activeFramework]);

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="text-blue-500" size={22} />
          Assessments
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Agent control reviews against OWASP AI Agents 2026, NIST AI RMF, and ISO/IEC 42001.
        </p>
      </div>

      {loadingFrameworks ? (
        <div className="flex justify-center items-center p-16 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              onClick={() => setActiveFramework(fw.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                activeFramework === fw.id
                  ? "border-blue-300 bg-blue-50/60 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-bold text-slate-800">{fw.name}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {fw.version} · {fw.controlCount} controls
              </div>
              <div className="text-[11px] text-slate-500 mt-2 leading-snug line-clamp-2">{fw.description}</div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Agent control reviews</h2>
          <span className="text-[11px] text-slate-400 font-semibold">{rows.length} agents</span>
        </div>
        {loadingRows ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-slate-400 font-bold uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2.5 pl-5 pr-4">Agent</th>
                  <th className="py-2.5 pr-4">Posture</th>
                  <th className="py-2.5 pr-4">Score</th>
                  <th className="py-2.5 pr-4">Fail</th>
                  <th className="py-2.5 pr-4">Partial</th>
                  <th className="py-2.5 pr-4">Pass</th>
                  <th className="py-2.5 pr-5">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const posture = POSTURE_LABEL[row.posture];
                  return (
                    <tr
                      key={row.agentId}
                      className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/assessments/${row.agentId}?framework=${activeFramework}`)}
                    >
                      <td className="py-3 pl-5 pr-4">
                        <div className="text-sm font-bold text-slate-800">{row.name}</div>
                        <div className="text-[11px] text-slate-400">{row.type ?? "—"}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold border ${posture.className}`}>
                          {posture.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm font-bold text-slate-700">{row.score}%</td>
                      <td className="py-3 pr-4 text-sm text-red-600 font-semibold">{row.fail}</td>
                      <td className="py-3 pr-4 text-sm text-amber-600 font-semibold">{row.partial}</td>
                      <td className="py-3 pr-4 text-sm text-emerald-600 font-semibold">{row.pass}</td>
                      <td className="py-3 pr-5 text-[11px] text-slate-400">{row.evidenceTags.join(", ") || "—"}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                      No agents found for this framework yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {activeMeta && <div className="text-[11px] text-slate-300">{activeMeta.category}</div>}
    </div>
  );
}
