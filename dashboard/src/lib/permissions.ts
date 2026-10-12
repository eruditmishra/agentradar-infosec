/**
 * Agent Radar — Frontend Permission Registry
 *
 * This mirrors the backend ROLE_PERMISSIONS in server/src/rbac/permissions.ts.
 * Keep these two in sync when adding new roles, resources, or actions.
 *
 * Used by:
 *   - usePermission() hook for component-level gating
 *   - Sidebar for nav item visibility
 *   - ProtectedRoute for route-level access control
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role =
  | "super_admin"
  | "admin"
  | "ciso"
  | "security_analyst"
  | "auditor";

export type Resource =
  | "dashboard"
  | "agents"
  | "shadow_agents"
  | "verified_agents"
  | "models"
  | "integrations"
  | "sso_config"
  | "auto_discovery_config"
  | "discovery_results"
  | "user_management"
  | "agent_audit_logs"
  | "scanning"
  | "manual_approval"
  | "assessments";

export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "configure"
  | "enable"
  | "disable"
  | "approve"
  | "classify"
  | "manage"
  | "export"
  | "invite";

export type Permission = {
  resource: Resource;
  actions: Action[];
};

// ─── Permission Registry ──────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    { resource: "dashboard", actions: ["view"] },
    {
      resource: "agents",
      actions: [
        "view",
        "manage",
        "approve",
        "classify",
        "create",
        "update",
        "delete",
      ],
    },
    {
      resource: "shadow_agents",
      actions: ["view", "approve", "manage", "delete"],
    },
    { resource: "verified_agents", actions: ["view", "manage", "delete"] },
    {
      resource: "models",
      actions: ["view", "manage", "classify", "update", "delete", "approve"],
    },
    {
      resource: "integrations",
      actions: ["view", "create", "update", "delete", "manage"],
    },
    {
      resource: "sso_config",
      actions: ["view", "create", "update", "delete", "configure"],
    },
    {
      resource: "auto_discovery_config",
      actions: ["view", "configure", "enable", "disable"],
    },
    { resource: "discovery_results", actions: ["view", "export"] },
    {
      resource: "user_management",
      actions: ["view", "create", "update", "delete", "invite"],
    },
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    { resource: "scanning", actions: ["view", "manage"] },
    { resource: "manual_approval", actions: ["approve"] },
    { resource: "assessments", actions: ["view"] },
  ],

  admin: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view", "manage", "update"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents",       actions: ["view"] },
    { resource: "models",                actions: ["view", "manage", "update"] },
    { resource: "integrations",          actions: ["view", "manage"] },
    {
      resource: "auto_discovery_config",
      actions: ["view", "configure", "enable", "disable"],
    },
    { resource: "discovery_results", actions: ["view"] },
    { resource: "user_management", actions: ["view", "create", "update"] },
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    { resource: "scanning", actions: ["view", "manage"] },
    { resource: "assessments", actions: ["view"] },
  ],

  ciso: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view", "approve"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents", actions: ["view"] },
    { resource: "models", actions: ["view", "approve"] },
    { resource: "integrations", actions: ["view"] },
    { resource: "discovery_results", actions: ["view"] },
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    { resource: "assessments", actions: ["view"] },
  ],

  security_analyst: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view", "update"] },
    { resource: "shadow_agents",         actions: ["view"] },
    { resource: "verified_agents",       actions: ["view"] },
    { resource: "models",                actions: ["view", "update"] },
    { resource: "integrations",          actions: ["view"] },
    { resource: "discovery_results", actions: ["view"] },
    { resource: "user_management", actions: ["view", "create", "update"] },
    { resource: "agent_audit_logs", actions: ["view"] },
    { resource: "scanning", actions: ["view"] },
    { resource: "assessments", actions: ["view"] },
  ],

  auditor: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents", actions: ["view"] },
    { resource: "models", actions: ["view"] },
    { resource: "integrations", actions: ["view"] },
    { resource: "discovery_results", actions: ["view"] },
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    { resource: "assessments", actions: ["view"] },
  ],
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check whether a given role has permission for the specified resource + action.
 *
 * @example
 *   hasPermission("admin", "auto_discovery_config", "configure") // true
 *   hasPermission("auditor", "sso_config", "view")               // false
 */
export function hasPermission(
  role: string | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return false;
  const perm = permissions.find((p) => p.resource === resource);
  if (!perm) return false;
  return perm.actions.includes(action);
}

/**
 * Get all resources a role can access, for nav filtering.
 */
export function getAccessibleResources(
  role: string | null | undefined,
): Resource[] {
  if (!role) return [];
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return [];
  return permissions.map((p) => p.resource);
}

/**
 * Get the default dashboard route for a given role.
 * Used for post-login redirects.
 */
export function getDefaultRoute(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "/dashboard";
    case "admin":
      return "/dashboard";
    case "ciso":
      return "/dashboard";
    case "security_analyst":
      return "/dashboard";
    case "auditor":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

/**
 * Get a human-readable display name for a role.
 */
export function getRoleDisplayName(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "ciso":
      return "CISO";
    case "security_analyst":
      return "Security Analyst";
    case "auditor":
      return "Auditor";
    default:
      return role ?? "Unknown";
  }
}

/**
 * Roles that can use direct username/password login.
 */
export const DIRECT_LOGIN_ROLES: Role[] = ["super_admin"];

/**
 * Roles that must authenticate via SSO only.
 */
export const SSO_ONLY_ROLES: Role[] = [
  "admin",
  "ciso",
  "security_analyst",
  "auditor",
];
