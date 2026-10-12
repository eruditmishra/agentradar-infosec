import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { discoveryAPI } from "../../lib/api";
import type { DiscoveredAgent, AgentFilters } from "../../types/discovery";
import AgentsFilterBar from "../../components/super_admin/agents/AgentsFilterBar";
import AgentsTable from "../../components/super_admin/agents/AgentsTable";
import Pagination from "../../components/super_admin/agents/Pagination";
import UpdateAgentStatusModal from "../../components/super_admin/agents/UpdateAgentStatusModal";
import StatCard from "../../components/shared/StatCard";

const PAGE_SIZE = 20;

export default function AgentIdentities() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [agents, setAgents] = useState<DiscoveredAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<DiscoveredAgent | null>(null);

  const [filterOptions, setFilterOptions] = useState<AgentFilters>({
    models: [],
    providers: [],
    owners: [],
    types: [],
    statuses: [],
  });

  // Stats derived from the loaded data
  const [identityStats, setIdentityStats] = useState<{
    total: number;
    shadow: number;
    approved: number;
  } | null>(null);

  // Extract state from URL
  const activeFilters = {
    search: searchParams.get("search") || "",
    model: searchParams.get("model") || "",
    provider: searchParams.get("provider") || "",
    owner: searchParams.get("owner") || "",
    type: searchParams.get("type") || "",
    status: searchParams.get("status") || "",
  };
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);

  // Fetch filter options on mount + quick stats
  useEffect(() => {
    discoveryAPI
      .getAgentFilters()
      .then((res) => setFilterOptions(res.data))
      .catch((err) => console.error("Failed to load filter options", err));

    // Fetch all identity records for stats (no pagination)
    discoveryAPI
      .getAgents({ hasModel: false, limit: 1000, offset: 0 })
      .then((res) => {
        const all = res.data.agents as DiscoveredAgent[];
        setIdentityStats({
          total: res.data.total,
          shadow: all.filter((a) =>
            ["shadow", "flagged", "under_review", "deprecated"].includes(a.status)
          ).length,
          approved: all.filter((a) =>
            ["approved", "conditionally_approved"].includes(a.status)
          ).length,
        });
      })
      .catch(console.error);
  }, []);

  // Fetch paged data when URL changes
  useEffect(() => {
    setLoading(true);
    discoveryAPI
      .getAgents({
        ...activeFilters,
        hasModel: false, // Only modelless records — pure Entra identities / service principals
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
        console.error("Failed to load identities", err);
        setLoading(false);
      });
  }, [searchParams]);

  const handleFilterChange = (key: string, value: string) => {
    if (key === "type") return; // Always locked to identity
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    newParams.set("page", "1");
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

      const updatedAgent = res.data.agent;
      setAgents((prev) => prev.map((a) => (a.id === agentId ? updatedAgent : a)));
    } catch (err) {
      console.error("Failed to update identity status:", err);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full overflow-y-auto animate-view-in">
      <div className="mb-4">
        <h1 className="text-[20px] font-display font-bold text-text-primary tracking-tight select-none flex items-center gap-2">
          <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
          Agent Identities
        </h1>
        <p className="text-[12px] text-text-muted mt-1 ml-4">
          Azure Entra service principals and managed identities registered for agents —
          distinct from the agent workloads themselves.
        </p>
      </div>

      {identityStats && (
        <div className="grid grid-cols-3 gap-4 mb-4 shrink-0">
          <StatCard
            color="purple"
            label="TOTAL IDENTITIES"
            value={identityStats.total}
            sub="All discovered agent identities"
          />
          <StatCard
            color="amber"
            label="UNREVIEWED"
            value={identityStats.shadow}
            sub="Shadow or flagged identities"
          />
          <StatCard
            color="green"
            label="APPROVED"
            value={identityStats.approved}
            sub="Verified agent identities"
          />
        </div>
      )}

      {/* Info callout */}
      <div className="mb-4 flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-[12px] text-purple-800">
        <svg className="w-4 h-4 mt-0.5 shrink-0 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
        <span>
          These are <strong>agent identity registrations</strong> (Entra App Registrations, Managed Identities)
          associated with AI workloads discovered on Azure. They are <strong>not agent workloads themselves</strong> — see{" "}
          <a href="/agents" className="underline font-semibold text-purple-700 hover:text-purple-900">Discovered Agents</a> for actual AI agent instances.
        </span>
      </div>

      <AgentsFilterBar
        filters={{ ...filterOptions, types: [], statuses: [] }}
        activeFilters={{ ...activeFilters, type: "" }}
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
