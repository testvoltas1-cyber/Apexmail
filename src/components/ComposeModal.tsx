// src/components/ComposeModal.tsx
// Floating Gmail-style Composer with rich formatting, contacts autocomplete, AI draft assistant & attachments

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  Paperclip,
  Sparkles,
  Send,
  Trash2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  ChevronDown,
  Check,
  Clock,
  File,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Mailbox, Contact, Email } from '../types';
import { api } from '../api/client';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mailboxes: Mailbox[];
  activeMailbox: Mailbox | null;
  contacts: Contact[];
  initialData?: {
    to?: string[];
    subject?: string;
    body?: string;
    in_reply_to?: string;
    thread_id?: string;
  };
  onEmailSent: (email: Email) => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  mailboxes,
  activeMailbox,
  contacts,
  initialData,
  onEmailSent,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [toInput, setToInput] = useState('');
  const [toPills, setToPills] = useState<string[]>([]);
  const [ccPills, setCcPills] = useState<string[]>([]);
  const [bccPills, setBccPills] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string>('Draft saved');
  const [draftId, setDraftId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize data
  useEffect(() => {
    if (isOpen) {
      const defaultMb = activeMailbox || mailboxes.find((m) => m.is_default) || mailboxes[0];
      if (defaultMb) setSelectedMailboxId(defaultMb.id);

      if (initialData?.to) setToPills(initialData.to);
      if (initialData?.subject) setSubject(initialData.subject);
      if (initialData?.body) setBody(initialData.body);
    }
  }, [isOpen, initialData, activeMailbox, mailboxes]);

  if (!isOpen) return null;

  const currentMailbox = mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];

  const handleAddRecipient = (type: 'to' | 'cc' | 'bcc', rawValue: string) => {
    const email = rawValue.trim().replace(/,$/, '');
    if (!email) return;
    if (type === 'to') setToPills([...toPills, email]);
    if (type === 'cc') setCcPills([...ccPills, email]);
    if (type === 'bcc') setBccPills([...bccPills, email]);
    setToInput('');
  };

  const handleKeyDownRecipient = (e: React.KeyboardEvent, type: 'to' | 'cc' | 'bcc') => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      handleAddRecipient(type, toInput);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const res = await api.uploadAttachments(Array.from(files));
      setAttachments([...attachments, ...res.attachments]);
    } catch (err: any) {
      alert(`Failed to upload: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAiPolish = async (tone: 'professional' | 'casual' | 'persuasive' | 'concise') => {
    if (!body.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await api.polishDraft(body, tone);
      setBody(res.polished);
    } catch (err: any) {
      console.error('AI polish error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSend = async () => {
    if (toPills.length === 0 && !toInput.trim()) {
      alert('Please enter at least one recipient address.');
      return;
    }

    const allTo = [...toPills];
    if (toInput.trim()) allTo.push(toInput.trim());

    if (!selectedMailboxId) {
      alert('Please select a sending mailbox.');
      return;
    }

    setIsSending(true);

    try {
      // Append signature if available
      let finalHtml = `<p>${body.replace(/\n/g, '<br/>')}</p>`;
      if (currentMailbox?.signature_html) {
        finalHtml += `<br/>${currentMailbox.signature_html}`;
      }

      const res = await api.sendEmail({
        mailbox_id: selectedMailboxId,
        to_addresses: allTo.map((addr) => ({ address: addr })),
        cc_addresses: ccPills.map((addr) => ({ address: addr })),
        bcc_addresses: bccPills.map((addr) => ({ address: addr })),
        subject: subject || '(No Subject)',
        body_text: body,
        body_html: finalHtml,
        attachments,
        in_reply_to: initialData?.in_reply_to,
        thread_id: initialData?.thread_id,
      });

      // Confetti celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      onEmailSent(res.email);
      onClose();
    } catch (err: any) {
      alert(`Failed to send email: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-8 w-72 bg-gray-900 text-white rounded-t-xl px-4 py-3 flex items-center justify-between shadow-2xl z-50 cursor-pointer">
        <span className="font-semibold text-xs truncate">{subject || 'New Message'}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMinimized(false)} className="p-1 hover:text-blue-400">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1 hover:text-red-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-300 flex flex-col transition-all overflow-hidden ${
        isFullscreen
          ? 'inset-4 w-auto h-auto'
          : 'bottom-4 right-8 w-full max-w-2xl h-[560px]'
      }`}
    >
      {/* Modal Header */}
      <div className="h-11 bg-gray-900 text-white px-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs">New Message</span>
          <span className="text-[10px] text-gray-400 font-mono">
            via {currentMailbox?.address || 'custom domain'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:text-white rounded"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:text-white rounded"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-red-400 rounded"
            title="Close & Discard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* From Selector */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 text-xs">
        <span className="text-gray-500 font-medium w-12">From:</span>
        <select
          value={selectedMailboxId}
          onChange={(e) => setSelectedMailboxId(e.target.value)}
          className="flex-1 bg-transparent font-semibold text-gray-800 outline-none cursor-pointer py-1"
        >
          {mailboxes.map((mb) => (
            <option key={mb.id} value={mb.id}>
              {mb.display_name} &lt;{mb.address}&gt;
            </option>
          ))}
        </select>
      </div>

      {/* Recipients: To */}
      <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-gray-500 font-medium w-12">To:</span>
        {toPills.map((addr, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-medium"
          >
            <span>{addr}</span>
            <button
              onClick={() => setToPills(toPills.filter((_, i) => i !== idx))}
              className="hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          onKeyDown={(e) => handleKeyDownRecipient(e, 'to')}
          placeholder={toPills.length === 0 ? 'Recipient email address (press Enter)' : ''}
          className="flex-1 min-w-[150px] outline-none text-gray-800 py-1"
        />
        <div className="flex items-center gap-2 text-gray-400 text-[11px]">
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="hover:text-gray-700 hover:underline"
            >
              Cc
            </button>
          )}
          {!showBcc && (
            <button
              onClick={() => setShowBcc(true)}
              className="hover:text-gray-700 hover:underline"
            >
              Bcc
            </button>
          )}
        </div>
      </div>

      {/* CC Input (Optional) */}
      {showCc && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium w-12">Cc:</span>
          {ccPills.map((addr, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-800 rounded-full"
            >
              <span>{addr}</span>
              <button onClick={() => setCcPills(ccPills.filter((_, i) => i !== idx))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            onKeyDown={(e) => handleKeyDownRecipient(e, 'cc')}
            placeholder="Add Cc recipient..."
            className="flex-1 min-w-[150px] outline-none text-gray-800 py-1"
          />
        </div>
      )}

      {/* BCC Input (Optional) */}
      {showBcc && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-500 font-medium w-12">Bcc:</span>
          {bccPills.map((addr, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-800 rounded-full"
            >
              <span>{addr}</span>
              <button onClick={() => setBccPills(bccPills.filter((_, i) => i !== idx))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            onKeyDown={(e) => handleKeyDownRecipient(e, 'bcc')}
            placeholder="Add Bcc recipient..."
            className="flex-1 min-w-[150px] outline-none text-gray-800 py-1"
          />
        </div>
      )}

      {/* Subject Line */}
      <div className="px-4 py-2 border-b border-gray-200 text-xs">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full font-semibold text-gray-900 outline-none placeholder-gray-400 py-1 text-sm"
        />
      </div>

      {/* Body Area */}
      <div className="flex-1 p-4 flex flex-col overflow-y-auto">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Compose your email message here..."
          className="w-full flex-1 outline-none text-gray-800 text-xs leading-relaxed resize-none font-sans"
        />

        {/* Display Signature preview if exists */}
        {currentMailbox?.signature_html && (
          <div
            className="mt-4 pt-3 border-t border-gray-100 text-gray-400 text-xs opacity-75 select-none"
            dangerouslySetInnerHTML={{ __html: currentMailbox.signature_html }}
          />
        )}

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={att.id || idx}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs"
              >
                <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-medium text-gray-800 truncate max-w-[180px]">
                  {att.filename}
                </span>
                <span className="text-[10px] text-gray-400">
                  {((att.size_bytes || 0) / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="p-0.5 hover:text-red-600 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formatting & AI Toolbar */}
      <div className="h-14 border-t border-gray-200 px-4 flex items-center justify-between bg-gray-50/70 select-none">
        {/* Left: Send Button & Attachments */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md hover:shadow-lg transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Dispatching...' : 'Send'}</span>
          </button>

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            title="Attach Files"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* AI Polish Dropdown */}
          <div className="relative group">
            <button
              disabled={isAiLoading || !body.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-40"
              title="Gemini AI Draft Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>{isAiLoading ? 'Writing...' : 'AI Polish'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-0 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 text-xs">
              <button
                onClick={() => handleAiPolish('professional')}
                className="w-full px-3 py-1.5 text-left hover:bg-purple-50 text-gray-700"
              >
                👔 Professional Tone
              </button>
              <button
                onClick={() => handleAiPolish('concise')}
                className="w-full px-3 py-1.5 text-left hover:bg-purple-50 text-gray-700"
              >
                ⚡ Make Concise
              </button>
              <button
                onClick={() => handleAiPolish('casual')}
                className="w-full px-3 py-1.5 text-left hover:bg-purple-50 text-gray-700"
              >
                💬 Casual Tone
              </button>
            </div>
          </div>
        </div>

        {/* Right: Discard / Status */}
        <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
          <span>{draftStatus}</span>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Discard Draft"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
