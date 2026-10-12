import { useState } from "react";
import { X, Plus, Trash2, Activity, Play, ChevronLeft, Pencil } from "lucide-react";
import type { ProviderCatalogItem, IntegrationConnectionView } from "../../../types/integration";
import BrandIcon from "./BrandIcon";

interface ProviderModalProps {
  isOpen: boolean;
  provider: ProviderCatalogItem | null;
  connections: IntegrationConnectionView[];
  canManage: boolean;
  onClose: () => void;
  onAdd: (providerId: string, data: any) => Promise<void>;
  onUpdate: (id: string, data: any) => Promise<void>;
  onTest: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ProviderModal({
  isOpen,
  provider,
  connections,
  canManage,
  onClose,
  onAdd,
  onUpdate,
  onTest,
  onDelete,
}: ProviderModalProps) {
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [connectionName, setConnectionName] = useState("");
  const [editingConnection, setEditingConnection] =
    useState<IntegrationConnectionView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  if (!isOpen || !provider) return null;

  const splitFields = () => {
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};

    provider.fields.forEach(f => {
      if (f.type === "password") {
        secrets[f.key] = formData[f.key] || "";
      } else {
        config[f.key] = formData[f.key] || "";
      }
    });

    return { config, secrets };
  };

  const startEdit = (conn: IntegrationConnectionView) => {
    setEditingConnection(conn);
    setConnectionName(conn.name);
    const prefill: Record<string, string> = {};
    provider.fields.forEach(f => {
      if (f.type !== "password") {
        prefill[f.key] = (conn.config?.[f.key] as string) ?? "";
      }
    });
    setFormData(prefill);
    setView("edit");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Split into config and secrets based on field type in a real app,
      // but the API takes { provider, config, secrets }.
      // We'll separate fields that are "password" as secrets, others as config.
      const { config, secrets } = splitFields();

      await onAdd(provider.id, {
        provider: provider.id,
        name: connectionName || `${provider.name} Connection`,
        environment: "production",
        config,
        secrets,
      });
      setView("list");
      setFormData({});
    } catch (err) {
      console.error("Failed to add connection", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnection) return;
    setIsSubmitting(true);
    try {
      // Password fields left blank mean "keep the existing secret" — the
      // backend only overwrites a secret key when a non-empty value is sent.
      const { config, secrets } = splitFields();

      await onUpdate(editingConnection.id, {
        name: connectionName,
        config,
        secrets,
      });
      setView("list");
      setFormData({});
      setEditingConnection(null);
    } catch (err) {
      console.error("Failed to update connection", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await onTest(id);
    } finally {
      setTestingId(null);
    }
  };

  const providerConnections = connections.filter(c => c.provider === provider.id);

  const handleClose = () => {
    setView("list");
    setFormData({});
    setEditingConnection(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={handleClose}
      />
      
      <div className="relative bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass-lg rounded-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-glass-border-dim bg-white/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {view !== "list" && (
              <button
                onClick={() => {
                  setView("list");
                  setFormData({});
                  setEditingConnection(null);
                }}
                className="p-1 rounded-full hover:bg-black/5 text-text-secondary transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 shrink-0"
                style={{ backgroundColor: provider.color + "18" }}
              >
                <BrandIcon providerId={provider.id} className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary leading-tight">
                  {view === "add"
                    ? `Add ${provider.name} Connection`
                    : view === "edit"
                      ? `Edit ${editingConnection?.name ?? provider.name}`
                      : provider.name}
                </h2>
                <p className="text-[12px] text-text-secondary font-medium">
                  {provider.cat}
                </p>
              </div>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-black/5 text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-glass-white">
          {view === "list" ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider">
                  Active Connections ({providerConnections.length})
                </h3>
                {canManage && (
                  <button
                    onClick={() => {
                      setConnectionName(`${provider.name} Connection`);
                      setView("add");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors text-[12px] font-bold"
                  >
                    <Plus size={14} /> Add Connection
                  </button>
                )}
              </div>

              {providerConnections.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center bg-white/30 rounded-lg border border-glass-border border-dashed">
                  <Activity size={32} className="text-text-ghost mb-3" />
                  <p className="text-[14px] font-medium text-text-secondary mb-1">No connections yet</p>
                  <p className="text-[12px] text-text-muted max-w-xs">
                    Connect {provider.name} to start monitoring and managing AI workloads automatically.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {providerConnections.map(conn => (
                    <div key={conn.id} className="p-4 bg-white/50 border border-glass-border-dim rounded-lg flex items-center justify-between hover:border-glass-border transition-colors">
                      <div className="flex flex-col">
                        <div className="font-semibold text-[13px] text-text-primary">{conn.name}</div>
                        <div className="text-[11px] text-text-muted flex items-center gap-2 mt-1">
                          <span className="capitalize">{conn.environment}</span>
                          &bull;
                          <span className={conn.status === "active" ? "text-green font-semibold" : "text-amber font-semibold"}>
                            {conn.status}
                          </span>
                        </div>
                        {conn.last_tested_at && (
                          <div className="text-[10px] text-text-ghost mt-1">
                            Last tested: {new Date(conn.last_tested_at).toLocaleString()}
                          </div>
                        )}
                        {conn.last_error && (
                          <div className="text-[10px] text-red mt-1 max-w-sm truncate">
                            Error: {conn.last_error}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleTest(conn.id)}
                          disabled={testingId === conn.id || !canManage}
                          className="p-2 rounded bg-white/50 text-text-secondary hover:text-brand hover:bg-brand/10 border border-glass-border-dim transition-all disabled:opacity-50"
                          title="Test Connection"
                        >
                          <Play size={14} className={testingId === conn.id ? "animate-pulse text-brand" : ""} />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => startEdit(conn)}
                            className="p-2 rounded bg-white/50 text-text-secondary hover:text-brand hover:bg-brand/10 border border-glass-border-dim transition-all"
                            title="Edit Connection"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => onDelete(conn.id)}
                            className="p-2 rounded bg-white/50 text-text-secondary hover:text-red hover:bg-red/10 border border-glass-border-dim transition-all"
                            title="Delete Connection"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={view === "edit" ? handleEditSubmit : handleAddSubmit} className="flex flex-col h-full">
              <div className="flex-1 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-text-secondary">
                    Connection Name <span className="text-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    className="w-full bg-bg-root border border-glass-border-dim rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                {provider.fields.map(field => {
                  const isSecret = field.type === "password";
                  const label = isSecret && view === "edit" ? `${field.label} (unchanged)` : field.label;
                  const placeholder = isSecret && view === "edit" ? "Leave blank to keep current value" : field.placeholder;
                  const required = view === "edit" && isSecret ? false : field.required;

                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-bold text-text-secondary">
                        {label} {required && <span className="text-red">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          required={required}
                          placeholder={placeholder}
                          value={formData[field.key] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full bg-bg-root border border-glass-border-dim rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand min-h-[100px] resize-y placeholder:text-text-ghost"
                        />
                      ) : field.type === "select" && field.options ? (
                        <select
                          required={required}
                          value={formData[field.key] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full bg-bg-root border border-glass-border-dim rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        >
                          <option value="" disabled>Select {field.label}</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          required={required}
                          placeholder={placeholder}
                          value={formData[field.key] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full bg-bg-root border border-glass-border-dim rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-text-ghost"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-4 border-t border-glass-border-dim flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setFormData({});
                    setEditingConnection(null);
                  }}
                  className="px-4 py-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-[13px] font-bold bg-brand text-white rounded-lg shadow-sm hover:bg-brand-hover transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : view === "edit" ? "Save Changes" : "Save Connection"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
