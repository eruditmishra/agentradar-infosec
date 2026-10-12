import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, MoreVertical, Edit2, Key, Power, PowerOff, Trash2, ShieldCheck, ShieldOff } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { CreateUserModal, EditUserModal, CredentialsModal } from '../../components/users/UserModals';

// Role badge styles
const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  super_admin:      { label: 'Super Admin',      bg: 'bg-purple-50 border-purple-100',   text: 'text-purple-700' },
  admin:            { label: 'Admin',            bg: 'bg-blue-50 border-blue-100',       text: 'text-blue-700'   },
  ciso:             { label: 'CISO',             bg: 'bg-red-50 border-red-100',         text: 'text-red-700'    },
  security_analyst: { label: 'Security Analyst', bg: 'bg-amber-50 border-amber-100',     text: 'text-amber-700'  },
  auditor:          { label: 'Auditor',          bg: 'bg-green-50 border-green-100',     text: 'text-green-700'  },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_BADGE[role] ?? { label: role, bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function MfaBadge({ enabled, enrolled }: { enabled: boolean; enrolled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold text-slate-500 bg-slate-50 border-slate-200">
        <ShieldOff size={10} /> Off
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${enrolled ? 'text-green-700 bg-green-50 border-green-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
      <ShieldCheck size={10} /> {enrolled ? 'Enrolled' : 'Pending Setup'}
    </span>
  );
}

function AuthMethodBadge({ method }: { method: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    password:  { label: 'Direct Login', color: 'text-amber-600 bg-amber-50 border-amber-100' },
    sso:       { label: 'SSO',          color: 'text-brand bg-indigo-50 border-indigo-100' },
    microsoft: { label: 'Microsoft',    color: 'text-blue-600 bg-blue-50 border-blue-100' },
  };
  const cfg = labels[method] ?? { label: method, color: 'text-slate-600 bg-slate-50 border-slate-100' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function UserManagement() {
  const canCreate = usePermission('user_management', 'create');
  const canUpdate = usePermission('user_management', 'update');
  const canDelete = usePermission('user_management', 'delete');

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null);
  
  // Action menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create user');
    
    setUsers([body.user, ...users]);
    setShowCreate(false);
    if (body.tempPassword) {
      setCredentials({ email: data.email, tempPassword: body.tempPassword });
    }
  };

  const handleEdit = async (data: any) => {
    if (!editUser) return;
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update user');
    
    setUsers(users.map(u => u.id === editUser.id ? body.user : u));
    setEditUser(null);
  };

  const handleToggleStatus = async (user: any) => {
    if (!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.name}?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to change status');
      setUsers(users.map(u => u.id === user.id ? { ...u, isActive: !user.isActive } : u));
    } catch (err: any) {
      alert(err.message);
    }
    setOpenMenuId(null);
  };

  const handleResetPassword = async (user: any) => {
    if (!confirm(`Are you sure you want to reset the password for ${user.name}?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST'
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to reset password');
      setCredentials({ email: user.email, tempPassword: body.tempPassword });
    } catch (err: any) {
      alert(err.message);
    }
    setOpenMenuId(null);
  };

  const handleToggleMfa = async (user: any) => {
    const enabling = !user.mfaEnabled;
    if (!confirm(enabling
      ? `Require MFA for ${user.name}? They'll be asked to set up an authenticator app on their next login.`
      : `Turn off MFA for ${user.name}?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}/mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enabling })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update MFA setting');
      setUsers(users.map(u => u.id === user.id ? { ...u, mfaEnabled: enabling, mfaEnrolled: enabling ? false : u.mfaEnrolled } : u));
    } catch (err: any) {
      alert(err.message);
    }
    setOpenMenuId(null);
  };

  const handleDelete = async (user: any) => {
    if (!confirm(`Are you sure you want to completely remove ${user.name}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to delete user');
      setUsers(users.filter(u => u.id !== user.id));
    } catch (err: any) {
      alert(err.message);
    }
    setOpenMenuId(null);
  };

  const activeCount   = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;
  const ssoCount      = users.filter((u) => u.authMethod !== 'password').length;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7">
      <CredentialsModal isOpen={!!credentials} onClose={() => setCredentials(null)} credentials={credentials} />
      <CreateUserModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      <EditUserModal isOpen={!!editUser} onClose={() => setEditUser(null)} user={editUser} onSubmit={handleEdit} />

      {/* Page header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center shadow-brand-glow">
              <Users size={16} className="text-white" />
            </div>
            <h1 className="text-[22px] font-extrabold text-text-primary tracking-tight">
              User Management
            </h1>
          </div>
          <p className="text-[13px] text-text-muted ml-10">
            Manage platform users, roles, and access permissions
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-r10 bg-brand text-white text-[12px] font-semibold hover:bg-brand-2 transition-all shadow-md shadow-brand/20 hover:shadow-brand/40"
          >
            <UserPlus size={14} />
            Create User
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[13px] font-medium">
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active Users',    value: activeCount,   icon: Users,  color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
          { label: 'SSO Users',       value: ssoCount,      icon: Shield, color: 'text-brand',     bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Inactive Users',  value: inactiveCount, icon: Users,  color: 'text-red-500',   bg: 'bg-red-50 border-red-100' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`flex items-center gap-3 p-4 rounded-r10 border ${bg}`}>
            <div className={`${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <div className={`text-[20px] font-extrabold ${color}`}>{loading ? '-' : value}</div>
              <div className="text-[11px] text-text-muted font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r10 overflow-visible shadow-glass pb-10">
        <div className="px-5 py-3.5 border-b border-glass-border-dim flex items-center justify-between">
          <div className="text-[13px] font-bold text-text-primary">Platform Users</div>
          <div className="text-[11px] text-text-muted">{users.length} total</div>
        </div>

        <div className="overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-glass-border-dim">
                {['User', 'Role', 'Auth Method', 'MFA', 'Status', 'Last Login', canUpdate || canDelete ? 'Actions' : ''].filter(Boolean).map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-extrabold text-text-ghost tracking-widest uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[12px] text-text-muted font-medium">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[12px] text-text-muted font-medium">
                    No users found.
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-glass-border-dim/50 transition-colors hover:bg-white/40 ${!user.isActive ? 'opacity-60 grayscale-[30%]' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm ${user.isActive ? 'bg-gradient-to-br from-brand/80 to-brand-2/80' : 'bg-gray-400'}`}>
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-text-primary">{user.name}</div>
                        <div className="text-[11px] text-text-muted">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-3.5">
                    <AuthMethodBadge method={user.authMethod} />
                  </td>
                  <td className="px-5 py-3.5">
                    {user.authMethod === 'password' ? (
                      <MfaBadge enabled={!!user.mfaEnabled} enrolled={!!user.mfaEnrolled} />
                    ) : (
                      <span className="text-[10px] text-text-ghost">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full ${user.isActive ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-100'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-gray-400'}`} />
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[11px] font-medium text-text-muted">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  {(canUpdate || canDelete) && (
                    <td className="px-5 py-3.5 relative">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1.5 text-text-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Action Menu Dropdown */}
                        {openMenuId === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                              {canUpdate && (
                                <>
                                  <button
                                    onClick={() => { setEditUser(user); setOpenMenuId(null); }}
                                    className="w-full px-4 py-2 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 size={14} className="text-gray-400" /> Edit User
                                  </button>
                                  
                                  {user.authMethod === 'password' && (
                                    <button
                                      onClick={() => handleResetPassword(user)}
                                      className="w-full px-4 py-2 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Key size={14} className="text-gray-400" /> Reset Password
                                    </button>
                                  )}

                                  {user.authMethod === 'password' && user.role !== 'super_admin' && (
                                    <button
                                      onClick={() => handleToggleMfa(user)}
                                      className="w-full px-4 py-2 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      {user.mfaEnabled ? (
                                        <><ShieldOff size={14} className="text-amber-500" /> Disable MFA</>
                                      ) : (
                                        <><ShieldCheck size={14} className="text-green-500" /> Require MFA</>
                                      )}
                                    </button>
                                  )}

                                  {user.role !== 'super_admin' && (
                                    <button
                                      onClick={() => handleToggleStatus(user)}
                                      className="w-full px-4 py-2 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      {user.isActive ? (
                                        <><PowerOff size={14} className="text-amber-500" /> Deactivate</>
                                      ) : (
                                        <><Power size={14} className="text-green-500" /> Activate</>
                                      )}
                                    </button>
                                  )}
                                </>
                              )}
                              
                              {canDelete && user.role !== 'super_admin' && (
                                <>
                                  <div className="my-1 border-t border-gray-100" />
                                  <button
                                    onClick={() => handleDelete(user)}
                                    className="w-full px-4 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 size={14} className="text-red-400" /> Delete User
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role legend */}
      <div className="mt-5 p-4 bg-glass-white border border-glass-border rounded-r10 shadow-glass">
        <div className="text-[11px] font-bold text-text-secondary mb-3 uppercase tracking-widest">Role & Access Overview</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { role: 'super_admin',      desc: 'Full platform access. Can manage SSO and users.' },
            { role: 'admin',            desc: 'Platform admin. Can manage users, but not SSO.' },
            { role: 'ciso',             desc: 'Read-only visibility across all areas.' },
            { role: 'security_analyst', desc: 'Security operations and agent management.' },
            { role: 'auditor',          desc: 'Audit log access and read-only views.' },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-2.5">
              <RoleBadge role={role} />
              <span className="text-[10.5px] text-text-muted leading-relaxed font-medium mt-0.5">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
