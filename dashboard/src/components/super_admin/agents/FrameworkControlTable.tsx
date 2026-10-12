import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Minus,
  XCircle,
} from "lucide-react";
import type { ControlAssessment, FrameworkMeta } from "../../../types/discovery";

type StatusType = ControlAssessment["status"];

const STATUS_CONFIG: Record<StatusType, { label: string; icon: React.ReactNode; bg: string; text: string; border: string; dot: string }> = {
  detected: { label: "Fail", icon: <XCircle size={12} />, bg: "bg-red-50", text: "text-red-700", border: "border-red-300", dot: "bg-red-500" },
  control_gap: { label: "Partial", icon: <AlertTriangle size={12} />, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-500" },
  unknown: { label: "Partial", icon: <HelpCircle size={12} />, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
  not_observed: { label: "Pass", icon: <CheckCircle2 size={12} />, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500" },
  not_applicable: { label: "N/A", icon: <Minus size={12} />, bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-200", dot: "bg-slate-300" },
};

export interface ControlTableTotals {
  posture: "compliant" | "partial" | "non_compliant" | "unassessed";
  score: number;
  pass: number;
  partial: number;
  fail: number;
}

export function computeControlTotals(controls: ControlAssessment[]): ControlTableTotals {
  const applicable = controls.filter((c) => c.status !== "not_applicable");
  const pass = applicable.filter((c) => c.status === "not_observed").length;
  const partial = applicable.filter((c) => c.status === "unknown" || c.status === "control_gap").length;
  const fail = applicable.filter((c) => c.status === "detected").length;
  const total = applicable.length || 1;
  const score = Math.round((pass / total) * 100);
  const posture = fail > 0 ? "non_compliant" : partial > 0 ? "partial" : applicable.length ? "compliant" : "unassessed";
  return { posture, score, pass, partial, fail };
}

const POSTURE_LABEL: Record<ControlTableTotals["posture"], { label: string; className: string }> = {
  compliant: { label: "COMPLIANT", className: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  partial: { label: "PARTIAL", className: "bg-amber-50 text-amber-700 border-amber-300" },
  non_compliant: { label: "NON COMPLIANT", className: "bg-red-50 text-red-700 border-red-300" },
  unassessed: { label: "UNASSESSED", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function StatusBadge({ status }: { status: StatusType }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function reviewText(c: ControlAssessment): string {
  return c.confidence_reason?.[0] ?? "No review notes recorded.";
}

function ControlRow({ control }: { control: ControlAssessment }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    control.confidence_reason.length > 1 ||
    control.evidence.length > 0 ||
    control.missing_evidence.length > 0 ||
    control.limitations.length > 0;

  return (
    <>
      <tr
        className={`border-b border-slate-100 last:border-0 ${hasDetails ? "cursor-pointer hover:bg-slate-50" : ""}`}
        onClick={() => hasDetails && setExpanded((e) => !e)}
      >
        <td className="py-3 pr-4 align-top">
          <div className="flex items-center gap-2">
            {hasDetails && (expanded ? <ChevronUp size={13} className="text-slate-400 shrink-0" /> : <ChevronDown size={13} className="text-slate-300 shrink-0" />)}
            <div>
              <div className="text-sm font-bold text-slate-800 leading-tight">
                {control.control_id} — {control.name}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{control.category}</div>
            </div>
          </div>
        </td>
        <td className="py-3 pr-4 align-top">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={control.status} />
            {control.requires_runtime_test && (
              <span className="inline-flex items-center gap-1 text-[9px] bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded font-semibold">
                <FlaskConical size={9} /> Runtime
              </span>
            )}
          </div>
        </td>
        <td className="py-3 pr-4 align-top text-[12px] text-slate-600 max-w-md">{reviewText(control)}</td>
        <td className="py-3 align-top text-[11px] text-slate-500 max-w-[160px]">
          {control.source_collectors.filter((s) => s && s !== "unknown").join(", ") || "—"}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="bg-slate-50/60 border-b border-slate-100">
          <td colSpan={4} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              {control.confidence_reason.length > 1 && (
                <div>
                  <div className="font-bold text-slate-500 uppercase tracking-wide mb-1">Reasoning</div>
                  <ul className="space-y-1">
                    {control.confidence_reason.map((r, i) => (
                      <li key={i} className="text-slate-600">› {r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {control.missing_evidence.length > 0 && (
                <div>
                  <div className="font-bold text-amber-600 uppercase tracking-wide mb-1">Missing Evidence</div>
                  <ul className="space-y-1">
                    {control.missing_evidence.map((m, i) => (
                      <li key={i} className="text-slate-600">• {m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {control.limitations.length > 0 && (
                <div className="md:col-span-2 text-slate-500">
                  <span className="font-bold text-slate-500 uppercase tracking-wide mr-1">Scope:</span>
                  {control.limitations[0]}
                </div>
              )}
              {control.recommended_next_scan.length > 0 && (
                <div className="md:col-span-2 flex flex-wrap gap-1.5">
                  <span className="text-slate-400 font-semibold self-center">Next scan:</span>
                  {control.recommended_next_scan.map((s, i) => (
                    <span key={i} className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded font-mono">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function FrameworkControlTable({ controls, meta }: { controls: Record<string, ControlAssessment>; meta?: FrameworkMeta }) {
  const list = Object.values(controls);
  const totals = computeControlTotals(list);
  const postureCfg = POSTURE_LABEL[totals.posture];

  const sorted = [...list].sort((a, b) => {
    const order: Record<StatusType, number> = { detected: 0, control_gap: 1, unknown: 2, not_observed: 3, not_applicable: 4 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1.5">Posture</div>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold border ${postureCfg.className}`}>{postureCfg.label}</span>
        </div>
        <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">Score</div>
          <div className="text-xl font-black text-slate-800">{totals.score}%</div>
        </div>
        <div className="rounded-xl border border-emerald-100 p-3.5 bg-emerald-50">
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide mb-1">Pass</div>
          <div className="text-xl font-black text-emerald-700">{totals.pass}</div>
        </div>
        <div className="rounded-xl border border-amber-100 p-3.5 bg-amber-50">
          <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wide mb-1">Partial</div>
          <div className="text-xl font-black text-amber-700">{totals.partial}</div>
        </div>
        <div className="rounded-xl border border-red-100 p-3.5 bg-red-50">
          <div className="text-[10px] text-red-600 font-bold uppercase tracking-wide mb-1">Fail</div>
          <div className="text-xl font-black text-red-700">{totals.fail}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{meta?.name ?? "Controls"}</h3>
            {meta && <p className="text-[11px] text-slate-400 mt-0.5">{meta.version} · {meta.controlCount} controls · {meta.description}</p>}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">{list.length} reviewed</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-slate-400 font-bold uppercase tracking-wide border-b border-slate-100">
                <th className="py-2.5 pl-5 pr-4 font-bold">Control</th>
                <th className="py-2.5 pr-4 font-bold">Status</th>
                <th className="py-2.5 pr-4 font-bold">Review</th>
                <th className="py-2.5 font-bold">Evidence</th>
              </tr>
            </thead>
            <tbody className="[&_td:first-child]:pl-5">
              {sorted.map((c) => (
                <ControlRow key={c.control_id ?? c.id} control={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
