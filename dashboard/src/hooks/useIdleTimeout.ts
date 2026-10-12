import { useEffect, useCallback, useRef, useState } from 'react';
import { authAPI } from '../lib/api';

/** Total inactivity window before automatic sign-out */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** How long before sign-out the warning dialog appears */
export const IDLE_WARNING_MS = 60 * 1000; // show warning 1 min before sign-out

/** Events that count as "user activity" */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'click', 'scroll', 'touchstart'] as const;

export interface IdleTimeoutState {
  /** Whether the warning dialog should be visible */
  showWarning: boolean;
  /** Seconds remaining until auto-logout (counts down from IDLE_WARNING_MS/1000) */
  secondsLeft: number;
  /** Call to dismiss the warning and reset the idle timer */
  stayLoggedIn: () => void;
}

/**
 * Tracks user inactivity and returns warning-dialog state.
 *
 * - After (IDLE_TIMEOUT_MS − IDLE_WARNING_MS) of inactivity a warning modal
 *   appears with a live countdown.
 * - If the user doesn't interact within IDLE_WARNING_MS they are logged out.
 * - Any real interaction (mouse/keyboard/scroll/touch) resets the clock and
 *   hides the warning automatically — UNLESS the warning is already visible,
 *   in which case the user must click "Stay Logged In" explicitly.
 */
export default function useIdleTimeout(enabled: boolean): IdleTimeoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(IDLE_WARNING_MS / 1000));

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const showWarningRef  = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current)  clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current)   clearTimeout(logoutTimerRef.current);
    if (countdownRef.current)     clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current  = null;
    countdownRef.current    = null;
  }, []);

  const doLogout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    showWarningRef.current = false;
    authAPI.logout().finally(() => {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    });
  }, [clearAllTimers]);

  const startCountdown = useCallback(() => {
    setSecondsLeft(Math.floor(IDLE_WARNING_MS / 1000));
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const resetTimer = useCallback(() => {
    clearAllTimers();

    if (showWarningRef.current) {
      setShowWarning(false);
      showWarningRef.current = false;
    }
    setSecondsLeft(Math.floor(IDLE_WARNING_MS / 1000));

    // Phase 1: after (IDLE_TIMEOUT_MS - IDLE_WARNING_MS) of idle → show warning
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      showWarningRef.current = true;
      startCountdown();

      // Phase 2: after another IDLE_WARNING_MS → log out
      logoutTimerRef.current = setTimeout(doLogout, IDLE_WARNING_MS);
    }, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
  }, [clearAllTimers, doLogout, startCountdown]);

  const stayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      showWarningRef.current = false;
      return;
    }

    resetTimer();

    const handleActivity = () => {
      // While the warning is showing, ignore passive activity —
      // the user must explicitly click "Stay Logged In".
      if (!showWarningRef.current) {
        resetTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, resetTimer, clearAllTimers]);

  return { showWarning, secondsLeft, stayLoggedIn };
}
