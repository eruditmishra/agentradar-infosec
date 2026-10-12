/**
 * microsoft.strategy.ts
 *
 * Handles the OAuth 2.0 Authorization Code flow with Microsoft Entra ID (Azure AD).
 * Uses the `openid-client` library to interact with Microsoft's OIDC discovery endpoint.
 *
 * Flow:
 *  1. buildAuthorizationUrl()  — generates the Microsoft login redirect URL.
 *  2. exchangeCodeForClaims()  — exchanges the callback `code` for verified ID token claims.
 */
import * as openidClient from "openid-client";
import { config } from "../../shared/config";
import { MicrosoftIdTokenClaims } from "./auth.types";

const MICROSOFT_ISSUER = `https://login.microsoftonline.com/${config.microsoft.tenantId}/v2.0`;

// Cache the discovered OIDC configuration so we don't re-fetch it on every request.
let _oidcConfig: openidClient.Configuration | null = null;

async function getOidcConfig(): Promise<openidClient.Configuration> {
  if (_oidcConfig) return _oidcConfig;

  _oidcConfig = await openidClient.discovery(
    new URL(MICROSOFT_ISSUER),
    config.microsoft.clientId,
    config.microsoft.clientSecret,
  );
  return _oidcConfig;
}

/**
 * Generates the Microsoft authorization URL the browser should be redirected to.
 * @param state  A CSRF-prevention random string stored in session/cookie.
 */
export async function buildAuthorizationUrl(state: string): Promise<string> {
  const oidcConfig = await getOidcConfig();

  const url = openidClient.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: config.microsoft.redirectUri,
    scope: "openid profile email",
    state,
    response_type: "code",
  });

  return url.toString();
}

/**
 * Exchanges the authorization code (from Microsoft's callback) for verified ID token claims.
 * Validates the state parameter to prevent CSRF attacks.
 */
export async function exchangeCodeForClaims(
  callbackUrl: string,
  expectedState: string,
): Promise<MicrosoftIdTokenClaims> {
  const oidcConfig = await getOidcConfig();

  const tokens = await openidClient.authorizationCodeGrant(
    oidcConfig,
    new URL(callbackUrl),
    {
      pkceCodeVerifier: undefined,
      expectedState,
    },
  );

  const claims = tokens.claims();
  if (!claims) throw new Error("MICROSOFT_NO_CLAIMS");

  const oid = claims["oid"] as string | undefined;
  if (!oid) throw new Error("MICROSOFT_OID_MISSING");

  return {
    oid,
    email: (claims["email"] as string | undefined) ?? (claims["preferred_username"] as string | undefined),
    preferred_username: claims["preferred_username"] as string | undefined,
    name: claims["name"] as string | undefined,
    tid: claims["tid"] as string | undefined,
  };
}
