import useStore from '../store/useStore';
import { hasPermission, getRoleDisplayName } from '../lib/permissions';
import type { Resource, Action } from '../lib/permissions';

/**
 * Hook to check whether the currently logged-in user has a specific permission.
 *
 * Usage:
 *   const canConfigure = usePermission("auto_discovery_config", "configure");
 *   const canViewUsers = usePermission("user_management", "view");
 *
 * Returns false if the user is not logged in or has no role.
 *
 * @example
 *   // Conditionally render a button
 *   const canApprove = usePermission("manual_approval", "approve");
 *   return canApprove ? <ApproveButton /> : null;
 */
export function usePermission(resource: Resource, action: Action): boolean {
  const role = useStore((s) => s.user?.role);
  return hasPermission(role, resource, action);
}

/**
 * Hook to get the current user's role string.
 */
export function useRole(): string | null {
  return useStore((s) => s.user?.role ?? null);
}

/**
 * Hook to get the current user's role as a human-readable display name.
 */
export function useRoleDisplayName(): string {
  const role = useStore((s) => s.user?.role);
  return getRoleDisplayName(role);
}

/**
 * Hook to check if the user authenticated via direct login (Super Admin only).
 */
export function useIsDirectLogin(): boolean {
  const authMethod = useStore((s) => s.user?.authMethod);
  return authMethod === "password";
}

/**
 * Hook to check if the user authenticated via SSO.
 */
export function useIsSsoUser(): boolean {
  const authMethod = useStore((s) => s.user?.authMethod);
  return authMethod === "sso" || authMethod === "microsoft";
}
