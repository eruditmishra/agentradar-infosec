CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,                     -- nullable: NULL for self-hosted single-tenant installs
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'auditor', 'analyst', 'super-admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- email must be unique per tenant when tenant_id is set, and globally unique
-- when it's NULL (self-hosted). Partial unique indexes handle both cases.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_tenant_unique
    ON users (tenant_id, email) WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_no_tenant_unique
    ON users (email) WHERE tenant_id IS NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    replaced_by UUID REFERENCES refresh_tokens(id)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);