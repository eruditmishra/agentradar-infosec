import { Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store/useStore';
import LoginScreen from './pages/shared/LoginScreen';
import MfaGate from './pages/shared/MfaGate';
import AppShell from './components/shared/AppShell';
import ProtectedRoute from './components/shared/ProtectedRoute';
import useTelemetry from './hooks/useTelemetry';
import useIdleTimeout from './hooks/useIdleTimeout';
import IdleWarningModal from './components/shared/IdleWarningModal';
import { getDefaultRoute } from './lib/permissions';

// ── Shared Pages ──────────────────────────────────────────────────────────────
import UserManagement from './pages/shared/UserManagement';

// ── Core Pages (shared across multiple roles) ─────────────────────────────────
import AdminDashboard from './pages/super-admin/Dashboard';
import DiscoveredAgents from './pages/super-admin/DiscoveredAgents';
import ShadowAgents from './pages/super-admin/ShadowAgents';
import VerifiedAgents from './pages/super-admin/VerifiedAgents';
import AgentIdentities from './pages/super-admin/AgentIdentities';
import AgentDetails from './pages/super-admin/AgentDetails';
import NewAgentDetails from './pages/super-admin/NewAgentDetails';
import AgentFindings from './pages/super-admin/AgentFindings';
import AgentLineage from './pages/super-admin/AgentLineage';
import AuditLogs from './pages/super-admin/AuditLogs';
import DiscoveredModels from './pages/super-admin/DiscoveredModels';
import Integrations from './pages/super-admin/Integrations';
import SSOConfig from './pages/super-admin/SSOConfig';
import AutoDiscovery from './pages/super-admin/AutoDiscovery';
import Assessments from './pages/super-admin/Assessments';
import AssessmentDetail from './pages/super-admin/AssessmentDetail';

export default function App() {
  useTelemetry();

  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const mfaPending = useStore((s) => s.mfaPending);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const { showWarning, secondsLeft, stayLoggedIn } = useIdleTimeout(isLoggedIn && !mfaPending);

  if (mfaPending) {
    return <MfaGate />;
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <>
      {showWarning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStayLoggedIn={stayLoggedIn}
          onLogoutNow={logout}
        />
      )}

      <Routes>
      <Route element={<AppShell />}>
        {/* ── Dashboard ──────────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'dashboard', action: 'view', featureName: 'Dashboard' }} />}>
          <Route path="/dashboard" element={<AdminDashboard />} />
        </Route>

        {/* ── Agents ─────────────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'agents', action: 'view', featureName: 'Agents' }} />}>
          <Route path="/agents" element={<DiscoveredAgents />} />
          <Route path="/agents/:id" element={<AgentDetails />} />
          <Route path="/agents/:id/new" element={<NewAgentDetails />} />
          <Route path="/agents/:id/findings" element={<AgentFindings />} />
          <Route path="/agents/:id/lineage" element={<AgentLineage />} />
        </Route>

        <Route element={<ProtectedRoute requirePermission={{ resource: 'shadow_agents', action: 'view', featureName: 'Shadow Agents' }} />}>
          <Route path="/agents/shadow" element={<ShadowAgents />} />
        </Route>

        <Route element={<ProtectedRoute requirePermission={{ resource: 'verified_agents', action: 'view', featureName: 'Verified Agents' }} />}>
          <Route path="/agents/verified" element={<VerifiedAgents />} />
        </Route>

        {/* ── Identities — Azure Entra agent identities ────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'agents', action: 'view', featureName: 'Agent Identities' }} />}>
          <Route path="/identities" element={<AgentIdentities />} />
        </Route>

        {/* ── Models ─────────────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'models', action: 'view', featureName: 'Discovered Models' }} />}>
          <Route path="/models" element={<DiscoveredModels />} />
        </Route>

        {/* ── Integrations ───────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'integrations', action: 'view', featureName: 'Integrations' }} />}>
          <Route path="/integrations" element={<Integrations />} />
        </Route>

        {/* ── SSO & IAM (Super Admin only) ───────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'sso_config', action: 'view', featureName: 'SSO & IAM Configuration' }} />}>
          <Route path="/sso" element={<SSOConfig />} />
        </Route>

        {/* ── Auto Discovery Configuration ───────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'auto_discovery_config', action: 'view', featureName: 'Auto Discovery Configuration' }} />}>
          <Route path="/auto-discovery" element={<AutoDiscovery />} />
        </Route>

        {/* ── Governance & Compliance ─────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'assessments', action: 'view', featureName: 'Assessments' }} />}>
          <Route path="/assessments" element={<Assessments />} />
          <Route path="/assessments/:agentId" element={<AssessmentDetail />} />
        </Route>

        {/* ── User Management ────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'user_management', action: 'view', featureName: 'User Management' }} />}>
          <Route path="/user-management" element={<UserManagement />} />
        </Route>

        {/* ── Audit & Monitoring ─────────────────────────────────────────── */}
        <Route element={<ProtectedRoute requirePermission={{ resource: 'agent_audit_logs', action: 'view', featureName: 'Agent Audit Logs' }} />}>
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>

        {/* ── Legacy Super Admin paths — redirect to unified paths ───────── */}
        <Route path="/super-admin/dashboard"        element={<Navigate to="/dashboard" replace />} />
        <Route path="/super-admin/agents"           element={<Navigate to="/agents" replace />} />
        <Route path="/super-admin/agents/shadow"    element={<Navigate to="/agents/shadow" replace />} />
        <Route path="/super-admin/agents/verified"  element={<Navigate to="/agents/verified" replace />} />
        <Route path="/super-admin/agents/:id"       element={<Navigate to="/agents/:id" replace />} />
        <Route path="/super-admin/models"           element={<Navigate to="/models" replace />} />
        <Route path="/super-admin/integrations"     element={<Navigate to="/integrations" replace />} />
        <Route path="/super-admin/sso"              element={<Navigate to="/sso" replace />} />
        <Route path="/super-admin/auto-discovery"   element={<Navigate to="/auto-discovery" replace />} />
        <Route path="/super-admin/audit-logs"       element={<Navigate to="/audit-logs" replace />} />
        <Route path="/super-admin/logs"             element={<Navigate to="/logs" replace />} />
        <Route path="/analyst/dashboard"            element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/dashboard"              element={<Navigate to="/dashboard" replace />} />
        <Route path="/auditor/dashboard"            element={<Navigate to="/dashboard" replace />} />

      </Route>

      {/* Root redirect to role's default page */}
      <Route
        path="/"
        element={<Navigate to={getDefaultRoute(user?.role)} replace />}
      />

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
