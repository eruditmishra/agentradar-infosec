import { NavLink } from "react-router-dom";
import {
  Activity,
  Globe,
  Cpu,
  Link as LinkIcon,
  Shield,
  ShieldCheck,
  Users,
  Search,
  FileText,
  Fingerprint,
} from "lucide-react";
import { usePermission, useRoleDisplayName } from "../../hooks/usePermission";
import useStore from "../../store/useStore";

export default function Sidebar() {
  // const user = useStore((s) => s.user);
  // const roleLabel = useRoleDisplayName();

  // ── Permission checks ────────────────────────────────────────────────────
  const canViewDashboard = usePermission("dashboard", "view");
  const canViewAgents = usePermission("agents", "view");
  const canViewModels = usePermission("models", "view");
  const canViewIntegrations = usePermission("integrations", "view");
  const canViewSsoConfig = usePermission("sso_config", "view");
  const canViewAutoDiscovery = usePermission("auto_discovery_config", "view");
  const canViewAgentAuditLogs = usePermission("agent_audit_logs", "view");
  const canViewUserManagement = usePermission("user_management", "view");
  const canViewAssessments = usePermission("assessments", "view");

  const activeClass =
    "bg-white shadow-[0_4px_12px_rgba(100,120,200,0.1),inset_0_1px_0_rgba(255,255,255,1)] text-brand border border-glass-border translate-x-1";
  const inactiveClass =
    "text-text-white hover:bg-white/50 hover:text-text-primary border border-transparent";
  const navClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-r10 text-[13px] font-bold transition-all duration-200 ${isActive ? activeClass : inactiveClass}`;

  const subActiveClass =
    "text-brand bg-white rounded-r-md border-l-[2px] border-brand -ml-[1px] shadow-[inset_0_1px_0_rgba(255,255,255,1)]";
  const subInactiveClass =
    "text-text-white hover:text-text-white hover:bg-white/20 rounded-r-md border-l-[2px] border-transparent -ml-[1px] ";
  const subNavClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${isActive ? subActiveClass : subInactiveClass}`;

  return (
    <aside className="w-[248px] min-w-[248px] h-screen flex flex-col  border-r border-glass-border shadow-[2px_0_24px_rgba(100,120,200,0.08)] relative z-10 shrink-0 bg-[#0d094f]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3.5 border-b border-glass-border-dim">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] bg-gradient-to-br from-brand to-brand-2 rounded-[10px] flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.35)] shrink-0">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.2" fill="white" />
              <circle
                cx="7"
                cy="7"
                r="5"
                stroke="white"
                strokeWidth="1"
                strokeDasharray="2 1.5"
              />
              <circle cx="2" cy="7" r="1" fill="white" opacity=".6" />
              <circle cx="12" cy="7" r="1" fill="white" opacity=".6" />
            </svg>
          </div>
          <div>
            <div className="font-display text-[16px] font-extrabold text-white tracking-tight">
              AgentRadar
            </div>
            <div className="text-[10px] text-text-muted mt-[1px]">
              AI Governance Platform
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5 sidebar-navigation">
        {/* Overview */}
        {canViewDashboard && (
          <div>
            <div className="text-[10px] font-bold text-text-muted tracking-widest uppercase mb-3 ml-2">
              Overview
            </div>

            <NavLink
              to="/dashboard"
              className={({ isActive }) => navClass(isActive)}
            >
              <Activity size={16} />
              Dashboard
            </NavLink>
          </div>
        )}

        {/* Discovery */}
        {canViewAgents && (
          <div>
            <div className="text-[10px] font-bold text-text-muted tracking-widest uppercase mb-3 ml-2">
              Discovery
            </div>

            <div className="flex flex-col mb-1">
              <div className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-bold text-text-white select-none">
                <Globe size={16} />
                Discovered Agents
              </div>

              <div className="flex flex-col ml-7 mt-1 border-l border-glass-border-dim gap-1">
                <NavLink
                  to="/agents"
                  end
                  className={({ isActive }) => subNavClass(isActive)}
                >
                  All Agents
                </NavLink>
                <NavLink
                  to="/agents/shadow"
                  className={({ isActive }) => subNavClass(isActive)}
                >
                  Shadow Agents
                </NavLink>
                <NavLink
                  to="/agents/verified"
                  className={({ isActive }) => subNavClass(isActive)}
                >
                  Verified Agents
                </NavLink>
                <NavLink
                  to="/identities"
                  className={({ isActive }) => subNavClass(isActive)}
                >
                  <Fingerprint size={12} className="shrink-0" />
                  Identities
                </NavLink>
              </div>
            </div>

            {canViewModels && (
              <NavLink
                to="/models"
                className={({ isActive }) => navClass(isActive)}
              >
                <Cpu size={16} />
                Discovered Models
              </NavLink>
            )}

            {canViewAutoDiscovery && (
              <NavLink
                to="/auto-discovery"
                className={({ isActive }) => `${navClass(isActive)} mt-1`}
              >
                <Search size={16} />
                Auto Discovery
              </NavLink>
            )}
          </div>
        )}

        {/* Governance & Compliance */}
        {canViewAssessments && (
          <div>
            <div className="text-[10px] font-bold text-text-muted tracking-widest uppercase mb-3 ml-2">
              Governance &amp; Compliance
            </div>
            <NavLink
              to="/assessments"
              className={({ isActive }) => navClass(isActive)}
            >
              <ShieldCheck size={16} />
              Assessments
            </NavLink>
          </div>
        )}

        {/* Administration */}
        {(canViewIntegrations || canViewSsoConfig || canViewUserManagement) && (
          <div>
            <div className="text-[10px] font-bold text-text-muted tracking-widest uppercase mb-3 ml-2">
              Administration
            </div>

            {canViewIntegrations && (
              <NavLink
                to="/integrations"
                className={({ isActive }) => navClass(isActive)}
              >
                <LinkIcon size={16} />
                Integrations
              </NavLink>
            )}

            {canViewSsoConfig && (
              <NavLink
                to="/sso"
                className={({ isActive }) => `${navClass(isActive)} mt-1`}
              >
                <Shield size={16} />
                SSO Integration
              </NavLink>
            )}

            {canViewUserManagement && (
              <NavLink
                to="/user-management"
                className={({ isActive }) => `${navClass(isActive)} mt-1`}
              >
                <Users size={16} />
                User & IAM
              </NavLink>
            )}
          </div>
        )}

        {/* Audit & Monitoring */}
        {canViewAgentAuditLogs && (
          <div>
            <div className="text-[10px] font-bold text-text-muted tracking-widest uppercase mb-3 ml-2">
              Audit &amp; Monitoring
            </div>

            {canViewAgentAuditLogs && (
              <NavLink
                to="/audit-logs"
                className={({ isActive }) => navClass(isActive)}
              >
                <FileText size={16} />
                Audit Logs
              </NavLink>
            )}
          </div>
        )}
      </div>

      {/* User badge at bottom */}
      {/* <div className="px-4 pb-4 pt-3 border-t border-glass-border-dim">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-r10 bg-white/40 border border-glass-border-dim">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase() ??
              user?.email?.[0]?.toUpperCase() ??
              "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-text-primary truncate">
              {user?.name || user?.email?.split("@")[0]}
            </div>
            <div className="text-[10px] text-text-muted">{roleLabel}</div>
          </div>
        </div>
      </div> */}
    </aside>
  );
}
