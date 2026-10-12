import { Role } from "../../rbac/permissions";

export { Role };

export interface AccessTokenPayload {
  sub: string;
  email: string | null;
  tenantId: string | null;
  role: Role;
  /** How the user authenticated. Embedded in token at issuance time. */
  authMethod: "password" | "sso" | "microsoft";
  /**
   * Whether Platform-Level MFA has been verified for this session.
   * Defaults to true when MFA enforcement is disabled (MFA_ENFORCEMENT_ENABLED=false).
   * Will be false until MFA challenge is completed when enforcement is enabled.
   */
  mfaVerified: boolean;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string | null;
  type: "refresh";
  jti: string;
}

export interface SignupInput {
  email: string;
  password: string;
  tenantId: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId: string | null;
}

export interface MicrosoftIdTokenClaims {
  /** Azure AD Object ID — stable unique identifier for the user */
  oid: string;
  /** Primary email / UPN */
  email?: string;
  preferred_username?: string;
  name?: string;
  /** Azure AD tenant the user belongs to */
  tid?: string;
}
