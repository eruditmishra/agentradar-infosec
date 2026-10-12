/**
 * Agent Radar — RBAC Permission Registry
 *
 * Architecture:
 *   User → Assigned Role → Explicit Feature Permissions → Allowed Actions
 *
 * Roles are NOT hierarchical. Every permission is explicitly assigned.
 * Do not add implicit inheritance between roles.
 *
 * To add a new resource or action: extend the types below and add entries
 * to ROLE_PERMISSIONS for each role that should have access.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role =
  "super_admin" | "admin" | "ciso" | "security_analyst" | "auditor";

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

export interface Permission {
  resource: Resource;
  actions: Action[];
}

// ─── Permission Registry ──────────────────────────────────────────────────────

/**
 * Explicit permission assignments per role.
 * No role inherits from another. Add permissions here only if explicitly required.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // ─── Super Admin ─────────────────────────────────────────────────────────
  // Full access to all features. The only role allowed to log in directly.
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

  // ─── Admin ───────────────────────────────────────────────────────────────
  // Platform administration. Authenticates via SSO only.
  // Can request approvals but cannot approve them (CISO/Super Admin approve).
  admin: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view", "manage", "update"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents", actions: ["view"] },
    { resource: "models", actions: ["view", "manage", "update"] },
    { resource: "integrations", actions: ["view", "manage"] },
    // sso_config: NOT accessible by admin
    {
      resource: "auto_discovery_config",
      actions: ["view", "configure", "enable", "disable"],
    },
    { resource: "discovery_results", actions: ["view"] },
    { resource: "user_management", actions: ["view", "create", "update"] },
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    { resource: "scanning", actions: ["view", "manage"] },
    // manual_approval: NOT accessible by admin
    { resource: "assessments", actions: ["view"] },
  ],

  // ─── CISO ────────────────────────────────────────────────────────────────
  // Security leadership. Read-heavy visibility across all areas. SSO only.
  ciso: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view", "approve"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents", actions: ["view"] },
    { resource: "models", actions: ["view", "approve"] },
    { resource: "integrations", actions: ["view"] },
    // sso_config: NOT accessible by CISO
    // auto_discovery_config: NOT accessible by CISO
    { resource: "discovery_results", actions: ["view"] },
    // user_management: NOT accessible by CISO
    // audit_logs (platform): NOT accessible by CISO
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    // scanning: NOT accessible by CISO
    // manual_approval: NOT accessible by CISO
    { resource: "assessments", actions: ["view"] },
  ],

  // ─── Security Analyst ────────────────────────────────────────────────────
  // Day-to-day security operations. SSO only.
  // Can request approvals for agents and models (CISO/Admin approve).
  security_analyst: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view", "update"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents", actions: ["view"] },
    { resource: "models", actions: ["view", "update"] },
    { resource: "integrations", actions: ["view"] },
    // sso_config: NOT accessible by security_analyst
    // auto_discovery_config: NOT accessible by security_analyst
    { resource: "discovery_results", actions: ["view"] },
    { resource: "user_management", actions: ["view", "create", "update"] },
    { resource: "agent_audit_logs", actions: ["view"] },
    { resource: "scanning", actions: ["view"] },
    // manual_approval: NOT accessible by security_analyst
    { resource: "assessments", actions: ["view"] },
  ],

  // ─── Auditor ─────────────────────────────────────────────────────────────
  // Compliance and audit review. Read-only with export on logs. SSO only.
  // Cannot request approvals or take any approval actions.
  auditor: [
    { resource: "dashboard", actions: ["view"] },
    { resource: "agents", actions: ["view"] },
    { resource: "shadow_agents", actions: ["view"] },
    { resource: "verified_agents", actions: ["view"] },
    { resource: "models", actions: ["view"] },
    { resource: "integrations", actions: ["view"] },
    // sso_config: NOT accessible by auditor
    // auto_discovery_config: NOT accessible by auditor
    { resource: "discovery_results", actions: ["view"] },
    // user_management: NOT accessible by auditor
    { resource: "agent_audit_logs", actions: ["view", "export"] },
    // scanning: NOT accessible by auditor
    // manual_approval: NOT accessible by auditor
    { resource: "assessments", actions: ["view"] },
  ],
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check whether a given role has a specific permission.
 *
 * @example
 *   hasPermission("admin", "auto_discovery_config", "configure") // true
 *   hasPermission("auditor", "sso_config", "view")               // false
 */
export function hasPermission(
  role: Role | string,
  resource: Resource,
  action: Action,
): boolean {
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return false;
  const perm = permissions.find((p) => p.resource === resource);
  if (!perm) return false;
  return perm.actions.includes(action);
}

/**
 * Get all resources a role can access, for UI filtering.
 */
export function getAccessibleResources(role: Role | string): Resource[] {
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return [];
  return permissions.map((p) => p.resource);
}

/**
 * Get all allowed actions for a specific resource + role combination.
 */
export function getAllowedActions(
  role: Role | string,
  resource: Resource,
): Action[] {
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return [];
  const perm = permissions.find((p) => p.resource === resource);
  return perm?.actions ?? [];
}

/**
 * Validate that a given string is a known Role.
 */
export function isValidRole(role: string): role is Role {
  return role in ROLE_PERMISSIONS;
}

/**
 * Roles that are allowed to authenticate via direct username/password login.
 * All other roles must use SSO exclusively.
 */
export const DIRECT_LOGIN_ROLES: Role[] = ["super_admin"];

/**
 * Roles that must authenticate via SSO. Direct login is blocked for these.
 */
export const SSO_ONLY_ROLES: Role[] = [
  "admin",
  "ciso",
  "security_analyst",
  "auditor",
];
