import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../lib/api';
import { getAuthEpoch, bumpAuthEpoch } from '../lib/authEpoch';

interface User {
  email: string;
  role: string;
  name: string;
  /** Authentication method used — determines login restrictions */
  authMethod?: 'password' | 'sso' | 'microsoft';
  /** Whether MFA is required for this account (super_admin, or opted-in via IAM) */
  mfaEnabled?: boolean;
  /** Whether this account has completed TOTP enrollment (has a confirmed secret + backup codes) */
  mfaEnrolled?: boolean;
  /** Whether Platform-Level MFA has been verified for THIS session/token */
  mfaVerified?: boolean;
  [key: string]: any;
}

interface AppState {
  user: User | null;
  isLoggedIn: boolean;
  /** True once credentials are verified but MFA setup/challenge is still outstanding for this session */
  mfaPending: boolean;
  login: (user: User) => void;
  completeMfa: () => void;
  logout: () => void;
  clearSession: () => void;
  checkSession: () => Promise<void>;
}

function needsMfa(user: User): boolean {
  return !!user.mfaEnabled && !user.mfaVerified;
}

const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      mfaPending: false,

      clearSession: () => {
        bumpAuthEpoch();
        set({ user: null, isLoggedIn: false, mfaPending: false });
      },

      login: (userData: User) => {
        bumpAuthEpoch();
        if (needsMfa(userData)) {
          set({ user: userData, isLoggedIn: false, mfaPending: true });
        } else {
          set({ user: userData, isLoggedIn: true, mfaPending: false });
        }
      },

      completeMfa: () => {
        set((state) => ({
          user: state.user ? { ...state.user, mfaVerified: true } : state.user,
          isLoggedIn: true,
          mfaPending: false,
        }));
      },

      logout: async () => {
        bumpAuthEpoch();
        try {
          await authAPI.logout();
        } catch (e) {
          console.error('Logout failed', e);
        }
        set({ user: null, isLoggedIn: false, mfaPending: false });
      },

      checkSession: async () => {
        const epochAtStart = getAuthEpoch();
        try {
          const res = await authAPI.me();
          if (getAuthEpoch() !== epochAtStart) return; // superseded by a login/logout since this request started
          if (res.data?.user) {
            const userData = res.data.user as User;
            if (needsMfa(userData)) {
              set({ user: userData, isLoggedIn: false, mfaPending: true });
            } else {
              set({ user: userData, isLoggedIn: true, mfaPending: false });
            }
          } else {
            set({ user: null, isLoggedIn: false, mfaPending: false });
          }
        } catch (e) {
          if (getAuthEpoch() !== epochAtStart) return;
          set({ user: null, isLoggedIn: false, mfaPending: false });
        }
      },
    }),
    {
      name: 'agentradar-store',
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        mfaPending: state.mfaPending,
      }),
    }
  )
);

export default useStore;

if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useStore.getState().clearSession();
  });
}
