/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Fonts ──────────────────────────────────────────────
      fontFamily: {
        display: ["'Bricolage Grotesque'", 'sans-serif'],
        body: ["'Plus Jakarta Sans'", 'sans-serif'],
      },

      // ── Brand Colors ───────────────────────────────────────
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          2: '#8b5cf6',
          glow: 'rgba(99,102,241,0.20)',
          bg: 'rgba(99,102,241,0.08)',
          border: 'rgba(99,102,241,0.25)',
        },
        // Glass surfaces
        glass: {
          white: 'rgba(255,255,255,0.72)',
          'white-hov': 'rgba(255,255,255,0.88)',
          border: 'rgba(255,255,255,0.9)',
          'border-dim': 'rgba(200,210,240,0.5)',
        },
        // Background mesh
        bg: {
          root: '#f0f2f8',
          'mesh-1': '#e8eeff',
          'mesh-2': '#f5eeff',
          'mesh-3': '#eefbff',
        },
        // Semantic: Red
        red: {
          DEFAULT: '#ef4444',
          bg: 'rgba(239,68,68,0.08)',
          border: 'rgba(239,68,68,0.20)',
          text: '#dc2626',
        },
        // Semantic: Amber
        amber: {
          DEFAULT: '#f59e0b',
          bg: 'rgba(245,158,11,0.08)',
          border: 'rgba(245,158,11,0.22)',
          text: '#d97706',
        },
        // Semantic: Green
        green: {
          DEFAULT: '#10b981',
          bg: 'rgba(16,185,129,0.08)',
          border: 'rgba(16,185,129,0.22)',
          text: '#059669',
        },
        // Semantic: Blue
        blue: {
          DEFAULT: '#3b82f6',
          bg: 'rgba(59,130,246,0.08)',
          border: 'rgba(59,130,246,0.22)',
        },
        // Semantic: Purple
        purple: {
          DEFAULT: '#8b5cf6',
          bg: 'rgba(139,92,246,0.08)',
          border: 'rgba(139,92,246,0.22)',
        },
        // Text
        text: {
          primary: '#0f1117',
          secondary: '#4b5563',
          muted: '#9ca3af',
          ghost: '#c4cce0',
          white: '#ffffff'
        },
      },

      // ── Border Radius ──────────────────────────────────────
      borderRadius: {
        r6: '6px',
        r8: '8px',
        r10: '10px',
        r12: '12px',
        r16: '16px',
        r20: '20px',
        r24: '24px',
      },

      // ── Box Shadows (glassmorphism) ────────────────────────
      boxShadow: {
        glass: '0 4px 24px rgba(100,120,200,0.10), 0 1px 4px rgba(100,120,200,0.08)',
        'glass-hov': '0 8px 40px rgba(100,120,200,0.16), 0 2px 8px rgba(100,120,200,0.10)',
        'glass-lg': '0 16px 64px rgba(80,100,180,0.18), 0 4px 16px rgba(80,100,180,0.10)',
        'brand-glow': '0 4px 12px rgba(99,102,241,0.35)',
        'brand-glow-hov': '0 6px 20px rgba(99,102,241,0.45)',
      },

      // ── Sidebar Width ──────────────────────────────────────
      width: {
        sidebar: '248px',
      },
      minWidth: {
        sidebar: '248px',
      },

      // ── Animations ─────────────────────────────────────────
      keyframes: {
        'mesh-drift': {
          '0%': { backgroundPosition: '0% 0%, 100% 0%, 50% 100%, 100% 100%, center' },
          '100%': { backgroundPosition: '5% 5%, 95% 5%, 45% 95%, 95% 95%, center' },
        },
        'view-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'live-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(16,185,129,0)' },
        },
        'shadow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'mesh-drift': 'mesh-drift 20s ease-in-out infinite alternate',
        'view-in': 'view-in 0.25s cubic-bezier(0.4,0,0.2,1)',
        'live-pulse': 'live-pulse 2s ease-in-out infinite',
        'shadow-pulse': 'shadow-pulse 2.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
      },

      // ── Backdrop blur ──────────────────────────────────────
      backdropBlur: {
        glass: '24px',
        topbar: '20px',
      },
    },
  },
  plugins: [],
}
