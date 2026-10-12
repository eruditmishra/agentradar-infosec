import { asyncHandler } from "../../shared/asyncHandler";
import { config } from "../../shared/config";
import { BadRequestError, NotFoundError, ConflictError } from "../../shared/errors";
import { assertSafeText } from "../../shared/sanitize";
import * as usersService from "./users.service";
import * as audit from "../audit/audit.service";

export const listUsersHandler = asyncHandler(async (req, res) => {
  const users = await usersService.listUsers(config.tenantId);
  res.status(200).json({ success: true, users });
});

export const createUserHandler = asyncHandler(async (req, res) => {
  const { email, name, role, authMethod } = req.body;
  if (!email || !name || !role || !authMethod) {
    throw new BadRequestError("Missing required fields");
  }
  assertSafeText(name, "name", { required: true, maxLength: 120 });

  const createdBy = (req as any).user?.sub;

  try {
    const { user, tempPassword } = await usersService.createUser(
      config.tenantId,
      email,
      name,
      role,
      authMethod,
      createdBy
    );

    audit.log({
      tenantId: config.tenantId,
      userId: createdBy,
      userEmail: (req as any).user?.email,
      eventType: "user.create",
      entityType: "user",
      action: "create",
      summary: `User ${email} created with role ${role} and authMethod ${authMethod}`,
    });

    res.status(201).json({ success: true, user, tempPassword });
  } catch (err: any) {
    if (err.message === "USER_ALREADY_EXISTS") {
      throw new ConflictError("A user with this email already exists");
    }
    throw err;
  }
});

export const updateUserHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;
  assertSafeText(name, "name", { maxLength: 120 });

  try {
    const user = await usersService.updateUser(id, config.tenantId, { name, role });
    
    audit.log({
      tenantId: config.tenantId,
      userId: (req as any).user?.sub,
      userEmail: (req as any).user?.email,
      eventType: "user.update",
      entityType: "user",
      action: "update",
      summary: `User ${id} updated`,
    });

    res.status(200).json({ success: true, user });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") throw new NotFoundError("User not found");
    if (err.message === "CANNOT_DEMOTE_SUPER_ADMIN") throw new BadRequestError("Cannot demote Super Admin");
    throw err;
  }
});

export const setStatusHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const user = await usersService.setStatus(id, config.tenantId, isActive);
    
    audit.log({
      tenantId: config.tenantId,
      userId: (req as any).user?.sub,
      userEmail: (req as any).user?.email,
      eventType: isActive ? "user.activate" : "user.deactivate",
      entityType: "user",
      action: "update",
      summary: `User ${id} ${isActive ? 'activated' : 'deactivated'}`,
    });

    res.status(200).json({ success: true, user });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") throw new NotFoundError("User not found");
    if (err.message === "CANNOT_DEACTIVATE_SUPER_ADMIN") throw new BadRequestError("Cannot deactivate Super Admin");
    throw err;
  }
});

export const resetPasswordHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const tempPassword = await usersService.resetPassword(id, config.tenantId);
    
    audit.log({
      tenantId: config.tenantId,
      userId: (req as any).user?.sub,
      userEmail: (req as any).user?.email,
      eventType: "user.reset_password",
      entityType: "user",
      action: "update",
      summary: `Password reset for user ${id}`,
    });

    res.status(200).json({ success: true, tempPassword });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") throw new NotFoundError("User not found");
    if (err.message === "NOT_PASSWORD_AUTH_METHOD") throw new BadRequestError("User does not authenticate with a password");
    throw err;
  }
});

export const setMfaHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    throw new BadRequestError("`enabled` must be a boolean");
  }

  try {
    const user = await usersService.setMfaRequirement(id, config.tenantId, enabled);

    audit.log({
      tenantId: config.tenantId,
      userId: (req as any).user?.sub,
      userEmail: (req as any).user?.email,
      eventType: enabled ? "user.mfa_required" : "user.mfa_disabled",
      entityType: "user",
      action: "update",
      summary: `MFA ${enabled ? "required" : "disabled"} for user ${id}`,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        mfaEnabled: user.mfa_enabled,
        mfaEnrolled: !!user.mfa_enrolled_at,
      },
    });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") throw new NotFoundError("User not found");
    if (err.message === "NOT_PASSWORD_AUTH_METHOD") {
      throw new BadRequestError("MFA only applies to users who authenticate with a password");
    }
    if (err.message === "CANNOT_DISABLE_SUPER_ADMIN_MFA") {
      throw new BadRequestError("MFA cannot be disabled for Super Admin");
    }
    throw err;
  }
});

export const deleteUserHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    await usersService.deleteUser(id, config.tenantId);
    
    audit.log({
      tenantId: config.tenantId,
      userId: (req as any).user?.sub,
      userEmail: (req as any).user?.email,
      eventType: "user.delete",
      entityType: "user",
      action: "delete",
      summary: `User ${id} deleted`,
    });

    res.status(200).json({ success: true });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") throw new NotFoundError("User not found");
    if (err.message === "CANNOT_DELETE_SUPER_ADMIN") throw new BadRequestError("Cannot delete Super Admin");
    throw err;
  }
});
