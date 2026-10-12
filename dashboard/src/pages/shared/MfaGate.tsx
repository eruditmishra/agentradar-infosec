import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Copy, Check } from 'lucide-react';
import useStore from '../../store/useStore';
import { authAPI } from '../../lib/api';

/**
 * Rendered instead of the dashboard whenever the current session is
 * authenticated but not yet MFA-verified (see useStore's `mfaPending`).
 *
 * Two modes, driven by the user's `mfaEnrolled` flag from /auth/me:
 *  - Setup:     first time MFA is required — show QR, confirm a code, show backup codes once.
 *  - Challenge: already enrolled — just ask for the next 6-digit code (or a backup code).
 */
export default function MfaGate() {
  const user = useStore((s) => s.user);
  const completeMfa = useStore((s) => s.completeMfa);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();

  const isSetupMode = !user?.mfaEnrolled;

  const [loadingQr, setLoadingQr] = useState(isSetupMode);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  useEffect(() => {
    if (!isSetupMode) return;
    (async () => {
      try {
        const res = await authAPI.setupMfa();
        setQrCodeDataUrl(res.data.qrCodeDataUrl);
        setOtpauthUrl(res.data.otpauthUrl);
      } catch {
        setError('Failed to start MFA setup. Please refresh and try again.');
      } finally {
        setLoadingQr(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetupMode]);

  async function handleSubmit() {
    if (!code.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (isSetupMode) {
        const res = await authAPI.confirmMfa(code.trim());
        setBackupCodes(res.data.backupCodes);
      } else {
        await authAPI.verifyMfaChallenge(code.trim());
        completeMfa();
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Incorrect code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function finishSetup() {
    completeMfa();
    navigate('/dashboard');
  }

  function copyBackupCodes() {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-root relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-bg to-purple-bg opacity-50 pointer-events-none animate-mesh-drift" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-glass-white backdrop-blur-glass border border-glass-border shadow-glass rounded-r20 p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-r10 bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center shadow-brand-glow">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-text-primary tracking-tight">
                {backupCodes ? 'Save Your Backup Codes' : isSetupMode ? 'Set Up Two-Factor Authentication' : 'Verify It’s You'}
              </div>
            </div>
          </div>

          {backupCodes ? (
            <>
              <div className="text-[13px] text-text-muted mb-5 leading-relaxed">
                Store these one-time backup codes somewhere safe. Each can be used once to sign in if you lose access to your authenticator app. They won't be shown again.
              </div>
              <div className="bg-white/70 border border-glass-border-dim rounded-r10 p-4 mb-4 grid grid-cols-2 gap-2 font-mono text-[13px] text-text-primary">
                {backupCodes.map((c) => (
                  <div key={c}>{c}</div>
                ))}
              </div>
              <button
                onClick={copyBackupCodes}
                className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-r10 bg-slate-800 hover:bg-slate-900 text-white text-[13px] font-semibold transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Backup Codes'}
              </button>
              <label className="flex items-center gap-2 mb-4 text-[12px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={savedConfirmed}
                  onChange={(e) => setSavedConfirmed(e.target.checked)}
                />
                I've saved these backup codes in a safe place
              </label>
              <button
                id="mfa-setup-done-btn"
                onClick={finishSetup}
                disabled={!savedConfirmed}
                className="w-full bg-brand hover:bg-brand-2 text-white font-medium py-2.5 rounded-r10 transition-colors shadow-brand-glow disabled:opacity-50 text-[13px]"
              >
                Continue to Dashboard
              </button>
            </>
          ) : (
            <>
              {isSetupMode ? (
                <>
                  <div className="text-[13px] text-text-muted mb-5 leading-relaxed">
                    Your account requires two-factor authentication. Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it generates.
                  </div>
                  <div className="flex justify-center mb-5">
                    {loadingQr ? (
                      <div className="w-[180px] h-[180px] flex items-center justify-center text-[12px] text-text-muted">
                        Generating QR code...
                      </div>
                    ) : qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="MFA QR Code" className="w-[180px] h-[180px] rounded-r10 border border-glass-border-dim bg-white p-2" />
                    ) : null}
                  </div>
                  {otpauthUrl && (
                    <details className="mb-5 text-[11px] text-text-muted">
                      <summary className="cursor-pointer select-none">Can't scan the code?</summary>
                      <div className="mt-2 break-all bg-white/60 border border-glass-border-dim rounded-lg p-2 font-mono">
                        {otpauthUrl}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="text-[13px] text-text-muted mb-5 leading-relaxed">
                  Enter the 6-digit code from your authenticator app to continue, or use one of your backup codes.
                </div>
              )}

              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-text-muted mb-1">Verification Code</label>
                <input
                  className="w-full bg-white/70 border border-glass-border-dim rounded-r10 px-3 py-2 text-[14px] tracking-[0.3em] text-text-primary outline-none transition-all focus:bg-white focus:border-brand-border focus:ring-3 focus:ring-brand-glow text-center font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="000000"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <button
                id="mfa-submit-btn"
                onClick={handleSubmit}
                disabled={submitting || !code.trim()}
                className="w-full bg-brand hover:bg-brand-2 text-white font-medium py-2.5 rounded-r10 transition-colors shadow-brand-glow disabled:opacity-70 text-[13px]"
              >
                {submitting ? 'Verifying...' : isSetupMode ? 'Confirm & Enable MFA' : 'Verify'}
              </button>

              {error && (
                <div className="mt-4 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 leading-relaxed">
                  {error}
                </div>
              )}

              <button
                onClick={() => logout()}
                className="w-full mt-4 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                Sign in with a different account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
