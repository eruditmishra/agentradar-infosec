import bcrypt from "bcrypt";
import crypto from "node:crypto";
import * as repo from "./users.repo";
import { findUserByEmail, invalidateTokensBefore, revokeAllUserTokens } from "../auth/auth.repo";
import * as mfaService from "../auth/mfa.service";

export async function listUsers(tenantId: string | null) {
  return repo.listUsers(tenantId);
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(8).toString("hex") + "A1!"; // ensure requirements are met implicitly if any
}

export async function createUser(
  tenantId: string | null,
  email: string,
  name: string,
  role: string,
  authMethod: string,
  createdBy: string
) {
  const existing = await findUserByEmail(tenantId, email);
  if (existing) {
    throw new Error("USER_ALREADY_EXISTS");
  }

  let tempPassword = null;
  let passwordHash = "sso_no_password";

  if (authMethod === "password") {
    tempPassword = generateTemporaryPassword();
    passwordHash = await bcrypt.hash(tempPassword, 12);
  }

  const user = await repo.createUser(
    tenantId,
    email,
    name,
    role,
    authMethod,
    passwordHash,
    createdBy
  );

  return { user, tempPassword };
}

export async function updateUser(
  id: string,
  tenantId: string | null,
  updates: { name?: string; role?: string }
) {
  const existing = await repo.getUserById(id, tenantId);
  if (!existing) throw new Error("USER_NOT_FOUND");
  if (existing.role === "super_admin" && updates.role && updates.role !== "super_admin") {
    throw new Error("CANNOT_DEMOTE_SUPER_ADMIN");
  }

  return repo.updateUser(id, tenantId, updates);
}

export async function setStatus(id: string, tenantId: string | null, isActive: boolean) {
  const existing = await repo.getUserById(id, tenantId);
  if (!existing) throw new Error("USER_NOT_FOUND");
  if (existing.role === "super_admin" && !isActive) {
    throw new Error("CANNOT_DEACTIVATE_SUPER_ADMIN");
  }
  const result = await repo.setUserStatus(id, tenantId, isActive);

  if (!isActive) {
    // Deactivation must take effect immediately, not just on next login:
    // revoke refresh tokens and invalidate any access token already issued.
    await revokeAllUserTokens(id);
    await invalidateTokensBefore(id, new Date());
  }

  return result;
}

export async function resetPassword(id: string, tenantId: string | null) {
  const existing = await repo.getUserById(id, tenantId);
  if (!existing) throw new Error("USER_NOT_FOUND");
  if (existing.auth_method !== "password") {
    throw new Error("NOT_PASSWORD_AUTH_METHOD");
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  
  await repo.updatePasswordHash(id, tenantId, passwordHash);
  
  return tempPassword;
}

export async function setMfaRequirement(id: string, tenantId: string | null, enabled: boolean) {
  const existing = await repo.getUserById(id, tenantId);
  if (!existing) throw new Error("USER_NOT_FOUND");
  if (existing.auth_method !== "password") {
    throw new Error("NOT_PASSWORD_AUTH_METHOD");
  }
  if (existing.role === "super_admin" && !enabled) {
    throw new Error("CANNOT_DISABLE_SUPER_ADMIN_MFA");
  }

  if (enabled) {
    // Flags the account as requiring MFA — the user completes enrollment
    // (QR + confirm) themselves on their next login, same as super_admin.
    await mfaService.requireMfaSetup(id);
  } else {
    await mfaService.disableMfa(id);
  }

  return repo.getUserById(id, tenantId);
}

export async function deleteUser(id: string, tenantId: string | null) {
  const existing = await repo.getUserById(id, tenantId);
  if (!existing) throw new Error("USER_NOT_FOUND");
  if (existing.role === "super_admin") {
    throw new Error("CANNOT_DELETE_SUPER_ADMIN");
  }
  
  return repo.deleteUser(id, tenantId);
}
