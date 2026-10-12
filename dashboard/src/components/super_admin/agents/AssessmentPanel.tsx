import { useEffect, useState } from "react";
import { Shield, Loader2, RefreshCw } from "lucide-react";
import { discoveryAPI } from "../../../lib/api";
import type { SecurityAssessment } from "../../../types/discovery";
import FrameworkControlTable from "./FrameworkControlTable";

interface AssessmentPanelProps {
  agentId: string;
}

export default function AssessmentPanel({ agentId }: AssessmentPanelProps) {
  const [assessment, setAssessment] = useState<SecurityAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFramework, setActiveFramework] = useState<string>("owasp_ai_agents_2026");

  const fetchAssessment = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await discoveryAPI.getSecurityAssessment(agentId);
      setAssessment(res.data.assessment);
    } catch (err: any) {
      setError(err.response?.status === 404 ? "Assessment not found for this agent." : "Failed to load assessment.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await discoveryAPI.refreshSecurityAssessment(agentId);
      setAssessment(res.data.assessment);
    } catch {
      setError("Failed to refresh assessment.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAssessment(); }, [agentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-16 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500 font-medium text-sm">Loading assessment…</span>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Shield className="w-14 h-14 text-slate-200 mx-auto mb-4" />
        <h3 className="text-slate-800 font-bold text-base mb-1">Assessment Unavailable</h3>
        <p className="text-slate-400 text-sm mb-5">{error}</p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Computing…" : "Run Assessment Now"}
        </button>
      </div>
    );
  }

  if (!assessment) return null;

  const getSortWeight = (id: string) => {
    const lowerId = id.toLowerCase();
    if (lowerId.includes("owasp")) return 1;
    if (lowerId.includes("nist")) return 2;
    if (lowerId.includes("iso")) return 3;
    return 4;
  };

  const frameworks = Object.values(assessment.frameworks ?? {}).sort((a, b) => getSortWeight(a.meta.id) - getSortWeight(b.meta.id));
  const active = assessment.frameworks?.[activeFramework] ?? frameworks[0];
  const completeness = Math.round((assessment.evidence_completeness?.overall ?? 0) * 100);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield className="text-blue-500" size={18} />
              Framework Assessments
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Evidence coverage {completeness}% · Testified against {frameworks.length} framework(s)
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Computing…" : "Recompute"}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {frameworks.map((fw) => (
          <button
            key={fw.meta.id}
            onClick={() => setActiveFramework(fw.meta.id)}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeFramework === fw.meta.id ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {fw.meta.name}
            <span className="text-[11px] text-slate-400">({fw.meta.controlCount})</span>
          </button>
        ))}
      </div>

      {active && <FrameworkControlTable controls={active.controls} meta={active.meta} />}
    </div>
  );
}
