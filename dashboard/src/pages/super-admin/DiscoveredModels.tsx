import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { discoveryAPI, dashboardAPI } from "../../lib/api";
import type { DiscoveredModel, ModelFilters } from "../../types/discovery";
import type { ModelStats } from "../../types/dashboard";
import ModelsFilterBar from "../../components/super_admin/models/ModelsFilterBar";
import ModelsTable from "../../components/super_admin/models/ModelsTable";
import Pagination from "../../components/super_admin/agents/Pagination";
import UpdateStatusModal from "../../components/super_admin/models/UpdateStatusModal";
import StatCard from "../../components/shared/StatCard";

const PAGE_SIZE = 20;

export const formatStatus = (status: string) => {
  if (status === 'flagged') return 'Rejected';
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'Pending';
  if (status === 'under_review') return 'Under Review';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function DiscoveredModels() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterOptions, setFilterOptions] = useState<ModelFilters>({
    providers: [],
    statuses: [],
    riskLevels: [],
  });

  const [selectedModel, setSelectedModel] = useState<DiscoveredModel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState<ModelStats | null>(null);

  // Extract state from URL
  const activeFilters = {
    search: searchParams.get("search") || "",
    provider: searchParams.get("provider") || "",
    status: searchParams.get("validationStatus") || "",
    riskLevel: searchParams.get("riskLevel") || "",
  };
  const sortBy = searchParams.get("sortBy") || "agent_count";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const fetchStats = useCallback(() => {
    dashboardAPI
      .getModelStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Failed to load model stats", err));
  }, []);

  // Fetch filter options and stats on mount
  useEffect(() => {
    discoveryAPI
      .getModelFilters()
      .then((res) => setFilterOptions(res.data))
      .catch((err) => console.error("Failed to load model filter options", err));

    fetchStats();
  }, [fetchStats]);

  const fetchModels = useCallback(() => {
    setLoading(true);
    discoveryAPI
      .getModels({
        search: activeFilters.search,
        provider: activeFilters.provider,
        validationStatus: activeFilters.status,
        riskLevel: activeFilters.riskLevel,
        sortBy,
        sortOrder,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      .then((res) => {
        setModels(res.data.models);
        setTotal(res.data.total);
      })
      .catch((err) => console.error("Failed to fetch models", err))
      .finally(() => setLoading(false));
  }, [
    activeFilters.search,
    activeFilters.provider,
    activeFilters.status,
    activeFilters.riskLevel,
    sortBy,
    sortOrder,
    page,
  ]);

  // Fetch data when URL changes
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const updateUrl = (newParams: Record<string, string>) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) updated.set(k, v);
      else updated.delete(k);
    });
    setSearchParams(updated, { replace: true });
  };

  const handleFilterChange = (key: string, value: string) => {
    // map the UI keys to API keys
    const urlKey = key === 'status' ? 'validationStatus' : key;
    updateUrl({ [urlKey]: value, page: "1" }); // reset page on filter change
  };

  const handleClearFilters = () => {
    const cleared = new URLSearchParams(searchParams);
    ["search", "provider", "validationStatus", "riskLevel"].forEach((k) =>
      cleared.delete(k)
    );
    cleared.set("page", "1");
    setSearchParams(cleared, { replace: true });
  };

  const handleSort = (field: string) => {
    const isSameField = sortBy === field;
    const nextOrder = isSameField && sortOrder === "desc" ? "asc" : "desc";
    updateUrl({ sortBy: field, sortOrder: nextOrder, page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    updateUrl({ page: newPage.toString() });
  };

  const handleUpdateStatus = async (modelId: string, actionType: 'request' | 'approve' | 'reject', payload?: string) => {
    try {
      if (actionType === 'request' && payload) {
        await discoveryAPI.requestModelApproval(modelId, payload);
      } else if (actionType === 'approve' || actionType === 'reject') {
        await discoveryAPI.approveModel(modelId, actionType);
      }
      setIsModalOpen(false);
      setSelectedModel(null);
      await fetchModels();
      fetchStats();
    } catch (err) {
      console.error("Failed to update model status", err);
    }
  };

  return (
    <div className="h-full flex flex-col px-4 md:px-8 py-6 overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-text-primary">
          Discovered Models
        </h1>
        <p className="text-[13px] text-text-secondary leading-relaxed max-w-2xl">
          An inventory of all foundational AI models detected across your ecosystem.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
          <StatCard
            color="brand"
            label="ALL MODELS"
            value={stats.totalModels}
            sub="Total unique models"
          />
          <StatCard
            color="green"
            label="APPROVED MODELS"
            value={stats.approvedModels}
            sub="Sanctioned for use"
          />
          <StatCard
            color="red"
            label="REJECTED MODELS"
            value={stats.rejectedModels}
            sub="Flagged/denied usage"
          />
          <StatCard
            color="amber"
            label="PENDING APPROVALS"
            value={stats.pendingModels}
            sub="Awaiting review"
          />
        </div>
      )}

      <ModelsFilterBar
        filters={filterOptions}
        activeFilters={activeFilters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass rounded-r16">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <div className="text-[12px] font-semibold text-text-muted tracking-widest uppercase">
              Loading Models
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col re  lative group">
          <ModelsTable
            models={models}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onOpenUpdateModal={(model) => {
              setSelectedModel(model);
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

      <UpdateStatusModal
        isOpen={isModalOpen}
        model={selectedModel}
        onClose={() => setIsModalOpen(false)}
        onUpdate={handleUpdateStatus}
      />
    </div>
  );
}
