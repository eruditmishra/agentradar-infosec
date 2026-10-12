import { useEffect, useRef } from 'react';
import { IDLE_WARNING_MS } from '../../hooks/useIdleTimeout';

interface IdleWarningModalProps {
  secondsLeft: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

const TOTAL_SECONDS = Math.floor(IDLE_WARNING_MS / 1000);

/**
 * Full-screen overlay shown when the user has been idle for
 * (IDLE_TIMEOUT_MS − IDLE_WARNING_MS). It counts down and auto-logs out
 * unless the user clicks "Stay Logged In".
 */
export default function IdleWarningModal({
  secondsLeft,
  onStayLoggedIn,
  onLogoutNow,
}: IdleWarningModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap focus inside the modal while it's open
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
        }
      }
      if (e.key === 'Escape') onStayLoggedIn();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStayLoggedIn]);

  const pct = (secondsLeft / TOTAL_SECONDS) * 100;
  const circumference = 2 * Math.PI * 28; // r=28
  const dashOffset = circumference * (1 - pct / 100);
  const isUrgent = secondsLeft <= 10;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onStayLoggedIn}
      />

      {/* Card */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1035 50%, #0f0c22 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          boxShadow: '0 0 0 1px rgba(139,92,246,0.1), 0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(139,92,246,0.15)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full transition-all duration-1000"
          style={{
            background: isUrgent
              ? 'linear-gradient(90deg, #ef4444, #f97316)'
              : 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
            width: `${pct}%`,
          }}
        />

        <div className="p-7 flex flex-col items-center gap-5">
          {/* Countdown ring */}
          <div className="relative flex items-center justify-center w-20 h-20">
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 64 64"
            >
              {/* Track */}
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                strokeWidth="4"
                stroke="rgba(139,92,246,0.15)"
              />
              {/* Progress */}
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                strokeWidth="4"
                stroke={isUrgent ? '#ef4444' : '#8b5cf6'}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <span
              className="relative z-10 text-2xl font-bold tabular-nums"
              style={{ color: isUrgent ? '#f87171' : '#c4b5fd' }}
            >
              {secondsLeft}
            </span>
          </div>

          {/* Icon + heading */}
          <div className="text-center space-y-1.5">
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-amber-400 flex-shrink-0"
                viewBox="0 0 24 24" fill="currentColor"
              >
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                />
              </svg>
              <h2
                id="idle-warning-title"
                className="text-base font-semibold text-white"
              >
                Session Expiring Soon
              </h2>
            </div>
            <p
              id="idle-warning-desc"
              className="text-sm leading-relaxed"
              style={{ color: 'rgba(196,181,253,0.8)' }}
            >
              You've been inactive for a while. For your security, you'll be
              automatically signed out in{' '}
              <span className="font-semibold" style={{ color: isUrgent ? '#f87171' : '#a78bfa' }}>
                {secondsLeft} second{secondsLeft !== 1 ? 's' : ''}
              </span>
              .
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 w-full mt-1">
            <button
              id="idle-stay-logged-in"
              onClick={onStayLoggedIn}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-transparent"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 20px rgba(139,92,246,0.35)',
              }}
            >
              Stay Logged In
            </button>

            <button
              id="idle-logout-now"
              onClick={onLogoutNow}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/10 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ color: 'rgba(196,181,253,0.7)', background: 'transparent' }}
            >
              Sign Out Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
