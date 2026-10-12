import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { discoveryAPI } from "../../lib/api";
import type { SecurityAssessment } from "../../types/discovery";
import FrameworkControlTable from "../../components/super_admin/agents/FrameworkControlTable";

export default function AssessmentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<SecurityAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const frameworkParam = searchParams.get("framework") ?? "all";

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      setLoading(true);
      const res = await discoveryAPI.getSecurityAssessment(agentId);
      setAssessment(res.data.assessment);
      setLoading(false);
    })();
  }, [agentId]);

  const frameworks = useMemo(() => Object.values(assessment?.frameworks ?? {}), [assessment]);
  const active = frameworkParam === "all" ? frameworks[0] : assessment?.frameworks?.[frameworkParam];

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate("/assessments")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={15} /> Back to assessments
        </button>
        <div className="flex items-center gap-2">
          <select
            value={frameworkParam}
            onChange={(e) => setSearchParams({ framework: e.target.value })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All frameworks</option>
            {frameworks.map((fw) => (
              <option key={fw.meta.id} value={fw.meta.id}>{fw.meta.name}</option>
            ))}
          </select>
          <button
            onClick={() => navigate(`/agents/${agentId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
          >
            Open agent <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {frameworkParam === "all"
        ? frameworks.map((fw) => (
            <div key={fw.meta.id}>
              <FrameworkControlTable controls={fw.controls} meta={fw.meta} />
            </div>
          ))
        : active && <FrameworkControlTable controls={active.controls} meta={active.meta} />}
    </div>
  );
}
