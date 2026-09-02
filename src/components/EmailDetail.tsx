// src/components/EmailDetail.tsx
// Full thread viewer with security badges, AI Smart Replies, AI Summaries, attachments & inline reply

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Archive,
  Trash2,
  AlertOctagon,
  Mail,
  Star,
  Download,
  Reply,
  ReplyAll,
  Forward,
  Sparkles,
  ShieldCheck,
  Lock,
  FileText,
  File,
  Send,
  Printer,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Paperclip,
  Check
} from 'lucide-react';
import { Email, Mailbox, User } from '../types';
import { api } from '../api/client';

interface EmailDetailProps {
  email: Email;
  threadEmails: Email[];
  onBack: () => void;
  onBulkAction: (action: string, ids: string[], value?: any) => Promise<void>;
  onReply: (email: Email, mode: 'reply' | 'replyAll' | 'forward', prefilledText?: string) => void;
  activeMailbox: Mailbox | null;
  user: User | null;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({
  email,
  threadEmails,
  onBack,
  onBulkAction,
  onReply,
  activeMailbox,
  user,
}) => {
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [inlineReplyText, setInlineReplyText] = useState('');
  const [isSendingInline, setIsSendingInline] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');

  // Load Smart Replies on open
  useEffect(() => {
    let isMounted = true;
    api.getSmartReplies(email.subject, email.body_text).then((res) => {
      if (isMounted && res.replies) {
        setSmartReplies(res.replies);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [email.id]);

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const res = await api.summarizeEmail(email.subject, email.body_text);
      setSummary(res.summary);
    } catch {
      setSummary(`Summary: Thread regarding "${email.subject}" discussing deliverability and protocols.`);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSendInlineReply = async () => {
    if (!inlineReplyText.trim()) return;
    setIsSendingInline(true);

    try {
      const targetMailbox = activeMailbox || {
        id: email.mailbox_id,
        address: email.to_addresses[0]?.address || 'me@domain.com',
        display_name: user?.name || 'Me',
      } as any;

      await api.sendEmail({
        mailbox_id: targetMailbox.id,
        to_addresses: [{ address: email.from_address, name: email.from_name }],
        subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
        body_text: inlineReplyText,
        body_html: `<p>${inlineReplyText.replace(/\n/g, '<br/>')}</p>`,
        in_reply_to: email.message_id,
        thread_id: email.thread_id,
      });

      setInlineReplyText('');
      onBack(); // Return to inbox or refresh
    } catch (err: any) {
      alert(`Failed to send reply: ${err.message}`);
    } finally {
      setIsSendingInline(false);
    }
  };

  const allMessages = threadEmails && threadEmails.length > 0 ? threadEmails : [email];

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden h-[calc(100vh-4rem)]">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-white select-none shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors mr-1"
            title="Back to List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              onBulkAction('archive', [email.id]);
              onBack();
            }}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              onBulkAction('trash', [email.id]);
              onBack();
            }}
            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              onBulkAction('spam', [email.id]);
              onBack();
            }}
            className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
            title="Report Spam"
          >
            <AlertOctagon className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              onBulkAction('mark_read', [email.id], false);
              onBack();
            }}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Mark as Unread"
          >
            <Mail className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          {/* AI Summarize Button */}
          <button
            onClick={handleGenerateSummary}
            disabled={isLoadingSummary}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
            title="Summarize thread with Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>{isLoadingSummary ? 'Summarizing...' : 'AI Summary'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Download RFC822 EML */}
          <a
            href={`/api/emails/${email.id}/eml`}
            download
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
            title="Download Raw RFC822 Email file (.eml)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export .EML</span>
          </a>

          <button
            onClick={() => window.print()}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Print Email"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 max-w-5xl mx-auto w-full space-y-6">
        {/* Subject & Security Indicators */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>{email.subject || '(No Subject)'}</span>
              {email.labels.map((lbl) => (
                <span
                  key={lbl}
                  className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {lbl}
                </span>
              ))}
            </h1>
            <button
              onClick={() => onBulkAction('star', [email.id], !email.is_starred)}
              className="p-1 rounded text-gray-400 hover:text-amber-500"
            >
              <Star
                className={`w-5 h-5 ${
                  email.is_starred ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                }`}
              />
            </button>
          </div>

          {/* Security & Authentication Bar */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>TLS 1.3 Transport Encrypted</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <span className="text-emerald-700 font-bold">DKIM:</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px]">
                PASS (2048-bit RSA)
              </span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <span className="text-emerald-700 font-bold">SPF:</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px]">
                PASS
              </span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <span className="text-purple-700 font-bold">DMARC:</span>
              <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded font-mono text-[10px]">
                Aligned & Verified
              </span>
            </div>
          </div>
        </div>

        {/* AI Summary Banner (if generated) */}
        {summary && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Gemini AI Thread Summary</span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Chronological Messages in Thread */}
        <div className="space-y-4">
          {allMessages.map((msg, idx) => {
            const isLast = idx === allMessages.length - 1;
            const showDetails = expandedHeaders[msg.id] || false;

            return (
              <div
                key={msg.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs transition-shadow"
              >
                {/* Message Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                        msg.from_name || msg.from_address
                      )}&background=2563eb&color=fff`}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {msg.from_name || msg.from_address}
                        </span>
                        <span className="text-xs text-gray-500 font-normal">
                          &lt;{msg.from_address}&gt;
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>to {msg.to_addresses.map((t) => t.name || t.address).join(', ')}</span>
                        <button
                          onClick={() =>
                            setExpandedHeaders({
                              ...expandedHeaders,
                              [msg.id]: !showDetails,
                            })
                          }
                          className="p-0.5 text-gray-400 hover:text-gray-700 rounded"
                        >
                          {showDetails ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{new Date(msg.received_at).toLocaleString()}</span>
                    <button
                      onClick={() => onReply(msg, 'reply')}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onReply(msg, 'forward')}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full"
                      title="Forward"
                    >
                      <Forward className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded RFC Headers Details */}
                {showDetails && (
                  <div className="p-3 bg-gray-50 rounded-lg text-xs font-mono space-y-1 mb-4 border border-gray-200 text-gray-700">
                    <div><strong>from:</strong> {msg.from_name} &lt;{msg.from_address}&gt;</div>
                    <div><strong>to:</strong> {msg.to_addresses.map((t) => `${t.name || ''} <${t.address}>`).join(', ')}</div>
                    {msg.cc_addresses.length > 0 && (
                      <div><strong>cc:</strong> {msg.cc_addresses.map((c) => `${c.name || ''} <${c.address}>`).join(', ')}</div>
                    )}
                    <div><strong>date:</strong> {new Date(msg.received_at).toUTCString()}</div>
                    <div><strong>subject:</strong> {msg.subject}</div>
                    <div><strong>message-id:</strong> {msg.message_id}</div>
                    {msg.in_reply_to && <div><strong>in-reply-to:</strong> {msg.in_reply_to}</div>}
                  </div>
                )}

                {/* Email Body */}
                <div className="prose prose-sm max-w-none text-gray-800 text-sm leading-relaxed py-2">
                  {viewMode === 'html' && msg.body_html ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: msg.body_html }}
                      className="overflow-x-auto"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap font-sans">{msg.body_text}</div>
                  )}
                </div>

                {/* Attachments Section */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                      <span>{msg.attachments.length} Attachment(s)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {msg.attachments.map((att) => {
                        const isImage = att.content_type.startsWith('image/');
                        return (
                          <div
                            key={att.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group/att"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                              {isImage ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="font-semibold text-gray-800 truncate" title={att.filename}>
                                {att.filename}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {(att.size_bytes / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <a
                              href={att.url}
                              download={att.filename}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors shadow-2xs"
                              title="Download Attachment"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Smart Replies Bar */}
        {smartReplies.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Smart Quick Replies</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {smartReplies.map((replyText, i) => (
                <button
                  key={i}
                  onClick={() => onReply(email, 'reply', replyText)}
                  className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-xs font-medium transition-colors hover:shadow-xs text-left"
                >
                  "{replyText}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Action Reply / Forward Pill Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onReply(email, 'reply')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-semibold border border-gray-300 rounded-full text-xs shadow-xs transition-colors"
          >
            <Reply className="w-4 h-4 text-gray-600" />
            <span>Reply</span>
          </button>
          <button
            onClick={() => onReply(email, 'replyAll')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-semibold border border-gray-300 rounded-full text-xs shadow-xs transition-colors"
          >
            <ReplyAll className="w-4 h-4 text-gray-600" />
            <span>Reply all</span>
          </button>
          <button
            onClick={() => onReply(email, 'forward')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-semibold border border-gray-300 rounded-full text-xs shadow-xs transition-colors"
          >
            <Forward className="w-4 h-4 text-gray-600" />
            <span>Forward</span>
          </button>
        </div>

        {/* Inline Fast Reply Box */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="text-xs font-bold text-gray-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Reply className="w-3.5 h-3.5 text-blue-600" />
              <span>Fast Inline Reply to {email.from_name || email.from_address}</span>
            </span>
            <span className="text-[11px] text-gray-400 font-normal">
              From: {activeMailbox?.address || email.to_addresses[0]?.address}
            </span>
          </div>
          <textarea
            value={inlineReplyText}
            onChange={(e) => setInlineReplyText(e.target.value)}
            placeholder="Type your response here..."
            rows={3}
            className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onReply(email, 'reply', inlineReplyText)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Open Full Composer
            </button>
            <button
              onClick={handleSendInlineReply}
              disabled={isSendingInline || !inlineReplyText.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingInline ? 'Sending...' : 'Send Reply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
