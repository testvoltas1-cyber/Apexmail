// src/components/DomainManager.tsx
// Custom Domain Portal: MX, SPF, DKIM 2048-bit RSA, DMARC live DNS verification & mailbox generator

import React, { useState } from 'react';
import {
  Globe,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  RefreshCw,
  Mail,
  ShieldCheck,
  Server,
  Trash2,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Key
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Domain, Mailbox } from '../types';
import { api } from '../api/client';

interface DomainManagerProps {
  domains: Domain[];
  mailboxes: Mailbox[];
  onRefreshData: () => void;
  onOpenSimulator: () => void;
}

export const DomainManager: React.FC<DomainManagerProps> = ({
  domains,
  mailboxes,
  onRefreshData,
  onOpenSimulator,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newSelector, setNewSelector] = useState('mail');
  const [newDmarcPolicy, setNewDmarcPolicy] = useState<'none' | 'quarantine' | 'reject'>('quarantine');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedDomainId, setExpandedDomainId] = useState<string | null>(domains[0]?.id || null);

  // New Mailbox state
  const [showAddMailboxModal, setShowAddMailboxModal] = useState<string | null>(null);
  const [mailboxUsername, setMailboxUsername] = useState('');
  const [mailboxDisplayName, setMailboxDisplayName] = useState('');
  const [mailboxPassword, setMailboxPassword] = useState('');
  const [mailboxRole, setMailboxRole] = useState<'user' | 'admin'>('user');
  const [isCreatingMailbox, setIsCreatingMailbox] = useState(false);

  // SMTP Settings
  const [editingSmtpDomain, setEditingSmtpDomain] = useState<Domain | null>(null);

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.createDomain(newDomainName, newSelector, newDmarcPolicy);
      setShowAddModal(false);
      setNewDomainName('');
      onRefreshData();
      setExpandedDomainId(res.domain.id);
    } catch (err: any) {
      alert(`Failed to add domain: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyDns = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await api.verifyDomain(domainId);
      if (res.domain.is_verified) {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      }
      onRefreshData();
    } catch (err: any) {
      alert(`DNS Verification failed: ${err.message}`);
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleSimulateVerify = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      await api.simulateVerifyDomain(domainId);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      onRefreshData();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleCreateMailbox = async (e: React.FormEvent, domainId: string) => {
    e.preventDefault();
    if (!mailboxUsername.trim() || !mailboxDisplayName.trim()) return;

    setIsCreatingMailbox(true);
    try {
      await api.createMailbox({
        domain_id: domainId,
        username: mailboxUsername,
        display_name: mailboxDisplayName,
        password: mailboxPassword.trim() || undefined,
        role: mailboxRole,
      });
      setShowAddMailboxModal(null);
      setMailboxUsername('');
      setMailboxDisplayName('');
      setMailboxPassword('');
      setMailboxRole('user');
      onRefreshData();
    } catch (err: any) {
      alert(`Failed to create mailbox: ${err.message}`);
    } finally {
      setIsCreatingMailbox(false);
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete domain "${name}" and all associated mailboxes?`)) return;
    try {
      await api.deleteDomain(id);
      onRefreshData();
    } catch (err: any) {
      alert(`Failed to delete domain: ${err.message}`);
    }
  };

  const renderStatusBadge = (status: 'valid' | 'invalid' | 'pending') => {
    if (status === 'valid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Valid</span>
        </span>
      );
    }
    if (status === 'invalid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span>Missing / Invalid</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Pending DNS</span>
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Globe className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Custom Domain Management</h1>
          </div>
          <p className="text-xs text-gray-500 max-w-xl">
            Connect your own domain (e.g. <code>example.com</code>), configure MX, SPF, DKIM (2048-bit RSA) and DMARC records, and provision professional mailboxes like <code>user@example.com</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Domain</span>
          </button>
        </div>
      </div>

      {/* Domain List */}
      <div className="space-y-4">
        {domains.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-800 mb-1">No custom domains added yet</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
              Add your domain to start sending authenticated emails with your custom branding and address.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs"
            >
              Add Your First Domain
            </button>
          </div>
        ) : (
          domains.map((domain) => {
            const isExpanded = expandedDomainId === domain.id;
            const domainMailboxes = mailboxes.filter((m) => m.domain_id === domain.id);

            return (
              <div
                key={domain.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs transition-all"
              >
                {/* Domain Card Header */}
                <div
                  onClick={() => setExpandedDomainId(isExpanded ? null : domain.id)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 select-none border-b border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-sm">
                      {domain.domain_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-base">{domain.domain_name}</span>
                        {domain.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified & Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending DNS Setup</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                        <span>{domainMailboxes.length} active mailbox(es)</span>
                        <span>•</span>
                        <span>DKIM Selector: <code>{domain.dkim_selector}</code></span>
                        <span>•</span>
                        <span>DMARC: <code>{domain.dmarc_policy}</code></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleVerifyDns(domain.id)}
                      disabled={verifyingDomainId === domain.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      title="Run Live DNS Lookup on global nameservers"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verifyingDomainId === domain.id ? 'animate-spin' : ''}`} />
                      <span>{verifyingDomainId === domain.id ? 'Checking DNS...' : 'Verify DNS'}</span>
                    </button>

                    {!domain.is_verified && (
                      <button
                        onClick={() => handleSimulateVerify(domain.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                        title="Simulate successful verification for sandbox preview"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Sandbox Pass</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteDomain(domain.id, domain.domain_name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Domain"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setExpandedDomainId(isExpanded ? null : domain.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details & DNS Tables */}
                {isExpanded && (
                  <div className="p-6 bg-gray-50/40 space-y-6 animate-in fade-in duration-150">
                    {/* Mailboxes Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-blue-600" />
                          <span>Mailboxes for @{domain.domain_name}</span>
                        </h3>
                        <button
                          onClick={() => setShowAddMailboxModal(domain.id)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-100 text-gray-800 text-xs font-semibold border border-gray-200 rounded-lg shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Address (e.g. user@{domain.domain_name})</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {domainMailboxes.map((mb) => (
                          <div
                            key={mb.id}
                            className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-gray-900 truncate">
                                {mb.address}
                              </span>
                              {mb.is_default && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate">{mb.display_name}</div>
                            {mb.signature_html && (
                              <div className="text-[10px] text-gray-400 italic">Custom HTML Signature configured</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* DNS Records Configuration Table */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Required DNS Configuration Records</span>
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            Add these records in your DNS manager (Cloudflare, GoDaddy, Namecheap, Route53, etc.)
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs text-xs">
                        <table className="w-full text-left divide-y divide-gray-200">
                          <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-2.5">Type</th>
                              <th className="px-4 py-2.5">Host / Name</th>
                              <th className="px-4 py-2.5">Value / Destination</th>
                              <th className="px-4 py-2.5 text-center">Priority</th>
                              <th className="px-4 py-2.5">Status</th>
                              <th className="px-4 py-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                            {/* MX Record */}
                            <tr>
                              <td className="px-4 py-3 font-bold text-blue-600">MX</td>
                              <td className="px-4 py-3">@ (or {domain.domain_name})</td>
                              <td className="px-4 py-3 font-semibold text-gray-800">
                                mail.{domain.domain_name}
                              </td>
                              <td className="px-4 py-3 text-center">10</td>
                              <td className="px-4 py-3">{renderStatusBadge(domain.mx_status)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleCopy(`mail.${domain.domain_name}`, `mx-${domain.id}`)}
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                  title="Copy MX value"
                                >
                                  {copiedKey === `mx-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>

                            {/* SPF Record */}
                            <tr>
                              <td className="px-4 py-3 font-bold text-emerald-600">TXT (SPF)</td>
                              <td className="px-4 py-3">@</td>
                              <td className="px-4 py-3 text-gray-800">v=spf1 mx ~all</td>
                              <td className="px-4 py-3 text-center">-</td>
                              <td className="px-4 py-3">{renderStatusBadge(domain.spf_status)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleCopy('v=spf1 mx ~all', `spf-${domain.id}`)}
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                  title="Copy SPF record"
                                >
                                  {copiedKey === `spf-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>

                            {/* DKIM Record (2048-bit RSA) */}
                            <tr>
                              <td className="px-4 py-3 font-bold text-purple-600">TXT (DKIM)</td>
                              <td className="px-4 py-3">
                                {domain.dkim_selector}._domainkey
                              </td>
                              <td className="px-4 py-3 text-gray-800 break-all max-w-xs truncate">
                                v=DKIM1; k=rsa; p={domain.dkim_public_key}
                              </td>
                              <td className="px-4 py-3 text-center">-</td>
                              <td className="px-4 py-3">{renderStatusBadge(domain.dkim_status)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() =>
                                    handleCopy(`v=DKIM1; k=rsa; p=${domain.dkim_public_key}`, `dkim-${domain.id}`)
                                  }
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                  title="Copy DKIM TXT record"
                                >
                                  {copiedKey === `dkim-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>

                            {/* DMARC Record */}
                            <tr>
                              <td className="px-4 py-3 font-bold text-amber-600">TXT (DMARC)</td>
                              <td className="px-4 py-3">_dmarc</td>
                              <td className="px-4 py-3 text-gray-800">
                                v=DMARC1; p={domain.dmarc_policy}; rua=mailto:dmarc@{domain.domain_name}
                              </td>
                              <td className="px-4 py-3 text-center">-</td>
                              <td className="px-4 py-3">{renderStatusBadge(domain.dmarc_status)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      `v=DMARC1; p=${domain.dmarc_policy}; rua=mailto:dmarc@${domain.domain_name}`,
                                      `dmarc-${domain.id}`
                                    )
                                  }
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                  title="Copy DMARC record"
                                >
                                  {copiedKey === `dmarc-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Diagnostics and notes */}
                    {domain.dns_diagnostics && (
                      <div className="p-3 bg-white border border-gray-200 rounded-xl text-xs space-y-1">
                        <div className="font-bold text-gray-800">Diagnostic Logs:</div>
                        <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                          {domain.dns_diagnostics.notes?.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-gray-900">Add New Custom Domain</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDomain} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Domain Name</label>
                <input
                  type="text"
                  required
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="e.g. acme-ventures.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">Enter your apex domain without https:// or www.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">DKIM Selector</label>
                  <input
                    type="text"
                    value={newSelector}
                    onChange={(e) => setNewSelector(e.target.value)}
                    placeholder="mail"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">DMARC Policy</label>
                  <select
                    value={newDmarcPolicy}
                    onChange={(e: any) => setNewDmarcPolicy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="quarantine">Quarantine (Recommended)</option>
                    <option value="reject">Reject (Strict)</option>
                    <option value="none">None (Monitoring)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'Generating Keys...' : 'Add Domain & Generate Keys'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Mailbox Modal */}
      {showAddMailboxModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-gray-900">Create New Mailbox</h3>
              </div>
              <button onClick={() => setShowAddMailboxModal(null)} className="p-1 text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>

            {(() => {
              const currentDom = domains.find((d) => d.id === showAddMailboxModal);
              return (
                <form
                  onSubmit={(e) => handleCreateMailbox(e, showAddMailboxModal)}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Email Address</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        required
                        value={mailboxUsername}
                        onChange={(e) => setMailboxUsername(e.target.value)}
                        placeholder="alex"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-xl font-mono text-gray-600">
                        @{currentDom?.domain_name}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Display Name (Full Name)</label>
                    <input
                      type="text"
                      required
                      value={mailboxDisplayName}
                      onChange={(e) => setMailboxDisplayName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Login Password</label>
                      <input
                        type="password"
                        value={mailboxPassword}
                        onChange={(e) => setMailboxPassword(e.target.value)}
                        placeholder="e.g. user123 (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Account Role</label>
                      <select
                        value={mailboxRole}
                        onChange={(e: any) => setMailboxRole(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="user">User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500">
                    💡 If a password is set, the user can log in with their custom address and open their mailbox immediately.
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMailboxModal(null)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingMailbox}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs"
                    >
                      {isCreatingMailbox ? 'Creating...' : 'Create Mailbox'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
