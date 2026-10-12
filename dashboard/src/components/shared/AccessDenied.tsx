import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRoleDisplayName, getDefaultRoute } from '../../lib/permissions';
import useStore from '../../store/useStore';

interface AccessDeniedProps {
  /** The feature/page the user tried to access */
  featureName?: string;
  /** Optional custom message */
  message?: string;
}

export default function AccessDenied({ featureName, message }: AccessDeniedProps) {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const roleLabel = getRoleDisplayName(user?.role);
  const defaultRoute = getDefaultRoute(user?.role);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
            <ShieldOff size={28} className="text-red-400" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-text-primary mb-2 tracking-tight">
          Access Restricted
        </h1>

        {/* Description */}
        <p className="text-[13px] text-text-muted leading-relaxed mb-1">
          {message ?? (
            featureName
              ? `Your role (${roleLabel}) does not have access to ${featureName}.`
              : `Your role (${roleLabel}) does not have access to this page.`
          )}
        </p>
        <p className="text-[12px] text-text-ghost mb-6">
          Contact your administrator if you believe this is an error.
        </p>

        {/* Role badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass-white border border-glass-border text-[11px] font-semibold text-text-secondary mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
          Signed in as <span className="text-brand font-bold">{roleLabel}</span>
        </div>

        {/* Back button */}
        <div>
          <button
            onClick={() => navigate(defaultRoute)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-r10 bg-brand text-white text-[12px] font-semibold hover:bg-brand-2 transition-colors shadow-brand-glow"
          >
            <ArrowLeft size={14} />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
