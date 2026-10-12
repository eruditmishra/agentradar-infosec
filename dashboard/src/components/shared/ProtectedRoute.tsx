import { Navigate, Outlet } from 'react-router-dom';
import useStore from '../../store/useStore';
import { hasPermission, getDefaultRoute } from '../../lib/permissions';
import type { Resource, Action } from '../../lib/permissions';
import AccessDenied from './AccessDenied';

interface ProtectedRouteProps {
  /**
   * Permission-based guard. Preferred over allowedRoles for new routes.
   * Renders <AccessDenied /> if the user lacks the required permission.
   */
  requirePermission?: { resource: Resource; action: Action; featureName?: string };
  /**
   * @deprecated Role-list guard. Use requirePermission for new routes.
   * Kept for backward compatibility with existing Super Admin route groups.
   */
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles, requirePermission: permCheck }: ProtectedRouteProps) {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const user = useStore((s) => s.user);
  const role = user?.role;

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // ── Permission-based check (preferred) ───────────────────────────────────
  if (permCheck) {
    if (!hasPermission(role, permCheck.resource, permCheck.action)) {
      return <AccessDenied featureName={permCheck.featureName} />;
    }
    return <Outlet />;
  }

  // ── Role-based check (legacy, for broad route groups) ─────────────────────
  if (allowedRoles) {
    if (!role || !allowedRoles.includes(role)) {
      const defaultRoute = getDefaultRoute(role);
      return <Navigate to={defaultRoute} replace />;
    }
    return <Outlet />;
  }

  // No guard specified — allow any authenticated user
  return <Outlet />;
}
