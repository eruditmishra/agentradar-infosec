import { useEffect, useState } from "react";
import { dashboardAPI } from "../../lib/api";
import type { DashboardData } from "../../types/dashboard";
import StatCards from "../../components/super_admin/dashboard/StatCards";
import PieCharts from "../../components/super_admin/dashboard/PieCharts";
import RecentScans from "../../components/super_admin/dashboard/RecentScans";
import ActiveAlerts from "../../components/super_admin/dashboard/ActiveAlerts";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI
      .getStats()
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard data", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-text-muted">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto animate-view-in">
      {/* ── Stats Section ── */}
      <StatCards stats={data.stats} alerts={data.alerts} />

      {/* ── Pie Charts Section ── */}
      <PieCharts charts={data.charts} />

      {/* ── Recent Scans & Alerts ── */}
      <div className="grid grid-cols-2 gap-4">
        <RecentScans scans={data.recentScans} />
        <ActiveAlerts alerts={data.alerts} />
      </div>
    </div>
  );
}
