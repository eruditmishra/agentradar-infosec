import React, { useState } from 'react';
import { X, Check, Copy } from 'lucide-react';

export function CredentialsModal({ isOpen, onClose, credentials }: { isOpen: boolean; onClose: () => void; credentials: { email: string; tempPassword: string } | null }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !credentials) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-gray-900">Temporary Credentials</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 bg-gray-50/50">
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-[12px] text-amber-800 font-semibold mb-1">Important</p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Please copy these credentials and share them with the user securely. This password will not be shown again.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-[13px]">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-500 font-sans text-[11px] uppercase tracking-wider">Email</span>
                <span className="text-gray-900 font-medium">{credentials.email}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-500 font-sans text-[11px] uppercase tracking-wider">Password</span>
                <span className="text-gray-900 font-medium">{credentials.tempPassword}</span>
              </div>
            </div>
          </div>
          <button
            onClick={copyToClipboard}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-800 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied to clipboard' : 'Copy Credentials'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateUserModal({
  isOpen,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; email: string; role: string; authMethod: string }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get('name') as string,
      email: fd.get('email') as string,
      role: fd.get('role') as string,
      authMethod: fd.get('authMethod') as string,
    };
    try {
      await onSubmit(data);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-gray-900">Create New User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-[12px] font-medium border border-red-100">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Full Name</label>
              <input name="name" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" placeholder="e.g. Jane Doe" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Email Address</label>
              <input name="email" type="email" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" placeholder="jane@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Role</label>
                <select name="role" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white transition-colors">
                  <option value="admin">Admin</option>
                  <option value="ciso">CISO</option>
                  <option value="security_analyst">Security Analyst</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Auth Method</label>
                <select name="authMethod" required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white transition-colors">
                  <option value="password">Direct Login</option>
                  <option value="sso">SSO</option>
                  <option value="microsoft">Microsoft</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditUserModal({
  isOpen,
  onClose,
  onSubmit,
  user
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; role: string }) => Promise<void>;
  user: any;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await onSubmit({
        name: fd.get('name') as string,
        role: fd.get('role') as string,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-gray-900">Edit User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-[12px] font-medium border border-red-100">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Email Address</label>
              <input disabled value={user.email} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Full Name</label>
              <input name="name" defaultValue={user.name} required className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Role</label>
              {user.authMethod === 'sso' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                  This user signs in via SSO. Their role is synced from your identity provider's group mapping on every login &mdash; any change made here will be overwritten the next time they sign in.
                </p>
              )}
              <select name="role" defaultValue={user.role} required disabled={user.role === 'super_admin'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white transition-colors disabled:bg-gray-50 disabled:text-gray-500">
                {user.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                <option value="admin">Admin</option>
                <option value="ciso">CISO</option>
                <option value="security_analyst">Security Analyst</option>
                <option value="auditor">Auditor</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
