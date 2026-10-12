CREATE TABLE IF NOT EXISTS sso_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE, -- One SSO config per tenant
    provider_id TEXT NOT NULL, -- e.g., 'okta', 'auth0', 'entra', 'oidc', 'saml'
    provider_type TEXT NOT NULL, -- 'oidc' or 'saml'
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
