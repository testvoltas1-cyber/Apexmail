// src/components/AdminDashboard.tsx
// System Administrator Dashboard: KPIs, Outbox Retry Queue Monitor, Inbound Sandbox & Audit Logs

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  HardDrive,
  Users,
  Globe,
  Mail,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Server,
  Layers,
  Search,
  Plus,
  Lock,
  X
} from 'lucide-react';
import { SystemStats, OutboxItem, AuditLog, User, Mailbox, Domain } from '../types';
import { api } from '../api/client';

interface AdminDashboardProps {
  mailboxes: Mailbox[];
  onOpenSimulator: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  mailboxes,
  onOpenSimulator,
}) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'outbox' | 'logs' | 'users'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // New Account Modal State
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccDomainId, setNewAccDomainId] = useState('');
  const [newAccUsername, setNewAccUsername] = useState('');
  const [newAccDisplayName, setNewAccDisplayName] = useState('');
  const [newAccPassword, setNewAccPassword] = useState('');
  const [newAccRole, setNewAccRole] = useState<'user' | 'admin'>('user');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, outboxRes, logsRes, usersRes, domainsRes] = await Promise.all([
        api.getAdminStats(),
        api.getOutbox(),
        api.getAuditLogs(),
        api.getUsers(),
        api.getDomains(),
      ]);
      setStats(statsRes.stats);
      setOutbox(outboxRes.outbox);
      setLogs(logsRes.logs);
      setUsers(usersRes.users);
      setDomains(domainsRes.domains);
      if (domainsRes.domains.length > 0 && !newAccDomainId) {
        setNewAccDomainId(domainsRes.domains[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await api.retryOutboxItem(id);
      loadData();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleProvisionAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccUsername.trim() || !newAccDisplayName.trim() || !newAccPassword.trim()) {
      alert('Please fill in username, display name, and password.');
      return;
    }
    if (!newAccDomainId) {
      alert('Please add and verify a custom domain first.');
      return;
    }

    setIsCreatingAccount(true);
    try {
      await api.createAccount({
        domain_id: newAccDomainId,
        username: newAccUsername.trim(),
        display_name: newAccDisplayName.trim(),
        password: newAccPassword.trim(),
        role: newAccRole,
      });
      setShowCreateAccountModal(false);
      setNewAccUsername('');
      setNewAccDisplayName('');
      setNewAccPassword('');
      setNewAccRole('user');
      loadData();
      alert('User account & mailbox created successfully! The user can now log in.');
    } catch (err: any) {
      alert(`Failed to create account: ${err.message}`);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">System & Mailbox Administration</h1>
          </div>
          <p className="text-xs text-gray-500 max-w-xl">
            Monitor real-time protocol delivery queues, outbox retry worker health, storage consumption, inbound routing, and security audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs border border-indigo-200 shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Inbound Test Simulator</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200"
            title="Refresh Admin Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              <span>Total Mailboxes</span>
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_mailboxes}</div>
            <div className="text-[11px] text-gray-400">{stats.total_domains} Custom Domain(s)</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              <span>Emails Sent Today</span>
              <Send className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{stats.emails_sent_today}</div>
            <div className="text-[11px] text-gray-400">{stats.total_emails} Total Indexed</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              <span>Outbox Queue</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.outbox_queued}</div>
            <div className="text-[11px] text-amber-600 font-medium">
              {stats.outbox_failed} delivery failure(s)
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              <span>Cluster Storage</span>
              <HardDrive className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {(stats.total_storage_bytes / (1024 * 1024)).toFixed(1)} MB
            </div>
            <div className="text-[11px] text-gray-400">of 100 GB Allocated</div>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Outbox Delivery Queue ({outbox.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Audit Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Users & Quotas ({users.length})
        </button>
      </div>

      {/* Tab Content: Outbox Queue */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs text-xs space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Outbound SMTP Dispatch & Retry Worker</span>
            </h3>
            <span className="text-gray-400 text-[11px]">Worker interval: 15s • Exponential backoff</span>
          </div>

          {outbox.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div>Outbox queue is currently empty. All messages dispatched!</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Next Retry / Sent At</th>
                    <th className="px-3 py-2">Error Log</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                  {outbox.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5 font-semibold text-gray-700">{item.id.substring(0, 8)}...</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'failed'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700 animate-pulse'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {item.attempts} / {item.max_attempts}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {item.sent_at
                          ? new Date(item.sent_at).toLocaleTimeString()
                          : new Date(item.next_retry_at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2.5 text-red-600 font-sans truncate max-w-xs" title={item.last_error}>
                        {item.last_error || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-sans">
                        {item.status !== 'sent' && (
                          <button
                            onClick={() => handleManualRetry(item.id)}
                            disabled={retryingId === item.id}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded border border-purple-200"
                          >
                            {retryingId === item.id ? 'Retrying...' : 'Force Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs text-xs divide-y divide-gray-100">
          <div className="p-4 font-bold text-gray-800 bg-gray-50 flex items-center justify-between">
            <span>Security & Protocol Event Stream</span>
            <span className="text-[11px] text-gray-400 font-normal">Last 100 events</span>
          </div>
          {logs.map((log) => (
            <div key={log.id} className="p-3.5 flex items-start justify-between gap-4 font-mono text-[11px]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-700">{log.action}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{JSON.stringify(log.details)}</span>
                </div>
                <div className="text-[10px] text-gray-400">IP: {log.ip_address}</div>
              </div>
              <div className="text-gray-400 shrink-0 font-sans">
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Provisioned Users & Accounts</h2>
              <p className="text-xs text-gray-500">Create login credentials for users under your verified custom domains.</p>
            </div>
            <button
              onClick={() => setShowCreateAccountModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Provision New User Account</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs text-xs">
            <table className="w-full text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Storage Used</th>
                  <th className="px-4 py-3">Quota</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <div>{u.name}</div>
                      <div className="text-gray-500 font-normal">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {((u.storage_used_bytes || 0) / (1024 * 1024)).toFixed(1)} MB
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(u.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision Account Modal */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-gray-900">Provision User Account</h3>
              </div>
              <button
                onClick={() => setShowCreateAccountModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {domains.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2">
                <p className="font-semibold">No custom domains found.</p>
                <p>Please navigate to the <strong>Domains</strong> tab and add your custom domain before creating user accounts.</p>
              </div>
            ) : (
              <form onSubmit={handleProvisionAccount} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target Custom Domain</label>
                  <select
                    value={newAccDomainId}
                    onChange={(e) => setNewAccDomainId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.domain_name} {d.is_verified ? '(Verified)' : '(Pending DNS)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Username / Prefix</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      required
                      value={newAccUsername}
                      onChange={(e) => setNewAccUsername(e.target.value)}
                      placeholder="e.g. john"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-xl font-mono text-gray-600">
                      @{domains.find((d) => d.id === newAccDomainId)?.domain_name || 'domain.com'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newAccDisplayName}
                    onChange={(e) => setNewAccDisplayName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Initial Password</label>
                    <input
                      type="password"
                      required
                      value={newAccPassword}
                      onChange={(e) => setNewAccPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Role</label>
                    <select
                      value={newAccRole}
                      onChange={(e: any) => setNewAccRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateAccountModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAccount}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-xs"
                  >
                    {isCreatingAccount ? 'Creating Account...' : 'Create Account & Mailbox'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
