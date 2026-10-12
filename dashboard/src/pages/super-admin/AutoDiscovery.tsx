import { useEffect, useState } from "react";
import { discoveryAPI } from "../../lib/api";
import { AlertTriangle, Info, ShieldAlert, CheckCircle, Clock } from "lucide-react";

export default function AutoDiscovery() {
  const [frequency, setFrequency] = useState("daily");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, findingsRes] = await Promise.all([
        discoveryAPI.getSettings(),
        discoveryAPI.getAutoFindings()
      ]);
      setFrequency(settingsRes.data.auto_scan_frequency);
      setIsEnabled(settingsRes.data.is_enabled);
      setIsEditing(!settingsRes.data.is_enabled);
      setFindings(findingsRes.data.findings);
    } catch (err) {
      console.error("Failed to load auto discovery data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await discoveryAPI.updateSettings(isEnabled, frequency);
      setIsEditing(false);
      setSaveMessage("Settings saved successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      setSaveMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const renderFindingIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <ShieldAlert className="text-status-error w-5 h-5" />;
      case "risk": return <AlertTriangle className="text-status-warning w-5 h-5" />;
      default: return <Info className="text-brand w-5 h-5" />;
    }
  };

  const formatFindingType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-app-bg text-text-primary">
      <div className="max-w-[1200px] mx-auto p-8 flex flex-col gap-8">
        
        {/* Header */}
        <div>
          <h1 className="text-[28px] font-bold text-text-primary tracking-tight">Auto Discovery</h1>
          <p className="text-text-secondary mt-2">Configure automated scans and review the latest findings.</p>
        </div>

        {/* Static Notice */}
        <div className="p-4 bg-brand/10 border border-brand/20 rounded-xl flex gap-3 items-start">
          <Clock className="w-5 h-5 text-brand shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary">
            <strong>Note:</strong> The detected agents with approved/rejected model would be auto marked as shadow/approved after 24 hours of the scan.
          </p>
        </div>

        {/* Settings Card */}
        <div className="bg-glass-white backdrop-blur-[24px] border border-glass-border shadow-[0_8px_32px_rgba(100,120,200,0.08)] rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold">Auto Discovery Settings</h2>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 hover:bg-brand/20 rounded-lg transition-colors"
              >
                Edit Settings
              </button>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between py-2 border-b border-glass-border">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Enable Automated Scans</h3>
                <p className="text-xs text-text-secondary mt-1">Automatically run discovery scans across all active integrations.</p>
              </div>
              
              <button 
                onClick={() => isEditing && setIsEnabled(!isEnabled)}
                disabled={!isEditing}
                className={`relative w-11 h-6 rounded-full transition-colors ${isEnabled ? 'bg-brand' : 'bg-glass-border-dim'} ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {isEnabled && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Scan Frequency</label>
                {isEditing ? (
                  <select 
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="h-10 px-3 py-2 bg-app-bg border border-glass-border rounded-lg text-sm font-medium focus:outline-none focus:border-brand transition-colors appearance-none max-w-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                ) : (
                  <div className="h-10 px-4 flex items-center bg-app-bg/50 border border-glass-border rounded-lg text-sm font-medium text-text-primary max-w-sm capitalize">
                    {frequency}
                  </div>
                )}
              </div>
            )}

            {isEditing && (
              <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 px-6 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-bold transition-all shadow-[0_4px_12px_rgba(100,120,200,0.2)] disabled:opacity-70 flex items-center justify-center min-w-[100px]"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {saveMessage && <span className="text-sm font-medium text-brand">{saveMessage}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Findings Table */}
        <div className="bg-glass-white backdrop-blur-[24px] border border-glass-border shadow-[0_8px_32px_rgba(100,120,200,0.08)] rounded-xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-glass-border flex justify-between items-center">
            <h2 className="text-lg font-bold">Latest Scan Findings</h2>
          </div>
          
          <div className="w-full overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-text-secondary text-sm">Loading findings...</div>
            ) : findings.length === 0 ? (
              <div className="p-8 text-center text-text-secondary flex flex-col items-center gap-3">
                <CheckCircle className="w-8 h-8 text-status-success/70" />
                <p className="text-sm font-medium">No new findings from the latest automated scan.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-bg border-b border-glass-border text-text-secondary text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold w-12">Severity</th>
                    <th className="px-6 py-4 font-semibold">Agent Name</th>
                    <th className="px-6 py-4 font-semibold">Finding Type</th>
                    <th className="px-6 py-4 font-semibold">Details</th>
                    <th className="px-6 py-4 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-glass-border">
                  {findings.map((finding) => (
                    <tr key={finding.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex justify-center" title={finding.severity}>
                          {renderFindingIcon(finding.severity)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-text-primary">
                        {finding.agent_name || "Unknown"}
                        <div className="text-xs text-text-secondary font-normal mt-0.5">{finding.agent_provider}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-glass-border">
                          {formatFindingType(finding.finding_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary max-w-[300px] truncate" title={JSON.stringify(finding.details)}>
                        {JSON.stringify(finding.details)}
                      </td>
                      <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                        {new Date(finding.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
