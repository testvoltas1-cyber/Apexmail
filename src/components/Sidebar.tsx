// src/components/Sidebar.tsx
// Gmail-style left navigation drawer with Compose, System Folders, Labels & Storage Quota

import React from 'react';
import {
  Inbox,
  Star,
  Send,
  FileText,
  AlertOctagon,
  Trash2,
  Archive,
  Tag,
  Plus,
  Globe,
  ShieldCheck,
  Users,
  HardDrive,
  Mail,
  ChevronRight
} from 'lucide-react';
import { EmailFolder, Mailbox, User } from '../types';

interface SidebarProps {
  currentFolder: EmailFolder | string;
  onSelectFolder: (folder: string) => void;
  unreadCount: number;
  draftsCount: number;
  spamCount: number;
  onOpenCompose: () => void;
  activeView: string;
  onChangeView: (view: string) => void;
  user: User | null;
  mailboxes: Mailbox[];
  selectedMailbox: Mailbox | null;
  onSelectMailbox: (mailbox: Mailbox | null) => void;
  selectedLabel: string | null;
  onSelectLabel: (label: string | null) => void;
  customLabels: { name: string; color: string }[];
  onAddLabel: (name: string, color: string) => void;
  onDeleteLabel: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentFolder,
  onSelectFolder,
  unreadCount,
  draftsCount,
  spamCount,
  onOpenCompose,
  activeView,
  onChangeView,
  user,
  mailboxes,
  selectedMailbox,
  onSelectMailbox,
  selectedLabel,
  onSelectLabel,
  customLabels,
  onAddLabel,
  onDeleteLabel,
}) => {
  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount, badgeColor: 'bg-blue-600 text-white' },
    { id: 'starred', label: 'Starred', icon: Star, count: 0 },
    { id: 'sent', label: 'Sent', icon: Send, count: 0 },
    { id: 'drafts', label: 'Drafts', icon: FileText, count: draftsCount, badgeColor: 'bg-gray-200 text-gray-700' },
    { id: 'archive', label: 'Archive', icon: Archive, count: 0 },
    { id: 'spam', label: 'Spam', icon: AlertOctagon, count: spamCount, badgeColor: 'bg-amber-100 text-amber-800' },
    { id: 'trash', label: 'Trash', icon: Trash2, count: 0 },
  ];

  const handleCreateLabelClick = () => {
    const name = prompt('Enter new label name:');
    if (!name || !name.trim()) return;
    const colors = ['bg-blue-500', 'bg-red-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    onAddLabel(name.trim(), randomColor);
  };

  const storageUsedMB = ((user?.storage_used_bytes || 0) / (1024 * 1024)).toFixed(1);
  const storagePercentage = Math.min(100, Math.max(1, ((user?.storage_used_bytes || 0) / 10737418240) * 100));

  return (
    <aside className="w-60 bg-gray-50 border-r border-gray-200 flex flex-col justify-between select-none py-3 px-2 h-[calc(100vh-4rem)] shrink-0 overflow-y-auto">
      <div className="space-y-4">
        {/* Compose Button */}
        <div className="px-2">
          <button
            onClick={onOpenCompose}
            className="w-full flex items-center justify-center gap-3 py-3 px-5 bg-white hover:bg-blue-50/50 text-gray-800 hover:text-blue-700 font-semibold rounded-2xl shadow-md hover:shadow-lg border border-gray-200 transition-all group"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-600 group-hover:bg-blue-700 flex items-center justify-center text-white transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="tracking-tight text-sm">Compose</span>
          </button>
        </div>

        {/* Primary Folders List */}
        <nav className="space-y-0.5">
          {folders.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === 'mail' && currentFolder === item.id && !selectedLabel;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeView('mail');
                  onSelectLabel(null);
                  onSelectFolder(item.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-r-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 font-bold border-l-4 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-200/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      item.badgeColor || 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Labels Section */}
        <div className="pt-2 border-t border-gray-200">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
            <span>Labels</span>
            <button
              onClick={handleCreateLabelClick}
              className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-900 transition-colors"
              title="Create New Label"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {customLabels.map((l) => {
              const isLabelActive = activeView === 'mail' && selectedLabel === l.name;
              return (
                <div
                  key={l.name}
                  onClick={() => {
                    onChangeView('mail');
                    onSelectLabel(isLabelActive ? null : l.name);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-r-full text-xs transition-colors cursor-pointer group ${
                    isLabelActive
                      ? 'bg-blue-50 text-blue-800 font-bold'
                      : 'text-gray-600 hover:bg-gray-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.color}`}></span>
                    <span className="truncate">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLabel(l.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-600 transition-opacity"
                      title="Delete Label"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {isLabelActive && <ChevronRight className="w-3 h-3 text-blue-600 shrink-0" />}
                  </div>
                </div>
              );
            })}
            {customLabels.length === 0 && (
              <div className="px-3 py-1 text-[11px] text-gray-400 italic">No custom labels yet. Click + to add.</div>
            )}
          </div>
        </div>

        {/* Mailbox Quick Switcher */}
        {mailboxes.length > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>Mailboxes</span>
              <Mail className="w-3 h-3 text-gray-400" />
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectMailbox(null)}
                className={`w-full text-left px-3 py-1.5 rounded-r-full text-xs truncate transition-colors ${
                  !selectedMailbox
                    ? 'bg-gray-200 text-gray-900 font-bold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All Mailboxes
              </button>
              {mailboxes.map((mb) => (
                <button
                  key={mb.id}
                  onClick={() => onSelectMailbox(mb)}
                  className={`w-full text-left px-3 py-1.5 rounded-r-full text-xs truncate transition-colors ${
                    selectedMailbox?.id === mb.id
                      ? 'bg-blue-100 text-blue-900 font-bold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={mb.address}
                >
                  <div className="truncate font-medium">{mb.address}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Storage Bar */}
      <div className="pt-3 border-t border-gray-200 px-2 space-y-2">
        <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 mb-1.5">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Storage</span>
            </span>
            <span>{storageUsedMB} MB / 10 GB</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
        </div>

        {/* Quick Admin Navigation (Admin Only) */}
        {user?.role === 'admin' && (
          <div className="flex gap-1 text-center text-[11px]">
            <button
              onClick={() => onChangeView('domains')}
              className={`flex-1 py-1.5 rounded-lg border font-semibold flex items-center justify-center gap-1 transition-colors ${
                activeView === 'domains'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Domains</span>
            </button>
            <button
              onClick={() => onChangeView('admin')}
              className={`flex-1 py-1.5 rounded-lg border font-semibold flex items-center justify-center gap-1 transition-colors ${
                activeView === 'admin'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Admin</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
