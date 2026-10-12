import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Label,
} from "recharts";
import { useNavigate } from "react-router-dom";
import type { DashboardData } from "../../../types/dashboard";

interface PieChartsProps {
  charts: DashboardData["charts"];
}

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
];
const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#6366f1",
  Low: "#10b981",
};
const PROVIDER_COLORS: Record<string, string> = {
  AWS: "#f97316", // Orange
  Azure: "#3b82f6", // Blue
  GCP: "#ea4335", // Google Red
  Google: "#ea4335",
  "Google Cloud": "#ea4335",
};

export default function PieCharts({ charts }: PieChartsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Risk Level */}
      <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r16 shadow-glass p-5 flex flex-col">
        <div className="font-semibold text-text-primary mb-2 text-[13px]">
          Risk Levels
        </div>
        <div className="flex-1 w-full min-h-[220px]">
          {charts.risk.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted text-[12px]">
              No data available
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {(() => {
                const maxRisk = Math.max(...charts.risk.map((r) => r.value), 1);
                return charts.risk.map((entry) => {
                  const pct = Math.round((entry.value / maxRisk) * 100);
                  return (
                    <div key={entry.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-text-primary">
                          {entry.name}
                        </span>
                        <span className="text-text-muted font-mono">
                          {entry.value}
                        </span>
                      </div>
                      <div className="h-2 bg-black/5 rounded-full overflow-hidden border border-glass-border">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: RISK_COLORS[entry.name] || COLORS[0],
                          }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Provider */}
      <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r16 shadow-glass p-5 flex flex-col">
        <div className="font-semibold text-text-primary mb-2 text-[13px]">
          Agent Distribution
        </div>
        <div className="flex-1 w-full min-h-[220px]">
          {charts.provider.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted text-[12px]">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.provider}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {charts.provider.map((entry, index) => {
                    let color = COLORS[(index + 2) % COLORS.length];
                    for (const [key, val] of Object.entries(PROVIDER_COLORS)) {
                      if (
                        entry.name.toLowerCase().includes(key.toLowerCase())
                      ) {
                        color = val;
                        break;
                      }
                    }
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--glass-border)",
                    fontSize: "12px",
                    background: "rgba(255,255,255,0.9)",
                    backdropFilter: "blur(8px)",
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Models */}
      <div
        onClick={() => navigate("/models")}
        className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r16 shadow-glass p-5 flex flex-col cursor-pointer hover:-translate-y-0.5 transition-transform"
      >
        <div className="font-semibold text-text-primary mb-2 text-[13px]">
          Models Distribution
        </div>
        <div className="flex-1 w-full min-h-[220px]">
          {charts.models.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted text-[12px]">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.models}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {charts.models.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                  <Label
                    value={charts.models.length}
                    position="center"
                    className="font-display text-2xl font-bold fill-text-primary"
                  />
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--glass-border)",
                    fontSize: "12px",
                    background: "rgba(255,255,255,0.9)",
                    backdropFilter: "blur(8px)",
                  }}
                  itemStyle={{ color: "var(--text-primary)" }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
