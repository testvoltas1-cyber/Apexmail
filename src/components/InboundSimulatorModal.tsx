// src/components/InboundSimulatorModal.tsx
// Sandbox Inbound SMTP Simulator: Test real delivery, spam scoring & attachments without public DNS

import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Mailbox } from '../types';
import { api } from '../api/client';

interface InboundSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mailboxes: Mailbox[];
  onEmailReceived: () => void;
}

export const InboundSimulatorModal: React.FC<InboundSimulatorModalProps> = ({
  isOpen,
  onClose,
  mailboxes,
  onEmailReceived,
}) => {
  const [selectedMailboxAddress, setSelectedMailboxAddress] = useState(
    mailboxes[0]?.address || 'alex@acme-ventures.com'
  );
  const [fromName, setFromName] = useState('Elena Rostova');
  const [fromAddress, setFromAddress] = useState('elena@techinnovate.com');
  const [subject, setSubject] = useState('Enterprise Security Audit & DKIM Verification Report');
  const [body, setBody] = useState(
    'Hi Alex,\n\nWe completed our quarterly security review and DNS authentication audit for your custom domain.\nAll DKIM signatures passed verification with 2048-bit RSA keys, and DMARC alignment is 100% compliant.\n\nPlease find the attached report for full logs.\n\nBest,\nElena Rostova'
  );
  const [includeAttachment, setIncludeAttachment] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTemplate = (type: 'audit' | 'sales' | 'spam') => {
    if (type === 'audit') {
      setFromName('Elena Rostova');
      setFromAddress('elena@techinnovate.com');
      setSubject('Enterprise Security Audit & DKIM Verification Report');
      setBody(
        'Hi Alex,\n\nWe completed our quarterly security review and DNS authentication audit for your custom domain.\nAll DKIM signatures passed verification with 2048-bit RSA keys, and DMARC alignment is 100% compliant.\n\nBest,\nElena'
      );
      setIncludeAttachment(true);
    } else if (type === 'sales') {
      setFromName('Marcus Sterling');
      setFromAddress('marcus@globalcapital.io');
      setSubject('Q3 Investment Partnership & Term Sheet Follow-up');
      setBody(
        'Dear Team,\n\nThank you for the productive call yesterday. We are excited about the product velocity and would like to finalize the terms.\n\nCan we schedule a 15-minute sync tomorrow?\n\nRegards,\nMarcus Sterling'
      );
      setIncludeAttachment(false);
    } else if (type === 'spam') {
      setFromName('Account Security Alert');
      setFromAddress('security-alert@suspicious-domain.xyz');
      setSubject('URGENT: Click here to claim your $5,000 lottery winnings now!');
      setBody(
        'Congratulations Winner!\n\nYour mailbox was randomly selected for our $5,000 cash prize. Click here immediately to claim your transfer before it expires in 2 hours!\n\nWire Transfer Dept.'
      );
      setIncludeAttachment(false);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setResultMessage(null);

    try {
      const attachments = includeAttachment
        ? [
            {
              id: `att-sim-${Date.now()}`,
              filename: 'Security_Audit_Report_2026.pdf',
              content_type: 'application/pdf',
              size_bytes: 384000,
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            },
          ]
        : [];

      const res = await api.simulateInbound({
        to_address: selectedMailboxAddress,
        from_address: fromAddress,
        from_name: fromName,
        subject,
        body_text: body,
        body_html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
        attachments,
      });

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      setResultMessage(
        `Email delivered into folder "${res.folder}"! (Spam Score: ${res.spam_score})`
      );
      onEmailReceived();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Inbound SMTP Delivery Sandbox</h3>
              <p className="text-[11px] text-gray-500">
                Simulate inbound RFC822 delivery into your custom domain mailboxes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTemplate('audit')}
            className="flex-1 py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200"
          >
            🔒 Security Audit
          </button>
          <button
            type="button"
            onClick={() => handleTemplate('sales')}
            className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200"
          >
            💼 Partnership
          </button>
          <button
            type="button"
            onClick={() => handleTemplate('spam')}
            className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold border border-amber-200"
          >
            ⚠️ Spam Test
          </button>
        </div>

        <form onSubmit={handleSimulate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Target Recipient Mailbox</label>
            <select
              value={selectedMailboxAddress}
              onChange={(e) => setSelectedMailboxAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {mailboxes.map((mb) => (
                <option key={mb.id} value={mb.address}>
                  {mb.address} ({mb.display_name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Sender Name</label>
              <input
                type="text"
                required
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Sender Email</label>
              <input
                type="email"
                required
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Message Body</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeAtt"
              checked={includeAttachment}
              onChange={(e) => setIncludeAttachment(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="includeAtt" className="text-gray-700 font-medium flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-gray-500" />
              <span>Include test attachment (Security_Audit_Report.pdf)</span>
            </label>
          </div>

          {resultMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{resultMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Delivering...' : 'Deliver Email Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
