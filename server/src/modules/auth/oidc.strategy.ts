import * as openidClient from "openid-client";

interface OidcConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
}

let _cachedConfig: { issuerUrl: string, config: openidClient.Configuration } | null = null;

async function getOidcConfig(config: OidcConfig): Promise<openidClient.Configuration> {
  if (_cachedConfig && _cachedConfig.issuerUrl === config.issuerUrl) {
    return _cachedConfig.config;
  }

  const discovered = await openidClient.discovery(
    new URL(config.issuerUrl),
    config.clientId,
    config.clientSecret,
  );
  
  _cachedConfig = { issuerUrl: config.issuerUrl, config: discovered };
  return discovered;
}

export async function buildAuthorizationUrl(
  state: string,
  config: OidcConfig,
  redirectUri: string,
  additionalScopes: string[] = [],
): Promise<string> {
  const oidcConfig = await getOidcConfig(config);

  const url = openidClient.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: redirectUri,
    scope: ["openid", "profile", "email", ...additionalScopes].join(" "),
    state,
    response_type: "code",
  });

  return url.toString();
}

export async function exchangeCodeForClaims(
  callbackUrl: string,
  expectedState: string,
  config: OidcConfig
): Promise<any> {
  const oidcConfig = await getOidcConfig(config);

  const tokens = await openidClient.authorizationCodeGrant(
    oidcConfig,
    new URL(callbackUrl),
    {
      pkceCodeVerifier: undefined,
      expectedState,
    },
  );

  let claims: any = tokens.claims();
  if (!claims) {
    if (tokens.access_token) {
      claims = await openidClient.fetchUserInfo(oidcConfig, tokens.access_token, "") as any;
    }
    if (!claims) throw new Error("OIDC_NO_CLAIMS");
  }

  let email = (claims["email"] as string | undefined) ?? (claims["preferred_username"] as string | undefined);
  let name = claims["name"] as string | undefined;
  let sub = claims["sub"] as string | undefined;

  // Fallback to userinfo endpoint if email or name is missing
  if ((!email || !name) && tokens.access_token) {
    try {
      const userInfo = await openidClient.fetchUserInfo(oidcConfig, tokens.access_token, sub ?? "");
      email = email ?? (userInfo["email"] as string | undefined) ?? (userInfo["preferred_username"] as string | undefined);
      name = name ?? (userInfo["name"] as string | undefined);
      sub = sub ?? (userInfo["sub"] as string | undefined);
      claims = { ...claims, ...userInfo };
    } catch (e) {
      console.warn("Failed to fetch userinfo:", e);
    }
  }

  if (!email) throw new Error("OIDC_EMAIL_MISSING");
  if (!sub) throw new Error("OIDC_SUB_MISSING");

  return { email, name, sub, allClaims: claims };
}
