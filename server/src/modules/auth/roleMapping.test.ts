import { describe, it, expect } from "vitest";
import {
  extractGroups,
  resolveRoleFromGroups,
  validateRoleMappingConfig,
} from "./roleMapping";

describe("extractGroups", () => {
  it("returns the array as-is when the claim is a string array", () => {
    expect(extractGroups({ groups: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("wraps a single string claim in an array", () => {
    expect(extractGroups({ groups: "a" })).toEqual(["a"]);
  });

  it("returns an empty array when the claim is missing", () => {
    expect(extractGroups({})).toEqual([]);
    expect(extractGroups(null)).toEqual([]);
    expect(extractGroups(undefined)).toEqual([]);
  });

  it("filters out non-string entries from an array claim", () => {
    expect(extractGroups({ groups: ["a", 1, null, "b"] })).toEqual(["a", "b"]);
  });

  it("returns an empty array for a malformed (non-string, non-array) claim", () => {
    expect(extractGroups({ groups: 42 })).toEqual([]);
  });

  it("respects a custom claim name", () => {
    expect(extractGroups({ roles: ["x"] }, "roles")).toEqual(["x"]);
  });
});

describe("resolveRoleFromGroups", () => {
  it("returns the default role when no groups match", () => {
    const role = resolveRoleFromGroups(["unmapped-group"], {
      defaultRole: "security_analyst",
      roleMappings: [{ group: "AgentRadar-Admins", role: "admin" }],
    });
    expect(role).toBe("security_analyst");
  });

  it("falls back to auditor when defaultRole is unset", () => {
    const role = resolveRoleFromGroups([], {});
    expect(role).toBe("auditor");
  });

  it("falls back to auditor when defaultRole is invalid", () => {
    const role = resolveRoleFromGroups([], { defaultRole: "not-a-role" as any });
    expect(role).toBe("auditor");
  });

  it("resolves a single matching group", () => {
    const role = resolveRoleFromGroups(["AgentRadar-CISOs"], {
      roleMappings: [{ group: "AgentRadar-CISOs", role: "ciso" }],
    });
    expect(role).toBe("ciso");
  });

  it("picks the most-privileged role when multiple groups match", () => {
    const role = resolveRoleFromGroups(["Auditors", "Admins"], {
      roleMappings: [
        { group: "Auditors", role: "auditor" },
        { group: "Admins", role: "admin" },
      ],
    });
    expect(role).toBe("admin");
  });

  it("ignores role mapping entries that target super_admin", () => {
    const role = resolveRoleFromGroups(["Everyone"], {
      defaultRole: "auditor",
      roleMappings: [{ group: "Everyone", role: "super_admin" as any }],
    });
    expect(role).toBe("auditor");
  });

  it("ignores defaultRole of super_admin", () => {
    const role = resolveRoleFromGroups([], { defaultRole: "super_admin" as any });
    expect(role).toBe("auditor");
  });
});

describe("validateRoleMappingConfig", () => {
  it("accepts a null/undefined config", () => {
    expect(validateRoleMappingConfig(null)).toEqual([]);
    expect(validateRoleMappingConfig(undefined)).toEqual([]);
  });

  it("accepts a fully valid config", () => {
    const errors = validateRoleMappingConfig({
      groupsClaim: "groups",
      defaultRole: "auditor",
      additionalScopes: "groups",
      roleMappings: [{ group: "AgentRadar-Admins", role: "admin" }],
    });
    expect(errors).toEqual([]);
  });

  it("rejects a non-string groupsClaim", () => {
    expect(validateRoleMappingConfig({ groupsClaim: 123 }).length).toBeGreaterThan(0);
  });

  it("rejects an invalid defaultRole", () => {
    expect(validateRoleMappingConfig({ defaultRole: "not-a-role" }).length).toBeGreaterThan(0);
  });

  it("rejects super_admin as a defaultRole", () => {
    expect(validateRoleMappingConfig({ defaultRole: "super_admin" }).length).toBeGreaterThan(0);
  });

  it("rejects a non-array roleMappings", () => {
    expect(validateRoleMappingConfig({ roleMappings: "nope" }).length).toBeGreaterThan(0);
  });

  it("rejects a mapping entry with an empty group name", () => {
    const errors = validateRoleMappingConfig({ roleMappings: [{ group: "  ", role: "admin" }] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a mapping entry with an invalid role", () => {
    const errors = validateRoleMappingConfig({ roleMappings: [{ group: "g", role: "bogus" }] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a mapping entry targeting super_admin", () => {
    const errors = validateRoleMappingConfig({ roleMappings: [{ group: "g", role: "super_admin" }] });
    expect(errors.length).toBeGreaterThan(0);
  });
});
