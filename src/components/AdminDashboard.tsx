// src/components/AdminDashboard.tsx
// System Administrator Dashboard: KPIs, Outbox Retry Queue, SMTP Mail Server Setup, Delivery Logs, Audit Logs & User Accounts

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  HardDrive,
  Users,
  Mail,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  Server,
  Search,
  Plus,
  X,
  Radio,
  Sliders,
  Terminal,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Play,
} from 'lucide-react';
import { SystemStats, OutboxItem, AuditLog, User, Mailbox, Domain, SmtpServerConfig, MailDeliveryLog } from '../types';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'mail_server' | 'delivery_logs' | 'logs' | 'users'>('mail_server');
  const [isLoading, setIsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isFlushingOutbox, setIsFlushingOutbox] = useState(false);

  // SMTP Server Configuration State
  const [smtpConfig, setSmtpConfig] = useState<SmtpServerConfig>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_name: 'ApexMail Relay',
    is_active: false,
  });
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // SMTP Live Diagnostic Test State
  const [testRecipient, setTestRecipient] = useState('');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; logs: string[]; duration_ms: number; error?: string; response?: string } | null>(null);

  // Delivery Logs State
  const [deliveryLogs, setDeliveryLogs] = useState<MailDeliveryLog[]>([]);
  const [deliveryFilterStatus, setDeliveryFilterStatus] = useState<string>('all');
  const [deliveryFilterDirection, setDeliveryFilterDirection] = useState<string>('all');
  const [deliverySearch, setDeliverySearch] = useState<string>('');
  const [isLoadingDeliveryLogs, setIsLoadingDeliveryLogs] = useState(false);

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
      const [statsRes, outboxRes, logsRes, usersRes, domainsRes, smtpRes, deliveryRes] = await Promise.all([
        api.getAdminStats(),
        api.getOutbox(),
        api.getAuditLogs(),
        api.getUsers(),
        api.getDomains(),
        api.getSmtpConfig(),
        api.getMailDeliveryLogs({ status: deliveryFilterStatus, direction: deliveryFilterDirection, q: deliverySearch }),
      ]);
      setStats(statsRes.stats);
      setOutbox(outboxRes.outbox);
      setLogs(logsRes.logs);
      setUsers(usersRes.users);
      setDomains(domainsRes.domains);
      setSmtpConfig(smtpRes.config);
      setDeliveryLogs(deliveryRes.logs);

      if (domainsRes.domains.length > 0 && !newAccDomainId) {
        setNewAccDomainId(domainsRes.domains[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeliveryLogsOnly = async () => {
    setIsLoadingDeliveryLogs(true);
    try {
      const res = await api.getMailDeliveryLogs({
        status: deliveryFilterStatus,
        direction: deliveryFilterDirection,
        q: deliverySearch,
      });
      setDeliveryLogs(res.logs);
    } catch (err) {
      console.error('Failed to load delivery logs:', err);
    } finally {
      setIsLoadingDeliveryLogs(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadDeliveryLogsOnly();
  }, [deliveryFilterStatus, deliveryFilterDirection]);

  const handleManualRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await api.retryOutboxItem(id);
      if (res.success) {
        loadData();
      }
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleFlushOutbox = async () => {
    setIsFlushingOutbox(true);
    try {
      const res = await api.flushOutbox();
      alert(`Outbox Queue Flushed: ${res.sent} sent successfully, ${res.failed} failed.`);
      loadData();
    } catch (err: any) {
      alert(`Flush failed: ${err.message}`);
    } finally {
      setIsFlushingOutbox(false);
    }
  };

  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    setSaveSuccessMsg(null);
    try {
      const res = await api.updateSmtpConfig(smtpConfig);
      setSmtpConfig(res.config);
      setSaveSuccessMsg('SMTP Server configuration saved successfully!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to save SMTP config: ${err.message}`);
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleRunSmtpTest = async () => {
    if (!smtpConfig.host) {
      alert('Please specify an SMTP Host before running connection diagnostics.');
      return;
    }
    setIsTestingSmtp(true);
    setTestResult(null);
    try {
      const result = await api.testSmtpConnection({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.user,
        pass: smtpConfig.pass,
        to_email: testRecipient.trim() || undefined,
        from_email: smtpConfig.user || undefined,
      });
      setTestResult(result);
      loadDeliveryLogsOnly();
    } catch (err: any) {
      setTestResult({
        success: false,
        logs: [`[Error] API call failed: ${err.message}`],
        duration_ms: 0,
        error: err.message,
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleClearDeliveryLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all mail delivery logs?')) return;
    try {
      await api.clearMailDeliveryLogs();
      setDeliveryLogs([]);
    } catch (err: any) {
      alert(`Failed to clear logs: ${err.message}`);
    }
  };

  const applyPreset = (preset: 'namecheap_private' | 'namecheap_cpanel' | 'brevo' | 'sendgrid' | 'gmail') => {
    if (preset === 'namecheap_private') {
      setSmtpConfig(prev => ({
        ...prev,
        host: 'mail.privateemail.com',
        port: 465,
        secure: true,
        is_active: true,
      }));
    } else if (preset === 'namecheap_cpanel') {
      const domName = domains[0]?.domain_name || 'yourdomain.com';
      setSmtpConfig(prev => ({
        ...prev,
        host: `mail.${domName}`,
        port: 465,
        secure: true,
        is_active: true,
      }));
    } else if (preset === 'brevo') {
      setSmtpConfig(prev => ({
        ...prev,
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        is_active: true,
      }));
    } else if (preset === 'sendgrid') {
      setSmtpConfig(prev => ({
        ...prev,
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        is_active: true,
      }));
    } else if (preset === 'gmail') {
      setSmtpConfig(prev => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        is_active: true,
      }));
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
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">System & Mail Server Administration</h1>
          </div>
          <p className="text-xs text-gray-500 max-w-xl">
            Configure real-world SMTP outbound delivery relay, diagnose cloud port connectivity, view live transaction logs, and manage mailboxes.
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
      <div className="flex border-b border-gray-200 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('mail_server')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'mail_server'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Mail Server & SMTP Relay</span>
          {smtpConfig.is_active && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('delivery_logs');
            loadDeliveryLogsOnly();
          }}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'delivery_logs'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Delivery Logs & Diagnostics ({deliveryLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Outbox Retry Queue ({outbox.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'logs'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Audit Logs ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Quotas ({users.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MAIL SERVER & SMTP RELAY CONFIGURATION */}
      {/* ========================================================================= */}
      {activeTab === 'mail_server' && (
        <div className="space-y-6">
          {/* Cloud Port Status Banner */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-bold text-gray-900">Cloud Network & Port Connectivity Matrix</h2>
            </div>
            <p className="text-xs text-gray-600">
              When hosting web applications on Render, AWS, or DigitalOcean, outbound email requires authenticated SMTP over designated secure ports:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-900">Port 587</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-200 text-emerald-800 rounded">RECOMMENDED</span>
                </div>
                <div className="text-[11px] font-medium text-emerald-800">STARTTLS Submission</div>
                <div className="text-[10px] text-emerald-700">Open on Render & all clouds. Supports Brevo, SendGrid, Namecheap.</div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-900">Port 465</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-200 text-blue-800 rounded">SUPPORTED</span>
                </div>
                <div className="text-[11px] font-medium text-blue-800">SMTPS (Direct SSL/TLS)</div>
                <div className="text-[10px] text-blue-700">Open on Render. Used by Namecheap Private Email & Gmail.</div>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-900">Port 2525</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-200 text-indigo-800 rounded">SUPPORTED</span>
                </div>
                <div className="text-[11px] font-medium text-indigo-800">Alternate Submission</div>
                <div className="text-[10px] text-indigo-700">Open on Render. Alternative port for SendGrid and Mailgun.</div>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-rose-900">Port 25</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-200 text-rose-800 rounded">BLOCKED BY CLOUD</span>
                </div>
                <div className="text-[11px] font-medium text-rose-800">Direct MX Delivery</div>
                <div className="text-[10px] text-rose-700">Blocked by Render to prevent spam. Use Port 587 or 465 instead.</div>
              </div>
            </div>
          </div>

          {/* Quick 1-Click Presets */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">1-Click Quick Provider Presets</h3>
              </div>
              <span className="text-[11px] text-gray-400">Click to fill host & recommended port</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => applyPreset('namecheap_private')}
                className="p-2.5 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 text-left transition-all group"
              >
                <div className="font-bold text-xs text-gray-900 group-hover:text-purple-700">Namecheap Email</div>
                <div className="text-[10px] text-gray-500 font-mono">mail.privateemail.com</div>
                <div className="text-[9px] text-purple-600 font-medium mt-0.5">Port 465 (SSL)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('namecheap_cpanel')}
                className="p-2.5 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 text-left transition-all group"
              >
                <div className="font-bold text-xs text-gray-900 group-hover:text-purple-700">cPanel Webmail</div>
                <div className="text-[10px] text-gray-500 font-mono">mail.yourdomain.com</div>
                <div className="text-[9px] text-purple-600 font-medium mt-0.5">Port 465 (SSL)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('brevo')}
                className="p-2.5 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 text-left transition-all group"
              >
                <div className="font-bold text-xs text-gray-900 group-hover:text-purple-700">Brevo (Free 300/day)</div>
                <div className="text-[10px] text-gray-500 font-mono">smtp-relay.brevo.com</div>
                <div className="text-[9px] text-emerald-600 font-medium mt-0.5">Port 587 (TLS)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('sendgrid')}
                className="p-2.5 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 text-left transition-all group"
              >
                <div className="font-bold text-xs text-gray-900 group-hover:text-purple-700">SendGrid Relay</div>
                <div className="text-[10px] text-gray-500 font-mono">smtp.sendgrid.net</div>
                <div className="text-[9px] text-emerald-600 font-medium mt-0.5">Port 587 (TLS)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('gmail')}
                className="p-2.5 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 text-left transition-all group"
              >
                <div className="font-bold text-xs text-gray-900 group-hover:text-purple-700">Google Workspace</div>
                <div className="text-[10px] text-gray-500 font-mono">smtp.gmail.com</div>
                <div className="text-[9px] text-purple-600 font-medium mt-0.5">Port 465 (SSL)</div>
              </button>
            </div>
          </div>

          {/* Main SMTP Configuration Form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Outbound SMTP Relay Settings</h3>
                <p className="text-xs text-gray-500">Configure the server credentials used to send outbound emails across the internet.</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-2 cursor-pointer">
                  <span>Enable Global Relay:</span>
                  <input
                    type="checkbox"
                    checked={smtpConfig.is_active}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, is_active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <form onSubmit={handleSaveSmtpConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    SMTP Host Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="e.g. mail.privateemail.com or smtp-relay.brevo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                    placeholder="587 or 465"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    SMTP Username / Mailbox Email
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.user}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                    placeholder="e.g. support@yourdomain.com or apikey"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">For Namecheap, this is your full mailbox email address.</p>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    SMTP Password / API Key
                  </label>
                  <input
                    type="password"
                    value={smtpConfig.pass}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Stored securely on the server. Never exposed to clients.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Default Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.from_name || ''}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                    placeholder="e.g. ApexMail Dispatch"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpConfig.secure}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-gray-800">Use Direct SSL/TLS (Port 465)</span>
                      <p className="text-[10px] text-gray-400">Leave unchecked for Port 587 (which auto-upgrades to STARTTLS).</p>
                    </div>
                  </label>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSmtp}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
                >
                  {isSavingSmtp ? 'Saving Settings...' : 'Save Mail Server Configuration'}
                </button>
              </div>
            </form>
          </div>

          {/* Interactive Live Connection Test & Diagnostic Tool */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-bold text-sm text-gray-900">Live SMTP Handshake & Diagnostic Test</h3>
                <p className="text-xs text-gray-500">Test the TCP socket, verify authentication credentials, and optionally dispatch a real ping email.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Optional: Enter test recipient (e.g. your personal email) to verify real delivery"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleRunSmtpTest}
                disabled={isTestingSmtp}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl text-xs shadow-xs transition-colors shrink-0 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isTestingSmtp ? 'animate-spin' : ''}`} />
                <span>{isTestingSmtp ? 'Running Handshake...' : 'Run Live Diagnostic Test'}</span>
              </button>
            </div>

            {/* Diagnostic Terminal Result */}
            {testResult && (
              <div className="mt-4 rounded-xl bg-gray-950 text-gray-100 p-4 font-mono text-[11px] space-y-2 border border-gray-800 shadow-inner">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${testResult.success ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
                    <span className="font-bold uppercase tracking-wider">
                      {testResult.success ? 'Connection Success (250 OK)' : 'Handshake Failed'}
                    </span>
                  </div>
                  <span className="text-gray-400 text-[10px]">Latency: {testResult.duration_ms}ms</span>
                </div>

                <div className="space-y-1 py-1 max-h-56 overflow-y-auto">
                  {testResult.logs.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.startsWith('✓')
                          ? 'text-emerald-400'
                          : line.startsWith('✗')
                          ? 'text-rose-400 font-bold'
                          : line.startsWith('⚠️')
                          ? 'text-amber-400'
                          : 'text-gray-300'
                      }
                    >
                      {line}
                    </div>
                  ))}
                </div>

                {testResult.error && (
                  <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs mt-2">
                    <strong>Root Cause:</strong> {testResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DELIVERY LOGS & TRANSACTION TRACE */}
      {/* ========================================================================= */}
      {activeTab === 'delivery_logs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-600" />
                  <span>Real-Time Mail Transaction & Delivery Logs</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Detailed inspection logs for every outbound dispatch and inbound receipt, including SMTP server responses, error codes, and port latency.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadDeliveryLogsOnly}
                  disabled={isLoadingDeliveryLogs}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDeliveryLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleClearDeliveryLogs}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1 border border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Logs</span>
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={deliverySearch}
                  onChange={(e) => setDeliverySearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadDeliveryLogsOnly()}
                  placeholder="Search by email, subject, host, or error..."
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                />
              </div>

              <select
                value={deliveryFilterStatus}
                onChange={(e) => setDeliveryFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-purple-500 text-xs font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="delivered">Delivered (250 OK)</option>
                <option value="failed">Failed / Errors</option>
                <option value="queued">Queued in Outbox</option>
              </select>

              <select
                value={deliveryFilterDirection}
                onChange={(e) => setDeliveryFilterDirection(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-purple-500 text-xs font-semibold"
              >
                <option value="all">All Directions</option>
                <option value="outbound">Outbound Only</option>
                <option value="inbound">Inbound Only</option>
              </select>
            </div>
          </div>

          {/* Delivery Logs Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs text-xs">
            {deliveryLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-500 space-y-2">
                <Terminal className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="font-semibold text-gray-700">No delivery logs recorded yet.</p>
                <p className="text-xs text-gray-400">Send an email or run the SMTP live diagnostic test to generate delivery logs.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sender / Recipient</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Mail Relay / Port</th>
                      <th className="px-4 py-3">Response / Error Trace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {deliveryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {log.direction === 'outbound' ? (
                            <span className="inline-flex items-center gap-1 text-purple-700 font-bold text-[10px]">
                              <ArrowUpRight className="w-3 h-3" />
                              OUT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-bold text-[10px]">
                              <ArrowDownLeft className="w-3 h-3" />
                              IN
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : log.status === 'failed'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <div className="font-semibold text-gray-900">{log.mailbox_address}</div>
                          <div className="text-[10px] text-gray-500 truncate max-w-xs">
                            → {log.to_addresses.join(', ')}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-sans text-gray-800 truncate max-w-xs" title={log.subject}>
                          {log.subject || '(No Subject)'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-700">{log.smtp_host || 'Direct'}</div>
                          <div className="text-[10px] text-gray-400">
                            Port {log.smtp_port} • {log.tls_type} ({log.duration_ms}ms)
                          </div>
                        </td>
                        <td className="px-4 py-3 font-sans max-w-sm">
                          {log.status === 'delivered' ? (
                            <span className="text-emerald-700 text-[11px] font-mono truncate block" title={log.response_message}>
                              ✓ {log.response_message || '250 OK Delivered'}
                            </span>
                          ) : (
                            <span className="text-rose-700 font-semibold text-[11px] block" title={log.error_reason || log.response_message}>
                              ✗ {log.error_reason || log.response_message || 'Delivery error'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: OUTBOX RETRY QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs text-xs space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Outbound SMTP Dispatch & Retry Worker</span>
              </h3>
              <span className="text-gray-400 text-[11px]">Worker interval: 15s • Exponential backoff with auto-failover</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFlushOutbox}
                disabled={isFlushingOutbox || outbox.length === 0}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isFlushingOutbox ? 'Flushing Outbox...' : 'Flush Outbox Queue Now'}</span>
              </button>
            </div>
          </div>

          {outbox.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-semibold text-gray-800">Outbox queue is currently empty.</div>
              <div className="text-xs text-gray-400 mt-1">All outbound emails have been delivered to destination servers.</div>
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

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT LOGS */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* TAB 5: USERS & QUOTAS */}
      {/* ========================================================================= */}
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
