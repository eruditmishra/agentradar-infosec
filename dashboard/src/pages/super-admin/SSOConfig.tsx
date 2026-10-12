import { useState, useEffect } from 'react';
import { Shield, Save, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { authAPI } from '../../lib/api';

const MAPPABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'ciso', label: 'CISO' },
  { value: 'security_analyst', label: 'Security Analyst' },
  { value: 'auditor', label: 'Auditor' },
];

interface RoleMapEntry {
  group: string;
  role: string;
}

const SSO_PROVIDERS = [
  { id: 'entra', name: 'Microsoft Entra ID (OIDC)', type: 'oidc' },
  { id: 'okta', name: 'Okta (OIDC)', type: 'oidc' },
  { id: 'auth0', name: 'Auth0 (OIDC)', type: 'oidc' },
  { id: 'google', name: 'Google Workspace (OIDC)', type: 'oidc' },
  { id: 'ping', name: 'PingFederate / PingOne (OIDC)', type: 'oidc' },
  { id: 'keycloak', name: 'Keycloak (OIDC)', type: 'oidc' },
  { id: 'onelogin', name: 'OneLogin (OIDC)', type: 'oidc' },
  { id: 'oidc', name: 'Generic OpenID Connect (OIDC)', type: 'oidc' },
  { id: 'saml', name: 'SAML 2.0 (via IdP metadata)', type: 'saml' },
];

export default function SSOConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  const [isActive, setIsActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(SSO_PROVIDERS[0]);
  const [config, setConfig] = useState<any>({});
  const [hasStoredSecret, setHasStoredSecret] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await authAPI.getSSOSettings();
      const sso = res.data.sso;
      if (sso) {
        setIsActive(sso.is_active);
        const prov = SSO_PROVIDERS.find(p => p.id === sso.provider_id) || SSO_PROVIDERS[0];
        setSelectedProvider(prov);
        // clientSecret is never returned by the API (write-only) — the
        // server tells us whether one is already stored so we can show a
        // placeholder instead of a blank field.
        setConfig(sso.config || {});
        setHasStoredSecret(!!sso.hasClientSecret);
      }
    } catch (err) {
      console.error("Failed to load SSO settings", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage('');
    try {
      // Sanitize config by trimming strings
      const sanitizedConfig: any = {};
      Object.keys(config).forEach(key => {
        sanitizedConfig[key] = typeof config[key] === 'string' ? config[key].trim() : config[key];
      });

      // Trim group names and drop incomplete mapping rows
      if (Array.isArray(sanitizedConfig.roleMappings)) {
        sanitizedConfig.roleMappings = (sanitizedConfig.roleMappings as RoleMapEntry[])
          .map(m => ({ group: (m.group || '').trim(), role: m.role }))
          .filter(m => m.group);
      }

      await authAPI.updateSSOSettings({
        providerId: selectedProvider.id,
        providerType: selectedProvider.type,
        ssoConfig: sanitizedConfig,
        isActive
      });
      setSaveMessage('SSO settings saved successfully.');
    } catch (err) {
      console.error(err);
      setSaveMessage('Failed to save SSO settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  }

  const handleConfigChange = (key: string, value: string) => {
    setConfig({ ...config, [key]: value });
  };

  const roleMappings: RoleMapEntry[] = config.roleMappings ?? [];

  const updateRoleMapping = (i: number, field: 'group' | 'role', value: string) => {
    setConfig({
      ...config,
      roleMappings: roleMappings.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    });
  };

  const addRoleMapping = () => {
    setConfig({ ...config, roleMappings: [...roleMappings, { group: '', role: 'auditor' }] });
  };

  const removeRoleMapping = (i: number) => {
    setConfig({ ...config, roleMappings: roleMappings.filter((_, idx) => idx !== i) });
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prov = SSO_PROVIDERS.find(p => p.id === e.target.value) || SSO_PROVIDERS[0];
    setSelectedProvider(prov);
    // Clear config when switching provider types (optional)
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto h-full relative scroll-smooth bg-slate-50/50 p-6 md:p-8 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
              <Shield size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SSO & IAM</h1>
              <p className="text-sm text-slate-500 font-medium">Configure single sign-on and identity providers for end-users.</p>
            </div>
          </div>
        </header>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Custom SSO Configuration</h2>
              <p className="text-sm text-slate-500 mt-1">
                Note: The default Microsoft login is reserved for Super Admins. Configure a custom provider below for regular users.
              </p>
            </div>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'transform translate-x-6' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm font-semibold text-slate-700">
                {isActive ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className={`p-6 space-y-6 ${!isActive ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">SSO Provider</label>
              <select
                className="w-full max-w-md bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={selectedProvider.id}
                onChange={handleProviderChange}
              >
                {SSO_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {selectedProvider.type === 'oidc' ? (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Issuer URL</label>
                  <input
                    type="url"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder="https://login.microsoftonline.com/tenant-id/v2.0"
                    value={config.issuerUrl || ''}
                    onChange={(e) => handleConfigChange('issuerUrl', e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">The OIDC discovery endpoint base URL.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Client ID</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder="Enter Client ID"
                    value={config.clientId || ''}
                    onChange={(e) => handleConfigChange('clientId', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Client Secret</label>
                  <input
                    type="password"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder={hasStoredSecret ? 'Stored — leave blank to keep current secret' : 'Enter Client Secret'}
                    value={config.clientSecret || ''}
                    onChange={(e) => handleConfigChange('clientSecret', e.target.value)}
                  />
                  {hasStoredSecret && (
                    <p className="text-xs text-slate-500 mt-1">A client secret is already stored. Only fill this in to replace it.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Additional OAuth Scopes</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder="e.g. groups"
                    value={config.additionalScopes || ''}
                    onChange={(e) => handleConfigChange('additionalScopes', e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Space-separated scopes to request in addition to openid/profile/email. Some providers require an extra scope to include security group membership in the token.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Groups Claim Name</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder="groups"
                    value={config.groupsClaim || ''}
                    onChange={(e) => handleConfigChange('groupsClaim', e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Name of the ID token claim containing the user's security groups. Defaults to "groups".</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Default Role for Unmapped Users</label>
                  <select
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={config.defaultRole || 'auditor'}
                    onChange={(e) => handleConfigChange('defaultRole', e.target.value)}
                  >
                    {MAPPABLE_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Role assigned to SSO users whose groups don't match any mapping below.</p>
                </div>
              </div>
            ) : null}

            {selectedProvider.type === 'oidc' && (
              <div className="max-w-2xl">
                <label className="block text-sm font-medium text-slate-700 mb-2">Group &rarr; Role Mapping</label>
                <p className="text-xs text-slate-500 mb-3">Map identity provider security group names to AgentRadar roles. On every SSO login, a user's role is recomputed from their current group membership.</p>
                <div className="space-y-2">
                  {roleMappings.map((mapping, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        placeholder="IdP group name, e.g. AgentRadar-Admins"
                        value={mapping.group}
                        onChange={(e) => updateRoleMapping(i, 'group', e.target.value)}
                      />
                      <select
                        className="w-44 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        value={mapping.role}
                        onChange={(e) => updateRoleMapping(i, 'role', e.target.value)}
                      >
                        {MAPPABLE_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeRoleMapping(i)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        aria-label="Remove mapping"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addRoleMapping}
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Plus size={16} /> Add Mapping
                </button>
              </div>
            )}

            {selectedProvider.type !== 'oidc' && (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Entity ID / Issuer</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    placeholder="e.g. https://sts.windows.net/..."
                    value={config.entityId || ''}
                    onChange={(e) => handleConfigChange('entityId', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">IdP Metadata XML</label>
                  <textarea
                    rows={8}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-xs font-mono text-slate-700 outline-none focus:border-indigo-500"
                    placeholder="<?xml version='1.0' encoding='UTF-8'?>..."
                    value={config.metadataXml || ''}
                    onChange={(e) => handleConfigChange('metadataXml', e.target.value)}
                  ></textarea>
                  <p className="text-xs text-slate-500 mt-1">Paste the raw XML metadata from your SAML Identity Provider.</p>
                </div>
              </div>
            )}
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 max-w-2xl">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-800">
                <strong>Callback URL:</strong> Make sure to register the following Redirect URI in your Identity Provider:
                <br />
                <code className="text-xs bg-amber-100 px-1.5 py-0.5 rounded mt-2 inline-block">
                  {window.location.origin}/api/auth/sso/callback
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {saveMessage && (
              <span className={`text-sm font-medium ${saveMessage.includes('Failed') ? 'text-rose-600' : 'text-emerald-600'} flex items-center gap-1.5`}>
                <CheckCircle size={16} /> {saveMessage}
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2 px-5 rounded-lg shadow-sm transition-colors disabled:opacity-70"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
