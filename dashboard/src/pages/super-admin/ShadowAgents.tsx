import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { discoveryAPI, dashboardAPI } from "../../lib/api";
import type { DiscoveredAgent, AgentFilters } from "../../types/discovery";
import type { ShadowAgentStats } from "../../types/dashboard";
import StatCard from "../../components/shared/StatCard";
import AgentsFilterBar from "../../components/super_admin/agents/AgentsFilterBar";
import AgentsTable from "../../components/super_admin/agents/AgentsTable";
import Pagination from "../../components/super_admin/agents/Pagination";
import UpdateAgentStatusModal from "../../components/super_admin/agents/UpdateAgentStatusModal";

const PAGE_SIZE = 20;

export default function ShadowAgents() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [agents, setAgents] = useState<DiscoveredAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ShadowAgentStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<DiscoveredAgent | null>(null);

  const [filterOptions, setFilterOptions] = useState<AgentFilters>({
    models: [],
    providers: [],
    owners: [],
    types: [],
    statuses: [],
  });

  // Extract state from URL
  const activeFilters = {
    search: searchParams.get("search") || "",
    model: searchParams.get("model") || "",
    provider: searchParams.get("provider") || "",
    owner: searchParams.get("owner") || "",
    type: searchParams.get("type") || "",
    status: searchParams.get("status") || "shadow",
  };
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);

  // Fetch filter options on mount
  useEffect(() => {
    discoveryAPI
      .getAgentFilters()
      .then((res) => setFilterOptions(res.data))
      .catch((err) => console.error("Failed to load filter options", err));

    dashboardAPI
      .getShadowStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Failed to load shadow stats", err));
  }, []);

  // Fetch data when URL changes
  useEffect(() => {
    setLoading(true);
    discoveryAPI
      .getAgents({
        ...activeFilters,
        status: "shadow,conditionally_shadow,under_review,flagged,deprecated", // Force statuses
        excludeIdentities: true, // Exclude pure Entra identity records (no model)
        sortBy,
        sortOrder,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      .then((res) => {
        setAgents(res.data.agents);
        setTotal(res.data.total);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load agents", err);
        setLoading(false);
      });
  }, [searchParams]);

  // Handlers to update URL
  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') return; // Disable status change
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    newParams.set("page", "1"); // Reset to page 1 on filter change
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set("sortBy", sortBy);
    newParams.set("sortOrder", sortOrder);
    setSearchParams(newParams);
  };

  const handleSort = (field: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (sortBy === field) {
      newParams.set("sortOrder", sortOrder === "asc" ? "desc" : "asc");
    } else {
      newParams.set("sortBy", field);
      newParams.set("sortOrder", "asc");
    }
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", newPage.toString());
    setSearchParams(newParams);
  };

  const handleUpdateStatus = async (
    agentId: string,
    actionType: "request" | "approve" | "reject",
    payload?: string,
    remark?: string
  ) => {
    try {
      let res;
      if (actionType === "request") {
        res = await discoveryAPI.requestAgentApproval(agentId, payload!, remark!);
      } else {
        res = await discoveryAPI.approveAgent(agentId, actionType, remark, payload);
      }
      
      setIsModalOpen(false);
      setSelectedAgent(null);

      // Refresh locally
      const updatedAgent = res.data.agent;
      setAgents((prev) => prev.map((a) => (a.id === agentId ? updatedAgent : a)));
      
      dashboardAPI.getShadowStats().then((r) => setStats(r.data)).catch(console.error);
    } catch (err) {
      console.error("Failed to update agent status:", err);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full overflow-y-auto animate-view-in">
      <h1 className="text-[20px] font-display font-bold text-text-primary tracking-tight mb-4 select-none flex items-center gap-2">
        <div className="w-1.5 h-5 bg-amber rounded-full"></div>
        Shadow Agents
      </h1>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
          <StatCard
            color="amber"
            label="TOTAL SHADOW AGENTS"
            value={stats.totalShadowAgents}
            sub="All unapproved agents"
          />
          <StatCard
            color="red"
            label="AT RISK AGENTS"
            value={stats.atRiskAgents}
            sub="Missing owner & unapproved model"
          />
          <StatCard
            color="brand"
            label="ROGUE AGENTS"
            value={stats.rogueAgents}
            sub="Has owner but unapproved model"
          />
          <StatCard
            color="purple"
            label="OWNERLESS"
            value={stats.ownerless}
            sub="Missing owner but approved model"
          />
        </div>
      )}

      <AgentsFilterBar
        filters={{...filterOptions, statuses: []}}
        activeFilters={{...activeFilters, status: 'shadow,conditionally_shadow,under_review,flagged,deprecated'}}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {loading && agents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : (
        <div className="flex flex-col relative group">
          {loading && (
            <div className="absolute inset-0 bg-bg-root/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </div>
          )}
          <AgentsTable
            agents={agents}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onOpenUpdateModal={(agent) => {
              setSelectedAgent(agent);
              setIsModalOpen(true);
            }}
          />
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={handlePageChange}
          />
        </div>
      )}

      <UpdateAgentStatusModal
        isOpen={isModalOpen}
        agent={selectedAgent}
        onClose={() => setIsModalOpen(false)}
        onUpdate={handleUpdateStatus}
      />
    </div>
  );
}
