import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useStore from '../../store/useStore';
import { authAPI } from '../../lib/api';

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}


export default function LoginScreen() {
  const login = useStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customSso, setCustomSso] = useState<{ providerId: string; providerType: string } | null>(null);

  useEffect(() => {
    async function fetchSso() {
      try {
        const res = await authAPI.getPublicSSOConfig();
        if (res.data?.sso) {
          setCustomSso(res.data.sso);
        }
      } catch {
        // Ignore — SSO config is optional
      }
    }
    fetchSso();
  }, []);

  useEffect(() => {
    const ssoError = searchParams.get('error');
    if (ssoError === 'sso_failed') {
      setError('SSO sign-in failed. Please try again or contact your administrator.');
    } else if (ssoError === 'sso_not_configured') {
      setError('SSO is not configured on this server. Please contact your administrator.');
    } else if (ssoError === 'sso_unauthorized') {
      setError('You are not authorized to use Microsoft SSO. Super Admin accounts must use direct login.');
    } else if (ssoError === 'sso_superadmin_blocked') {
      setError('Super Admin accounts cannot authenticate via SSO. Please use the email and password form below.');
    }
  }, [searchParams]);

  async function doSuperAdminLogin() {
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.login(email, password);
      const userData = res.data?.user || { email, name: email.split('@')[0] };
      login(userData);
      // If MFA is required (mfaEnabled && !mfaVerified), the store puts us into
      // mfaPending state and App.tsx renders MfaGate instead of the router —
      // this navigate is only meaningful when MFA isn't pending.
      if (!userData.mfaEnabled || userData.mfaVerified) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0]?.message ||
        'Login failed.';

      if (msg.includes('Direct login is restricted') || msg === 'DIRECT_LOGIN_NOT_ALLOWED') {
        setError(
          'Direct login is only available for Super Admin. If you are not a Super Admin, please use your organization\'s SSO above.',
        );
      } else if (msg === 'SSO_ACCOUNT_NO_PASSWORD') {
        setError('This account uses SSO authentication. Please use the SSO button above.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function doMicrosoftLogin() {
    window.location.href = '/api/auth/microsoft';
  }

  function doCustomSsoLogin() {
    window.location.href = '/api/auth/sso/login';
  }

  const getSsoButtonStyle = () => {
    if (!customSso) return { bg: '', text: '' };
    switch (customSso.providerId) {
      case 'okta':     return { bg: 'bg-[#007DC1] hover:bg-[#005a8c]', text: 'Continue with Okta' };
      case 'auth0':    return { bg: 'bg-[#EB5424] hover:bg-[#c4451c]', text: 'Continue with Auth0' };
      case 'google':   return { bg: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50', text: 'Continue with Google Workspace' };
      case 'ping':     return { bg: 'bg-[#293238] hover:bg-[#1a2024]', text: 'Continue with PingFederate' };
      case 'keycloak': return { bg: 'bg-[#0089C9] hover:bg-[#006e9f]', text: 'Continue with Keycloak' };
      case 'onelogin': return { bg: 'bg-[#18315B] hover:bg-[#102240]', text: 'Continue with OneLogin' };
      default:         return { bg: 'bg-slate-800 hover:bg-slate-900', text: 'Continue with SSO' };
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-root relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-bg to-purple-bg opacity-50 pointer-events-none animate-mesh-drift" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass rounded-r20 p-8">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-r10 bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center shadow-brand-glow">
              <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.2" fill="white" />
                <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1" strokeDasharray="2 1.5" />
                <circle cx="2" cy="7" r="1" fill="white" opacity=".6" />
                <circle cx="12" cy="7" r="1" fill="white" opacity=".6" />
              </svg>
            </div>
            <div>
              <div className="font-display text-xl font-bold text-text-primary tracking-tight">
                AgentRadar
              </div>
            </div>
          </div>
          <div className="text-[13px] text-text-muted mb-6 leading-relaxed">
            AI Governance Platform — sign in to continue
          </div>

          {/* ── SSO Section ─── */}
          <div className="mb-5">
            <div className="text-[10px] font-extrabold text-text-ghost tracking-widest uppercase mb-3">
              Single Sign-On
            </div>

            {/* Custom SSO (Okta, Auth0, etc.) */}
            {customSso && (() => {
              const style = getSsoButtonStyle();
              return (
                <button
                  id="custom-sso-btn"
                  onClick={doCustomSsoLogin}
                  className={`w-full flex items-center justify-center gap-3 ${style.bg} ${style.bg.includes('text-slate-700') ? '' : 'text-white'} font-semibold py-2.5 rounded-r10 transition-colors shadow-sm mb-2 text-[13px]`}
                >
                  {style.text}
                </button>
              );
            })()}

            {/* Microsoft SSO */}
            <button
              id="microsoft-sso-btn"
              onClick={doMicrosoftLogin}
              className={`w-full flex items-center justify-center gap-3 ${customSso ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white'} font-semibold py-2.5 rounded-r10 transition-colors shadow-sm text-[13px]`}
            >
              <MicrosoftLogo />
              Continue with Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-glass-border-dim" />
            <span className="text-[11px] text-text-ghost font-medium uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-glass-border-dim" />
          </div>

          {/* ── Direct Login ──────────────────────────────────── */}
          <div className="bg-white/50 border border-glass-border rounded-r10 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold text-text-secondary tracking-wide uppercase">
                Direct Sign-In
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Email</label>
              <input
                className="w-full bg-white/70 border border-glass-border-dim rounded-r10 px-3 py-2 text-[12px] text-text-primary outline-none transition-all focus:bg-white focus:border-brand-border focus:ring-3 focus:ring-brand-glow"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@company.com"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Password</label>
              <input
                className="w-full bg-white/70 border border-glass-border-dim rounded-r10 px-3 py-2 text-[12px] text-text-primary outline-none transition-all focus:bg-white focus:border-brand-border focus:ring-3 focus:ring-brand-glow"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSuperAdminLogin()}
                placeholder="Password"
              />
            </div>

            <button
              id="super-admin-login-btn"
              className="w-full bg-brand hover:bg-brand-2 text-white font-medium py-2.5 rounded-r10 transition-colors shadow-brand-glow disabled:opacity-70 text-[13px]"
              onClick={doSuperAdminLogin}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 leading-relaxed">
              {error}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
