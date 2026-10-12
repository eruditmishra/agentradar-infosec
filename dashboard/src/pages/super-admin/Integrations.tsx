import { Search, Play, CheckCircle2 } from "lucide-react";
import { usePermission } from "../../hooks/usePermission";
import { integrationsAPI, discoveryAPI } from "../../lib/api";
import type {
  IntegrationConnectionView,
  ProviderCatalogItem,
} from "../../types/integration";
import { INTEGRATION_PROVIDERS } from "../../components/super_admin/integrations/providers";
import ProviderModal from "../../components/super_admin/integrations/ProviderModal";
import BrandIcon from "../../components/super_admin/integrations/BrandIcon";
import { useEffect, useState } from "react";

const ALL_CATS = [
  "All",
  ...Array.from(new Set(INTEGRATION_PROVIDERS.map((i) => i.cat))),
];

export default function Integrations() {
  const canCreate = usePermission("integrations", "create");
  const canUpdate = usePermission("integrations", "update");
  const canManage = canCreate || canUpdate;

  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [connections, setConnections] = useState<IntegrationConnectionView[]>(
    [],
  );
  const [scanningProviders, setScanningProviders] = useState<
    Record<string, string | null>
  >({});
  const [isScanningAll, setIsScanningAll] = useState<string | null>(null);
  const [activeScans, setActiveScans] = useState<
    { scanId: string; providerId?: string; isAll?: boolean }[]
  >([]);

  const [selectedProvider, setSelectedProvider] =
    useState<ProviderCatalogItem | null>(null);

  const fetchConnections = async () => {
    try {
      const res = await integrationsAPI.listIntegrations();
      setConnections(res.data.items || res.data.integrations || []);
    } catch (err) {
      console.error("Failed to fetch integrations", err);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (activeScans.length === 0) return;
    const interval = setInterval(async () => {
      for (const scan of activeScans) {
        try {
          const res = await discoveryAPI.getScan(scan.scanId);
          const status = res.data.scan.status;
          if (status === "completed" || status === "failed") {
            const agentsFound = res.data.scan.stats?.totalAgents || 0;
            if (scan.isAll) {
              setIsScanningAll(
                status === "completed"
                  ? `Success: ${agentsFound} found`
                  : "Failed",
              );
              setTimeout(() => setIsScanningAll(null), 8000);
            } else if (scan.providerId) {
              setScanningProviders((prev) => ({
                ...prev,
                [scan.providerId!]:
                  status === "completed"
                    ? `Success: ${agentsFound} found`
                    : "Failed",
              }));
              setTimeout(
                () =>
                  setScanningProviders((prev) => ({
                    ...prev,
                    [scan.providerId!]: null,
                  })),
                8000,
              );
            }
            setActiveScans((prev) =>
              prev.filter((s) => s.scanId !== scan.scanId),
            );
          }
        } catch (err) {
          console.error("Failed to check scan status", err);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeScans]);

  const handleAddConnection = async (_: string, data: any) => {
    await integrationsAPI.createIntegration(data);
    await fetchConnections();
  };

  const handleUpdateConnection = async (id: string, data: any) => {
    await integrationsAPI.updateIntegration(id, data);
    await fetchConnections();
  };

  const handleTestConnection = async (id: string) => {
    try {
      await integrationsAPI.testIntegration(id);
      await fetchConnections();
    } catch (err) {
      console.error("Failed to test integration", err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      await integrationsAPI.deleteIntegration(id);
      await fetchConnections();
    } catch (err) {
      console.error("Failed to delete integration", err);
    }
  };

  const handleStartScan = async (
    e: React.MouseEvent,
    providerId: string,
    connectionIds: string[],
  ) => {
    e.stopPropagation();
    if (!connectionIds.length) return;

    setScanningProviders((prev) => ({ ...prev, [providerId]: "scanning" }));
    try {
      const res = await discoveryAPI.startScan(connectionIds);
      setActiveScans((prev) => [
        ...prev,
        { scanId: res.data.scanId, providerId },
      ]);
    } catch (err) {
      console.error("Failed to start scan", err);
      setScanningProviders((prev) => ({ ...prev, [providerId]: null }));
    }
  };

  const handleScanAll = async () => {
    setIsScanningAll("scanning");
    try {
      const res = await discoveryAPI.startScan(undefined, true);
      setActiveScans((prev) => [
        ...prev,
        { scanId: res.data.scanId, isAll: true },
      ]);
    } catch (err) {
      console.error("Failed to start full scan", err);
      setIsScanningAll(null);
    }
  };

  const connectedProviderIds = new Set(connections.map((c) => c?.provider));

  const filteredProviders = INTEGRATION_PROVIDERS.filter((i) => {
    const isConnected = connectedProviderIds.has(i.id);
    if (!canManage && !isConnected) return false;

    const matchesFilter = filter === "All" || i.cat === filter;
    const matchesSearch =
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.cat.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const numConnected = connectedProviderIds.size;
  const availableProvidersCount = canManage
    ? INTEGRATION_PROVIDERS.length
    : numConnected;
  const numNotConnected = availableProvidersCount - numConnected;

  return (
    <div className="h-full flex flex-col px-4 md:px-8 py-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-display font-bold tracking-tight text-text-primary">
            Connect Hub
          </h1>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            {numConnected} of {availableProvidersCount} integration providers
            connected
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap justify-end gap-2">
            {ALL_CATS.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 text-[12px] font-bold rounded-full transition-all border ${
                  filter === cat
                    ? "bg-brand text-white border-brand shadow-md"
                    : "bg-glass-white backdrop-blur-glass text-text-secondary border-glass-border hover:text-text-primary hover:border-glass-border-dim"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-[220px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                size={16}
              />
              <input
                type="text"
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-glass-white backdrop-blur-glass border border-glass-border-dim rounded-full py-1.5 pl-9 pr-4 text-[13px] text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-text-ghost transition-all"
              />
            </div>

            <button
              onClick={handleScanAll}
              disabled={isScanningAll !== null}
              className={`flex items-center justify-center gap-1.5 px-4 py-1.5 text-[13px] font-bold rounded-full transition-all border shadow-sm ${
                isScanningAll?.startsWith("Success")
                  ? "bg-green text-white border-green"
                  : isScanningAll === "Failed"
                    ? "bg-red text-white border-red"
                    : isScanningAll === "scanning"
                      ? "bg-brand text-white border-brand animate-pulse"
                      : "bg-brand text-white border-brand hover:bg-brand-hover hover:border-brand-hover"
              }`}
            >
              {isScanningAll?.startsWith("Success") ? (
                <>
                  <CheckCircle2 size={14} /> {isScanningAll}
                </>
              ) : isScanningAll === "Failed" ? (
                "Scan Failed"
              ) : (
                <>
                  <Play
                    size={14}
                    className={
                      isScanningAll === "scanning" ? "animate-pulse" : ""
                    }
                  />{" "}
                  {isScanningAll === "scanning" ? "Scanning..." : "Scan All"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 shrink-0">
        <div className="bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass rounded-xl p-5 flex items-center gap-4">
          <div className="font-display text-4xl font-extrabold text-green">
            {numConnected}
          </div>
          <div className="text-[12px] font-bold text-green uppercase tracking-wider">
            Connected Providers
          </div>
        </div>
        <div className="bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass rounded-xl p-5 flex items-center gap-4">
          <div className="font-display text-4xl font-extrabold text-brand">
            {availableProvidersCount}
          </div>
          <div className="text-[12px] font-bold text-brand uppercase tracking-wider">
            Available Integrations
          </div>
        </div>
        <div className="bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass rounded-xl p-5 flex items-center gap-4">
          <div className="font-display text-4xl font-extrabold text-text-ghost">
            {numNotConnected}
          </div>
          <div className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">
            Not Connected
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
        {filteredProviders.map((provider) => {
          const isConnected = connectedProviderIds.has(provider.id);
          const providerConnections = connections.filter(
            (c) => c.provider === provider.id,
          );

          return (
            <div
              key={provider.id}
              onClick={() => setSelectedProvider(provider)}
              className="group relative bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass hover:shadow-glass-lg rounded-xl p-5 flex flex-col gap-4 cursor-pointer transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {isConnected && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: provider.color }}
                />
              )}

              <div className="flex items-start gap-4 z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center p-2 shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105"
                  style={{ backgroundColor: provider.color + "18" }}
                >
                  <BrandIcon providerId={provider.id} className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] text-text-primary mb-0.5 truncate">
                    {provider.name}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted truncate">
                    {provider.cat}
                  </div>
                </div>
              </div>

              <div className="text-[12px] text-text-secondary leading-relaxed z-10 flex-1">
                {provider.desc}
              </div>

              <div className="mt-2 pt-4 border-t border-glass-border-dim z-10 flex items-center justify-between">
                {isConnected ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green/10 text-green text-[10px] font-bold rounded-full border border-green/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green"></span>
                      Connected ({providerConnections.length})
                    </span>
                    <button
                      onClick={(e) =>
                        handleStartScan(
                          e,
                          provider.id,
                          providerConnections.map((c) => c.id),
                        )
                      }
                      disabled={
                        scanningProviders[provider.id] !== undefined &&
                        scanningProviders[provider.id] !== null
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border transition-all whitespace-nowrap ${
                        scanningProviders[provider.id]?.startsWith("Success")
                          ? "bg-green/10 text-green border-green/20"
                          : scanningProviders[provider.id] === "Failed"
                            ? "bg-red/10 text-red border-red/20"
                            : scanningProviders[provider.id] === "scanning"
                              ? "bg-brand/10 text-brand border-brand/20 animate-pulse"
                              : "bg-white/50 text-text-secondary hover:text-brand hover:border-brand/30 border-glass-border-dim"
                      }`}
                      title="Start Scan"
                    >
                      {scanningProviders[provider.id]?.startsWith(
                        "Success",
                      ) ? (
                        <>
                          <CheckCircle2 size={12} />{" "}
                          {scanningProviders[provider.id]}
                        </>
                      ) : scanningProviders[provider.id] === "Failed" ? (
                        "Failed"
                      ) : (
                        <>
                          <Play
                            size={12}
                            className={
                              scanningProviders[provider.id] === "scanning"
                                ? "animate-pulse"
                                : ""
                            }
                          />{" "}
                          {scanningProviders[provider.id] === "scanning"
                            ? "Scanning..."
                            : "Start Scan"}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/50 text-text-muted text-[10px] font-bold rounded-full border border-glass-border">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-ghost"></span>
                      Not Connected
                    </span>
                    {canManage && (
                      <span className="text-[11px] font-semibold text-brand group-hover:text-brand-hover transition-colors">
                        Configure &rarr;
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ProviderModal
        isOpen={!!selectedProvider}
        provider={selectedProvider}
        connections={connections}
        canManage={canManage}
        onClose={() => setSelectedProvider(null)}
        onAdd={handleAddConnection}
        onUpdate={handleUpdateConnection}
        onTest={handleTestConnection}
        onDelete={handleDeleteConnection}
      />
    </div>
  );
}
