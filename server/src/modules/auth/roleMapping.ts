import { Role, isValidRole } from "../../rbac/permissions";

export interface RoleMapEntry {
  group: string;
  role: Role;
}

export interface RoleMappingConfig {
  groupsClaim?: string;
  defaultRole?: Role;
  roleMappings?: RoleMapEntry[];
  additionalScopes?: string;
}

export const DEFAULT_GROUPS_CLAIM = "groups";
export const DEFAULT_SSO_ROLE: Role = "auditor";

/**
 * Tie-break order used ONLY when a single SSO user's groups match multiple
 * mapped roles. Not a general RBAC hierarchy (see rbac/permissions.ts).
 */
export const SSO_ROLE_PRECEDENCE: Role[] = [
  "admin",
  "ciso",
  "security_analyst",
  "auditor",
];

export function extractGroups(
  allClaims: Record<string, unknown> | null | undefined,
  groupsClaimName: string = DEFAULT_GROUPS_CLAIM,
): string[] {
  const raw = allClaims?.[groupsClaimName];
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  if (typeof raw === "string") return [raw];
  return [];
}

function normalizedDefaultRole(mapping: RoleMappingConfig): Role {
  return mapping.defaultRole &&
    isValidRole(mapping.defaultRole) &&
    mapping.defaultRole !== "super_admin"
    ? mapping.defaultRole
    : DEFAULT_SSO_ROLE;
}

export function resolveRoleFromGroups(
  userGroups: string[],
  mapping: RoleMappingConfig,
): Role {
  const defaultRole = normalizedDefaultRole(mapping);

  const matched = new Set<Role>();
  for (const entry of mapping.roleMappings ?? []) {
    if (!isValidRole(entry.role) || entry.role === "super_admin") continue;
    if (userGroups.includes(entry.group)) matched.add(entry.role);
  }

  if (matched.size === 0) return defaultRole;
  for (const role of SSO_ROLE_PRECEDENCE) {
    if (matched.has(role)) return role;
  }
  return defaultRole;
}

/** Returns human-readable error strings; an empty array means the config is valid. */
export function validateRoleMappingConfig(raw: any): string[] {
  const errors: string[] = [];
  if (raw == null) return errors;

  if (raw.groupsClaim !== undefined && typeof raw.groupsClaim !== "string") {
    errors.push("groupsClaim must be a string");
  }

  if (
    raw.defaultRole !== undefined &&
    (typeof raw.defaultRole !== "string" ||
      !isValidRole(raw.defaultRole) ||
      raw.defaultRole === "super_admin")
  ) {
    errors.push(
      "defaultRole must be one of: admin, ciso, security_analyst, auditor",
    );
  }

  if (raw.additionalScopes !== undefined && typeof raw.additionalScopes !== "string") {
    errors.push("additionalScopes must be a string");
  }

  if (raw.roleMappings !== undefined) {
    if (!Array.isArray(raw.roleMappings)) {
      errors.push("roleMappings must be an array");
    } else {
      raw.roleMappings.forEach((m: any, i: number) => {
        if (!m || typeof m.group !== "string" || !m.group.trim()) {
          errors.push(`roleMappings[${i}].group must be a non-empty string`);
        }
        if (
          !m ||
          typeof m.role !== "string" ||
          !isValidRole(m.role) ||
          m.role === "super_admin"
        ) {
          errors.push(
            `roleMappings[${i}].role must be one of: admin, ciso, security_analyst, auditor`,
          );
        }
      });
    }
  }

  return errors;
}
