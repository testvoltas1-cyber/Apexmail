// src/components/EmailList.tsx
// Gmail-style email list view with bulk actions, threads, labels & hover quick actions

import React, { useState } from 'react';
import {
  Star,
  Trash2,
  MailOpen,
  Mail,
  Archive,
  AlertOctagon,
  Paperclip,
  CheckSquare,
  Square,
  RefreshCw,
  Tag,
  Inbox,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Email, EmailFolder } from '../types';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  currentFolder: EmailFolder | string;
  selectedLabel: string | null;
  searchQuery: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onBulkAction: (action: string, ids: string[], value?: any) => Promise<void>;
  onOpenCompose: () => void;
  onOpenSimulator: () => void;
  customLabels: { name: string; color: string }[];
  onAddLabel: (name: string, color: string) => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  currentFolder,
  selectedLabel,
  searchQuery,
  onRefresh,
  isRefreshing,
  onBulkAction,
  onOpenCompose,
  onOpenSimulator,
  customLabels,
  onAddLabel,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'primary' | 'promotions' | 'social'>('primary');
  const [showLabelMenu, setShowLabelMenu] = useState(false);

  // Filter emails by tab/search/label
  const filteredEmails = emails.filter((email) => {
    if (selectedLabel) {
      if (!email.labels.includes(selectedLabel)) return false;
    }
    return true;
  });

  const allSelected = filteredEmails.length > 0 && selectedIds.length === filteredEmails.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < filteredEmails.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmails.map((e) => e.id));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleStarToggle = (email: Email, e: React.MouseEvent) => {
    e.stopPropagation();
    onBulkAction('star', [email.id], !email.is_starred);
  };

  const handleQuickAction = (action: string, email: Email, e: React.MouseEvent) => {
    e.stopPropagation();
    onBulkAction(action, [email.id]);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden h-[calc(100vh-4rem)]">
      {/* Top Action Bar */}
      <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-white select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* Select All Checkbox */}
          <button
            onClick={handleToggleSelectAll}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            title="Select All"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : isIndeterminate ? (
              <div className="w-4 h-4 rounded border-2 border-blue-600 flex items-center justify-center">
                <div className="w-2 h-0.5 bg-blue-600" />
              </div>
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Bulk Action Buttons (Appear when items selected) */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 pl-2 border-l border-gray-200 animate-in fade-in duration-100">
              <span className="text-xs font-semibold text-gray-600 px-1">
                {selectedIds.length} selected
              </span>

              <button
                onClick={() => {
                  onBulkAction('mark_read', selectedIds, true);
                  setSelectedIds([]);
                }}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Mark as Read"
              >
                <MailOpen className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onBulkAction('mark_read', selectedIds, false);
                  setSelectedIds([]);
                }}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Mark as Unread"
              >
                <Mail className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onBulkAction('archive', selectedIds);
                  setSelectedIds([]);
                }}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onBulkAction('trash', selectedIds);
                  setSelectedIds([]);
                }}
                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                title="Move to Trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onBulkAction('spam', selectedIds);
                  setSelectedIds([]);
                }}
                className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded"
                title="Report Spam"
              >
                <AlertOctagon className="w-4 h-4" />
              </button>

              {/* Labels dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowLabelMenu(!showLabelMenu)}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded flex items-center gap-1"
                  title="Apply Label"
                >
                  <Tag className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {showLabelMenu && (
                  <div 
                    className="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Apply Label
                    </div>
                    {customLabels.map((l) => (
                      <button
                        key={l.name}
                        onClick={() => {
                          selectedIds.forEach((id) => {
                            const email = emails.find((e) => e.id === id);
                            if (email && !email.labels.includes(l.name)) {
                              onBulkAction('label', [id], [...email.labels, l.name]);
                            }
                          });
                          setSelectedIds([]);
                          setShowLabelMenu(false);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.color}`}></span>
                        <span className="truncate">{l.name}</span>
                      </button>
                    ))}
                    {customLabels.length === 0 && (
                      <div className="px-3 py-2 text-gray-400 italic text-[11px]">No labels available</div>
                    )}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setShowLabelMenu(false);
                          const name = prompt('Enter new label name:');
                          if (name && name.trim()) {
                            const colors = ['bg-blue-500', 'bg-red-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500'];
                            const randomColor = colors[Math.floor(Math.random() * colors.length)];
                            onAddLabel(name.trim(), randomColor);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-blue-50 text-blue-600 font-semibold flex items-center gap-1.5"
                      >
                        <span>+ Create New Label</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Info info */}
        <div className="text-xs text-gray-500 font-medium">
          {filteredEmails.length} {filteredEmails.length === 1 ? 'message' : 'messages'}
          {selectedLabel && <span className="ml-1 font-bold text-blue-600">in #{selectedLabel}</span>}
        </div>
      </div>

      {/* Gmail-Style Inbox Category Tabs (Only in Inbox) */}
      {currentFolder === 'inbox' && !searchQuery && !selectedLabel && (
        <div className="flex border-b border-gray-200 text-xs font-semibold bg-gray-50/50 shrink-0">
          <button
            onClick={() => setActiveTab('primary')}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
              activeTab === 'primary'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Primary</span>
          </button>
          <button
            onClick={() => setActiveTab('promotions')}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
              activeTab === 'promotions'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>Promotions & Newsletters</span>
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
              activeTab === 'social'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Clock className="w-4 h-4 text-purple-600" />
            <span>Updates & System</span>
          </button>
        </div>
      )}

      {/* Email Rows List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filteredEmails.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {searchQuery ? 'No matching emails found' : `Your ${currentFolder} is empty`}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mb-4">
              {searchQuery
                ? `No messages matched "${searchQuery}". Try clearing search filters.`
                : 'Emails sent to or from your custom domain mailboxes will appear here.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenCompose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                Compose New Email
              </button>
              <button
                onClick={onOpenSimulator}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate Inbound Email</span>
              </button>
            </div>
          </div>
        ) : (
          filteredEmails.map((email) => {
            const isSelected = selectedIds.includes(email.id);
            const isRead = email.is_read;
            const isSentFolder = email.folder === 'sent';
            const displayName = isSentFolder
              ? `To: ${email.to_addresses.map((t) => t.name || t.address).join(', ')}`
              : email.from_name || email.from_address;

            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors border-l-4 ${
                  !isRead
                    ? 'bg-white font-semibold text-gray-950 border-blue-600'
                    : 'bg-gray-50/40 text-gray-700 border-transparent hover:bg-gray-100/70'
                } ${isSelected ? 'bg-blue-50/70' : ''}`}
              >
                {/* Left Controls: Checkbox & Star */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => handleToggleSelectOne(email.id, e)}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />
                    )}
                  </button>

                  <button
                    onClick={(e) => handleStarToggle(email, e)}
                    className="p-1 rounded transition-transform active:scale-125"
                    title={email.is_starred ? 'Unstar' : 'Star'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        email.is_starred
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-300 hover:text-gray-400'
                      }`}
                    />
                  </button>
                </div>

                {/* Sender Name */}
                <div className="w-44 truncate shrink-0 text-xs">
                  <span className={!isRead ? 'font-bold text-gray-900' : 'text-gray-700'}>
                    {displayName}
                  </span>
                </div>

                {/* Subject & Snippet Preview */}
                <div className="flex-1 min-w-0 flex items-center gap-2 text-xs">
                  <span
                    className={`truncate ${
                      !isRead ? 'font-bold text-gray-900' : 'text-gray-800'
                    }`}
                  >
                    {email.subject || '(No Subject)'}
                  </span>
                  <span className="text-gray-400 shrink-0">—</span>
                  <span className="truncate text-gray-500 font-normal">
                    {email.snippet}
                  </span>

                  {/* Label Chips */}
                  {email.labels && email.labels.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {email.labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200"
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Spam indicator */}
                  {email.spam_score >= 5.0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Spam ({email.spam_score})
                    </span>
                  )}
                </div>

                {/* Attachment icon */}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="shrink-0 text-gray-400 flex items-center" title={`${email.attachments.length} attachment(s)`}>
                    <Paperclip className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Date */}
                <div className="w-20 text-right text-[11px] text-gray-500 shrink-0 group-hover:hidden">
                  {formatDate(email.received_at)}
                </div>

                {/* Hover Quick Actions Toolbar (Gmail style) */}
                <div className="hidden group-hover:flex items-center gap-1 shrink-0 bg-transparent pl-2">
                  <button
                    onClick={(e) => handleQuickAction('archive', email, e)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors"
                    title="Archive"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleQuickAction('trash', email, e)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) =>
                      handleQuickAction(
                        'mark_read',
                        email,
                        e
                      )
                    }
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title={email.is_read ? 'Mark Unread' : 'Mark Read'}
                  >
                    {email.is_read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
