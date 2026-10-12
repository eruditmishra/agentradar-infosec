import { Activity, ShieldAlert, FileWarning, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

export default function RiskScoreBreakdownPanel({ agent }: { agent: any }) {
  const breakdown = agent.riskScoreBreakdown;

  if (!breakdown) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
        <Activity className="mx-auto mb-3 text-slate-300" size={32} />
        <p>No risk score breakdown available for this agent.</p>
        <p className="text-xs mt-1">This agent may not have been fully assessed yet.</p>
      </div>
    );
  }

  const { components, finalScore, riskLevel } = breakdown;

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "Critical": return "text-red-600 bg-red-50 border-red-200";
      case "High": return "text-orange-600 bg-orange-50 border-orange-200";
      case "Medium": return "text-amber-600 bg-amber-50 border-amber-200";
      case "Low": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  /** Determine if a factor is a partial-risk/unknown signal (amber) vs confirmed (red). */
  const isPartialRisk = (f: any) =>
    f.applied && (f.name?.startsWith("Unverified") || f.name?.includes("unknown") || f.note?.includes("Partial risk") || f.note?.includes("Cannot confirm"));

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-blue-500" size={20} /> Quantitative Risk Assessment
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Risk score (0–115 raw, normalised to 100) based on intrinsic attack surface,
            governance deficits, and OWASP AI Agents 2026 vulnerability signals.
          </p>
        </div>
        <div className={`shrink-0 px-6 py-4 rounded-xl border flex flex-col items-center justify-center min-w-[140px] ${getRiskLevelColor(riskLevel)}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Final Risk Score</div>
          <div className="text-4xl font-black">{finalScore}</div>
          <div className="text-xs font-bold uppercase mt-1">{riskLevel} Risk</div>
        </div>
      </div>

      {/* Breakdown Components */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Component A: Intrinsic Attack Surface */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="text-indigo-500" /> Intrinsic Attack Surface
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
              {components.intrinsicAttackSurface.score} / {components.intrinsicAttackSurface.max} pts
            </span>
          </div>
          <div className="flex-1">
            {components.intrinsicAttackSurface.factors.length > 0 ? (
              <ul className="space-y-2 mt-2">
                {components.intrinsicAttackSurface.factors.map((f: any, i: number) => (
                  <li key={i} className={`text-xs border-b border-slate-100 pb-1.5 last:border-0 ${f.applied ? 'text-slate-600' : 'text-slate-400 opacity-60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className={f.applied ? "text-indigo-400" : "text-slate-300"}>•</span>
                        <span className={f.applied ? "" : "line-through decoration-slate-300"}>{f.name}</span>
                      </span>
                      <span className={`font-mono text-[10px] font-bold shrink-0 ${f.applied ? 'text-red-500' : 'text-slate-400'}`}>
                        {f.applied ? `+${f.points} pts` : `0 / ${f.points} pts`}
                      </span>
                    </div>
                    {f.applied && f.note && (
                      <p className="ml-3 mt-0.5 text-[10px] text-slate-400 italic">{f.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-400 italic mt-2">No significant intrinsic risk factors detected.</div>
            )}
          </div>
        </div>

        {/* Component B: Governance Deficits */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <FileWarning size={16} className="text-amber-500" /> Governance Deficits
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
              {components.governanceDeficits.score} / {components.governanceDeficits.max} pts
            </span>
          </div>
          <div className="flex-1">
            {components.governanceDeficits.factors.length > 0 ? (
              <ul className="space-y-2 mt-2">
                {components.governanceDeficits.factors.map((f: any, i: number) => (
                  <li key={i} className={`text-xs border-b border-slate-100 pb-1.5 last:border-0 ${f.applied ? 'text-slate-600' : 'text-slate-400 opacity-60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className={f.applied ? (isPartialRisk(f) ? "text-amber-400" : "text-amber-500") : "text-slate-300"}>•</span>
                        <span className={f.applied ? "" : "line-through decoration-slate-300"}>{f.name}</span>
                      </span>
                      <span className={`font-mono text-[10px] font-bold shrink-0 ${f.applied ? (isPartialRisk(f) ? 'text-amber-500' : 'text-red-500') : 'text-slate-400'}`}>
                        {f.applied ? `+${f.points} pts` : `0 / ${f.points} pts`}
                      </span>
                    </div>
                    {f.applied && f.note && (
                      <p className="ml-3 mt-0.5 text-[10px] text-amber-500 italic">{f.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-400 italic mt-2">Proper governance controls appear to be in place.</div>
            )}
          </div>
        </div>

        {/* Component C: OWASP Vulnerabilities */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" /> OWASP AI Agents 2026
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
              {components.owaspVulnerabilities.score} / {components.owaspVulnerabilities.max} pts
            </span>
          </div>
          <div className="flex-1">
            {components.owaspVulnerabilities.factors.length > 0 ? (
              <ul className="space-y-2 mt-2">
                {components.owaspVulnerabilities.factors.map((f: any, i: number) => {
                  const isUnverified = f.name?.startsWith("Unverified");
                  return (
                    <li key={i} className={`text-xs border-b border-slate-100 pb-1.5 last:border-0 ${f.applied ? (isUnverified ? 'text-slate-500' : 'text-slate-600') : 'text-slate-400 opacity-60'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className={f.applied ? (isUnverified ? "text-amber-300" : "text-red-400") : "text-slate-300"}>•</span>
                          <span className={f.applied ? (isUnverified ? "italic" : "") : "line-through decoration-slate-300"}>{f.name}</span>
                        </span>
                        <span className={`font-mono text-[10px] font-bold shrink-0 ${f.applied ? (isUnverified ? 'text-amber-500' : 'text-red-500') : 'text-slate-400'}`}>
                          {f.applied ? `+${f.points} pts` : `0 / ${f.points} pts`}
                        </span>
                      </div>
                      {f.applied && f.note && (
                        <p className="ml-3 mt-0.5 text-[10px] text-slate-400 italic">{f.note}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-xs text-slate-400 italic mt-2">No OWASP vulnerabilities or control gaps detected.</div>
            )}
          </div>
        </div>
      </div>

      {/* Component D: Evidence Completeness Multiplier */}
      {components.unknownMultiplier.applied && (
        <div className="bg-slate-800 text-white rounded-xl shadow-sm p-5 flex items-start gap-4">
          <HelpCircle className="text-blue-400 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="font-bold text-sm text-blue-100 mb-1">
              "Black Box" Penalty Applied (×{components.unknownMultiplier.multiplier})
            </h3>
            <p className="text-xs text-slate-300">
              {components.unknownMultiplier.reason}. A risk penalty multiplier has been applied because there is insufficient evidence to confidently verify the agent's safety posture.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
