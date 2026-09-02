// src/components/SettingsModal.tsx
// User Settings, Mailbox HTML Signatures, IMAP/SMTP Connection Guide & Outbound Relay Config

import React, { useState } from 'react';
import {
  Settings,
  X,
  Mail,
  FileText,
  Server,
  Key,
  Shield,
  Check,
  Save,
  Copy,
  ExternalLink
} from 'lucide-react';
import { User, Mailbox } from '../types';
import { api } from '../api/client';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  mailboxes: Mailbox[];
  onRefreshData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  mailboxes,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'signatures' | 'protocols' | 'profile'>('signatures');
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>(mailboxes[0]?.id || '');
  const [signatureText, setSignatureText] = useState<string>(
    mailboxes.find((m) => m.id === selectedMailboxId)?.signature_html || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentMb = mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];

  const handleSelectMailbox = (id: string) => {
    setSelectedMailboxId(id);
    const mb = mailboxes.find((m) => m.id === id);
    setSignatureText(mb?.signature_html || '');
  };

  const handleSaveSignature = async () => {
    if (!selectedMailboxId) return;
    setIsSaving(true);
    try {
      await api.updateMailbox(selectedMailboxId, { signature_html: signatureText });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefreshData();
    } catch (err: any) {
      alert(`Failed to save signature: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full h-[600px] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-base text-gray-900">Email & Mailbox Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 px-6 bg-gray-50/50 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('signatures')}
            className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'signatures'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Email Signatures</span>
          </button>

          <button
            onClick={() => setActiveTab('protocols')}
            className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'protocols'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>IMAP & SMTP Protocol Config</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Account & Quotas</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tab 1: Signatures */}
          {activeTab === 'signatures' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Mailbox</label>
                <select
                  value={selectedMailboxId}
                  onChange={(e) => handleSelectMailbox(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {mailboxes.map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.address} ({mb.display_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  HTML Email Signature
                </label>
                <textarea
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  rows={6}
                  placeholder="<p>Best regards,<br/><strong>Alex Rivera</strong><br/>VP Engineering | Acme Corp</p>"
                  className="w-full p-3 border border-gray-300 rounded-xl font-mono text-xs text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Supports custom HTML tags (e.g. <code>&lt;strong&gt;</code>, <code>&lt;a&gt;</code>, <code>&lt;img&gt;</code>).
                </p>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Live Signature Preview</label>
                <div
                  className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 min-h-[70px]"
                  dangerouslySetInnerHTML={{
                    __html: signatureText || '<span class="text-gray-400 italic">No signature set.</span>',
                  }}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveSignature}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
                >
                  {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Signature'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: IMAP & SMTP Protocol Config */}
          {activeTab === 'protocols' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Desktop & Mobile Mail Client Integration (Apple Mail, Outlook, Thunderbird)</span>
                </div>
                <p className="text-blue-800 leading-relaxed text-[11px]">
                  Connect external email clients using standards-compliant IMAP and authenticated SMTP protocols.
                </p>
              </div>

              {/* IMAP Server Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="font-bold text-gray-800">Incoming Mail Server (IMAP)</div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">Server Host:</span>
                    <span className="font-mono font-bold text-gray-900">mail.yourdomain.com</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Port:</span>
                    <span className="font-mono font-bold text-gray-900">993 (SSL/TLS) or 143 (STARTTLS)</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Username:</span>
                    <span className="font-mono font-bold text-gray-900">{currentMb?.address || 'user@domain.com'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Authentication:</span>
                    <span className="font-mono font-bold text-gray-900">Normal Password / App Password</span>
                  </div>
                </div>
              </div>

              {/* SMTP Server Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="font-bold text-gray-800">Outgoing Mail Server (SMTP)</div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">Server Host:</span>
                    <span className="font-mono font-bold text-gray-900">smtp.yourdomain.com</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Port:</span>
                    <span className="font-mono font-bold text-gray-900">587 (STARTTLS) or 465 (SSL/TLS)</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">DKIM Signing:</span>
                    <span className="font-mono font-bold text-emerald-600">Automatic 2048-bit RSA</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Rate Limit Protection:</span>
                    <span className="font-mono font-bold text-gray-900">100 msgs / min</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <img
                  src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=2563eb&color=fff`}
                  alt="Avatar"
                  className="w-14 h-14 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <h3 className="font-bold text-base text-gray-900">{user?.name}</h3>
                  <div className="text-gray-500">{user?.email}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                    {user?.role} Tier
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2">
                <div className="font-bold text-gray-800">Mailbox Storage Allocation</div>
                <div className="text-gray-500 text-[11px]">
                  Used: {((user?.storage_used_bytes || 0) / (1024 * 1024)).toFixed(1)} MB / 10 GB Total Quota
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: `${Math.max(1, ((user?.storage_used_bytes || 0) / 10737418240) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
