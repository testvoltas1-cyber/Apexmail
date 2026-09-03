// src/components/Header.tsx
// Top navigation bar with Search, Mailbox Switcher, Inbound Simulator & User Profile

import React, { useState } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  Mail, 
  Globe, 
  ShieldCheck, 
  Users, 
  Settings, 
  Send, 
  Sparkles, 
  LogOut, 
  ChevronDown, 
  Check, 
  RefreshCw,
  HelpCircle,
  HardDrive
} from 'lucide-react';
import { User, Mailbox } from '../types';

interface HeaderProps {
  user: User | null;
  mailboxes: Mailbox[];
  selectedMailbox: Mailbox | null;
  onSelectMailbox: (mailbox: Mailbox | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeView: string;
  onChangeView: (view: string) => void;
  onOpenCompose: () => void;
  onOpenSimulator: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  mailboxes,
  selectedMailbox,
  onSelectMailbox,
  searchQuery,
  onSearchChange,
  activeView,
  onChangeView,
  onOpenCompose,
  onOpenSimulator,
  onOpenSettings,
  onOpenAuth,
  onLogout,
  onRefresh,
  isRefreshing,
}) => {
  const [showMailboxDropdown, setShowMailboxDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterSender, setFilterSender] = useState('');
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    let q = filterSender ? `from:${filterSender}` : '';
    if (filterHasAttachment) {
      q = q ? `${q} has:attachment` : 'has:attachment';
    }
    onSearchChange(q);
    setShowFilterBuilder(false);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between gap-4 select-none z-30 sticky top-0 shadow-xs">
      {/* Brand & Mailbox Switcher */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <div 
          onClick={() => onChangeView('mail')}
          className="flex items-center gap-2 cursor-pointer group"
          title="Go to Inbox"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-200 group-hover:scale-105 transition-transform">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-gray-900 tracking-tight leading-none text-base">
              <span>ApexMail</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                Custom Domain
              </span>
            </div>
            <div className="text-[11px] text-gray-500 font-medium">Enterprise Webmail</div>
          </div>
        </div>

        {/* Mailbox Selector Pill */}
        {mailboxes.length > 0 && (
          <div className="relative ml-2">
            <button
              onClick={() => setShowMailboxDropdown(!showMailboxDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full border border-gray-200 transition-colors"
              title="Switch Active Mailbox"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="max-w-[130px] truncate">
                {selectedMailbox ? selectedMailbox.address : 'All Mailboxes'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {showMailboxDropdown && (
              <div 
                className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 text-xs"
                onClick={() => setShowMailboxDropdown(false)}
              >
                <div className="px-3 py-1.5 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                  Filter by Mailbox
                </div>
                <button
                  onClick={() => onSelectMailbox(null)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 ${
                    !selectedMailbox ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate">All Linked Mailboxes ({mailboxes.length})</span>
                  {!selectedMailbox && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                {mailboxes.map(mb => (
                  <button
                    key={mb.id}
                    onClick={() => onSelectMailbox(mb)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 ${
                      selectedMailbox?.id === mb.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate font-medium">{mb.address}</div>
                      <div className="text-[10px] text-gray-400 truncate">{mb.display_name}</div>
                    </div>
                    {selectedMailbox?.id === mb.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gmail-Style Centered Search Bar */}
      <div className="flex-1 max-w-2xl relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail (e.g. subject, sender, has:attachment)..."
            className="w-full bg-gray-100 hover:bg-gray-150 focus:bg-white text-gray-800 placeholder-gray-500 pl-10 pr-20 py-2 rounded-full text-sm outline-none border border-transparent focus:border-blue-400 focus:shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-10 text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setShowFilterBuilder(!showFilterBuilder)}
            className="absolute right-3 p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
            title="Advanced Search Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Filter dropdown panel */}
        {showFilterBuilder && (
          <form
            onSubmit={handleApplyFilter}
            className="absolute top-12 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 text-xs space-y-3"
          >
            <div className="font-semibold text-gray-800 text-sm">Advanced Search Options</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 mb-1">From / Sender</label>
                <input
                  type="text"
                  value={filterSender}
                  onChange={(e) => setFilterSender(e.target.value)}
                  placeholder="e.g. elena@techinnovate.com"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Subject Contains</label>
                <input
                  type="text"
                  placeholder="e.g. DKIM Report"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="hasAttachment"
                checked={filterHasAttachment}
                onChange={(e) => setFilterHasAttachment(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="hasAttachment" className="text-gray-700 font-medium">
                Has attachment
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setFilterSender('');
                  setFilterHasAttachment(false);
                  setShowFilterBuilder(false);
                }}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-xs"
              >
                Search
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Action Buttons & Profile */}
      <div className="flex items-center gap-1.5">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors relative"
          title="Refresh Mailbox"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>



        {/* View Switcher Tabs (Domains, Admin, Contacts) */}
        <button
          onClick={() => onChangeView(activeView === 'domains' ? 'mail' : 'domains')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors flex items-center gap-1.5 ${
            activeView === 'domains'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
          }`}
          title="Custom Domains & DNS Manager"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Domains & DNS</span>
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => onChangeView(activeView === 'admin' ? 'mail' : 'admin')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors flex items-center gap-1.5 ${
              activeView === 'admin'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
            }`}
            title="System & Outbox Queue Admin"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Admin</span>
          </button>
        )}

        <button
          onClick={() => onChangeView(activeView === 'contacts' ? 'mail' : 'contacts')}
          className={`p-2 rounded-full border transition-colors ${
            activeView === 'contacts'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent'
          }`}
          title="Address Book / Contacts"
        >
          <Users className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          title="Settings, Signatures & Protocols"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Avatar Menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-blue-300 transition-all"
          >
            <img
              src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=2563eb&color=fff`}
              alt="Avatar"
              className="w-8 h-8 rounded-full object-cover border border-gray-200"
            />
          </button>

          {showUserDropdown && (
            <div 
              className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 py-3 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
              onClick={() => setShowUserDropdown(false)}
            >
              <div className="px-4 pb-3 border-b border-gray-100 flex items-center gap-3">
                <img
                  src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=2563eb&color=fff`}
                  alt="Avatar"
                  className="w-11 h-11 rounded-full object-cover border border-gray-200"
                />
                <div className="overflow-hidden">
                  <div className="font-bold text-gray-900 truncate text-sm">{user?.name}</div>
                  <div className="text-gray-500 truncate text-xs">{user?.email}</div>
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded uppercase">
                    Role: {user?.role}
                  </span>
                </div>
              </div>

              {/* Storage usage display */}
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-gray-400" /> Storage Used
                  </span>
                  <span className="font-bold">
                    {((user?.storage_used_bytes || 0) / (1024 * 1024)).toFixed(1)} MB / 10 GB
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full" 
                    style={{ width: `${Math.max(1, ((user?.storage_used_bytes || 0) / 10737418240) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={onOpenSettings}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Email Signatures & SMTP Setup</span>
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => onChangeView('domains')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                  >
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span>Domain DNS & MX Verification</span>
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 px-2 flex gap-1">
                <button
                  onClick={onOpenAuth}
                  className="flex-1 px-3 py-1.5 text-center text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-semibold"
                >
                  Switch Account
                </button>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 text-center text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
