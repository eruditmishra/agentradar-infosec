import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes";
// import agentRoutes from "./modules/agents/agents.routes";
import trustRoutes from "./modules/trust/trust.routes";
import discoveryRoutes from "./modules/discovery/discovery.routes";
import integrationsRoutes from "./modules/integrations/integrations.routes";
import auditRoutes from "./modules/audit/audit.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import usersRoutes from "./modules/users/users.routes";
import { requireAuth, attachTenant } from "./modules/auth/auth.middleware";
import { requireMfaVerified } from "./rbac/rbac.middleware";
import {
  errorHandler,
  notFoundHandler,
} from "./shared/middleware/errorHandler.middleware";
import { systemAccessLogMiddleware } from "./shared/middleware/auditAccess.middleware";

const app = express();
app.use(helmet());
app.use(express.json());
app.use(express.text({ type: "text/plain" })); // for sendBeacon pageview payloads
app.use(cookieParser());

// System access logging — registered before routes so every request is captured
app.use(systemAccessLogMiddleware);

// Baseline throttle for all API traffic. /api/auth layers its own stricter
// brute-force limiter on top of this (see auth.routes.ts).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
// app.use("/api/agents", requireAuth, attachTenant, requireMfaVerified(), agentRoutes);
app.use("/api/trust", requireAuth, attachTenant, requireMfaVerified(), trustRoutes);
app.use("/api/discovery", requireAuth, attachTenant, requireMfaVerified(), discoveryRoutes);
app.use("/api/integrations", requireAuth, attachTenant, requireMfaVerified(), integrationsRoutes);
app.use("/api/audit", requireAuth, attachTenant, requireMfaVerified(), auditRoutes);
app.use("/api/dashboard", requireAuth, attachTenant, requireMfaVerified(), dashboardRoutes);
app.use("/api/users", requireAuth, attachTenant, requireMfaVerified(), usersRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
