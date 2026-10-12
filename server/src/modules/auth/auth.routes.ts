import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  signupHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  microsoftRedirectHandler,
  microsoftCallbackHandler,
  getSSOConfigPublicHandler,
  getSSOSettingsHandler,
  updateSSOSettingsHandler,
  ssoLoginHandler,
  ssoCallbackHandler,
  mfaSetupHandler,
  mfaConfirmHandler,
  mfaChallengeHandler,
} from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import { requirePermission, requireSuperAdmin } from "../../rbac/rbac.middleware";

const router = Router();

// Brute-force protection for credential-guessing endpoints. In-memory store
// is fine for the current single-instance deployment; a shared store (e.g.
// Redis) would be needed if this scales horizontally.
const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many attempts. Please try again later." },
});

// ─── Direct Login (Super Admin only) ─────────────────────────────────────────
// Signup creates a super_admin account. Login enforces super_admin role only.
router.post("/signup", authBruteForceLimiter, signupHandler);
router.post("/login", authBruteForceLimiter, loginHandler);
router.post("/refresh", refreshHandler);
router.post("/logout", requireAuth, logoutHandler);
router.get("/me", requireAuth, meHandler);

// ─── MFA (TOTP) ───────────────────────────────────────────────────────────
// requireAuth only — NOT requireMfaVerified — since these routes are how an
// authenticated-but-unverified session becomes verified in the first place.
router.post("/mfa/setup", requireAuth, mfaSetupHandler);
router.post("/mfa/confirm", requireAuth, mfaConfirmHandler);
router.post("/mfa/challenge", requireAuth, mfaChallengeHandler);

// ─── Microsoft SSO (Entra ID / Azure AD) ─────────────────────────────────────
// Microsoft SSO is the Super Admin's secondary authentication path.
// Non-super-admin users cannot authenticate via this route.
router.get("/microsoft", microsoftRedirectHandler);
router.get("/microsoft/callback", microsoftCallbackHandler);

// ─── SSO Config (Super Admin only) ───────────────────────────────────────────
// Reading the public config is unauthenticated (needed by the login page).
// Managing SSO settings requires Super Admin.
router.get("/sso-config", getSSOConfigPublicHandler);
router.get("/sso/settings",  requireAuth, requirePermission("sso_config", "view"),      getSSOSettingsHandler);
router.post("/sso/settings", requireAuth, requirePermission("sso_config", "configure"), updateSSOSettingsHandler);

// ─── Custom SSO Auth (OIDC/SAML — for all non-Super Admin roles) ─────────────
router.get("/sso/login", ssoLoginHandler);
router.get("/sso/callback", ssoCallbackHandler);

export default router;
