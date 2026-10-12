import { db } from "../../db/client";

export async function listUsers(tenantId: string | null) {
  const columns = `id, email, role, auth_method as "authMethod", mfa_enabled as "mfaEnabled", (mfa_enrolled_at IS NOT NULL) as "mfaEnrolled", is_active as "isActive", name, created_at as "createdAt", last_login_at as "lastLoginAt"`;
  const query = tenantId
    ? `SELECT ${columns} FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`
    : `SELECT ${columns} FROM users WHERE tenant_id IS NULL ORDER BY created_at DESC`;

  const params = tenantId ? [tenantId] : [];
  const res = await db.query(query, params);
  return res.rows;
}

export async function getUserById(id: string, tenantId: string | null) {
  const query = tenantId
    ? `SELECT * FROM users WHERE id = $1 AND tenant_id = $2`
    : `SELECT * FROM users WHERE id = $1 AND tenant_id IS NULL`;
  const params = tenantId ? [id, tenantId] : [id];
  const res = await db.query(query, params);
  return res.rows[0] ?? null;
}

export async function createUser(
  tenantId: string | null,
  email: string,
  name: string,
  role: string,
  authMethod: string,
  passwordHash: string,
  createdBy: string
) {
  const query = `
    INSERT INTO users (tenant_id, email, name, role, auth_method, password_hash, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, email, role, auth_method as "authMethod", is_active as "isActive", name, created_at as "createdAt"
  `;
  const res = await db.query(query, [tenantId, email, name, role, authMethod, passwordHash, createdBy]);
  return res.rows[0];
}

export async function updateUser(
  id: string,
  tenantId: string | null,
  updates: { name?: string; role?: string }
) {
  const setClauses: string[] = [];
  const params: any[] = [id];
  if (tenantId) params.push(tenantId);

  let paramIndex = params.length + 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }
  if (updates.role !== undefined) {
    setClauses.push(`role = $${paramIndex++}`);
    params.push(updates.role);
  }

  setClauses.push(`updated_at = now()`);

  const condition = tenantId ? `id = $1 AND tenant_id = $2` : `id = $1 AND tenant_id IS NULL`;

  const query = `
    UPDATE users
    SET ${setClauses.join(", ")}
    WHERE ${condition}
    RETURNING id, email, role, auth_method as "authMethod", is_active as "isActive", name, created_at as "createdAt"
  `;
  
  const res = await db.query(query, params);
  return res.rows[0] ?? null;
}

export async function setUserStatus(id: string, tenantId: string | null, isActive: boolean) {
  const query = tenantId
    ? `UPDATE users SET is_active = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id, is_active as "isActive"`
    : `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 AND tenant_id IS NULL RETURNING id, is_active as "isActive"`;
  
  const params = tenantId ? [id, tenantId, isActive] : [id, isActive];
  const res = await db.query(query, params);
  return res.rows[0] ?? null;
}

export async function updatePasswordHash(id: string, tenantId: string | null, passwordHash: string) {
  const query = tenantId
    ? `UPDATE users SET password_hash = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id`
    : `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 AND tenant_id IS NULL RETURNING id`;
  
  const params = tenantId ? [id, tenantId, passwordHash] : [id, passwordHash];
  const res = await db.query(query, params);
  return res.rows[0] ?? null;
}

export async function deleteUser(id: string, tenantId: string | null) {
  const query = tenantId
    ? `DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id`
    : `DELETE FROM users WHERE id = $1 AND tenant_id IS NULL RETURNING id`;
  
  const params = tenantId ? [id, tenantId] : [id];
  const res = await db.query(query, params);
  return res.rows[0] ?? null;
}
