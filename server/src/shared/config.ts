export const config = {
  env: process.env.NODE_ENV ?? "development",
  // Nullable by design: unset (undefined/empty) in self-hosted single-tenant
  // installs. Only set when this deployment is part of a hosted multi-tenant
  // offering. Treated as `null` everywhere downstream, never a required value.
  tenantId: process.env.TENANT_ID ? process.env.TENANT_ID : null,
  secureCookies: process.env.SECURE_COOKIES !== 'false' && (process.env.NODE_ENV === 'production'),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
    redirectUri: process.env.MICROSOFT_REDIRECT_URI ?? "http://localhost:3000/api/auth/microsoft/callback",
  },
};
