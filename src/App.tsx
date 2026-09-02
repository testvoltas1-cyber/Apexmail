// src/App.tsx
// ApexMail: Modern Gmail-Style Custom-Domain Webmail Application

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';
import { ComposeModal } from './components/ComposeModal';
import { DomainManager } from './components/DomainManager';
import { AdminDashboard } from './components/AdminDashboard';
import { ContactsView } from './components/ContactsView';
import { SettingsModal } from './components/SettingsModal';
import { InboundSimulatorModal } from './components/InboundSimulatorModal';
import { AuthModal } from './components/AuthModal';

import { User, Mailbox, Domain, Contact, Email, EmailFolder } from './types';
import { api } from './api/client';

export const App: React.FC = () => {
  // Authentication & Profile
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Core Data Collections
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);

  // Navigation & Filtering State
  const [activeView, setActiveView] = useState<string>('mail'); // 'mail' | 'domains' | 'admin' | 'contacts'
  const [currentFolder, setCurrentFolder] = useState<EmailFolder | string>('inbox');
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Email & Thread Viewer
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState<any>(undefined);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Loading States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch Current User
  const loadUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  // Fetch Core Entities
  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [mailboxesRes, domainsRes, contactsRes] = await Promise.all([
        api.getMailboxes(),
        api.getDomains(),
        api.getContacts(),
      ]);
      setMailboxes(mailboxesRes.mailboxes);
      setDomains(domainsRes.domains);
      setContacts(contactsRes.contacts);
    } catch (err) {
      console.error('Failed to load base entities:', err);
    } finally {
      setIsRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  // Fetch Emails based on filters
  const loadEmails = useCallback(async () => {
    try {
      const res = await api.getEmails({
        folder: currentFolder,
        mailbox_id: selectedMailbox?.id,
        q: searchQuery || undefined,
        label: selectedLabel || undefined,
      });
      setEmails(res.emails);
    } catch (err) {
      console.error('Failed to load emails:', err);
    }
  }, [currentFolder, selectedMailbox?.id, searchQuery, selectedLabel]);

  // Initial Boot
  useEffect(() => {
    loadUser();
    loadAllData();
  }, [loadUser, loadAllData]);

  // Reload emails on filter changes
  useEffect(() => {
    if (activeView === 'mail') {
      loadEmails();
    }
  }, [activeView, loadEmails]);

  // Handle Email Row Click & Thread Loading
  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    // Mark as read immediately in UI and backend
    if (!email.is_read) {
      api.bulkEmailAction('mark_read', [email.id], true).catch(() => {});
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
      );
    }

    // Load Thread
    try {
      const res = await api.getThread(email.thread_id);
      setThreadEmails(res.thread);
    } catch {
      setThreadEmails([email]);
    }
  };

  // Bulk Actions Handlers
  const handleBulkAction = async (action: string, ids: string[], value?: any) => {
    try {
      await api.bulkEmailAction(action, ids, value);

      // Optimistic updates
      if (action === 'mark_read') {
        setEmails((prev) =>
          prev.map((e) => (ids.includes(e.id) ? { ...e, is_read: !!value } : e))
        );
      } else if (action === 'star') {
        setEmails((prev) =>
          prev.map((e) => (ids.includes(e.id) ? { ...e, is_starred: !!value } : e))
        );
      } else if (['trash', 'archive', 'spam'].includes(action)) {
        setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
      } else if (action === 'label') {
        setEmails((prev) =>
          prev.map((e) => (ids.includes(e.id) ? { ...e, labels: value } : e))
        );
      }
      loadUser(); // update storage
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  // Reply / Reply All / Forward Trigger
  const handleReply = (
    targetEmail: Email,
    mode: 'reply' | 'replyAll' | 'forward',
    prefilledBody?: string
  ) => {
    let to: string[] = [];
    let subject = targetEmail.subject;

    if (mode === 'reply') {
      to = [targetEmail.from_address];
      if (!subject.toLowerCase().startsWith('re:')) subject = `Re: ${subject}`;
    } else if (mode === 'replyAll') {
      to = [
        targetEmail.from_address,
        ...targetEmail.to_addresses.map((t) => t.address),
      ];
      if (!subject.toLowerCase().startsWith('re:')) subject = `Re: ${subject}`;
    } else if (mode === 'forward') {
      if (!subject.toLowerCase().startsWith('fwd:')) subject = `Fwd: ${subject}`;
    }

    const quoteHeader = `\n\n--- Original Message ---\nFrom: ${targetEmail.from_name} <${targetEmail.from_address}>\nDate: ${new Date(targetEmail.received_at).toLocaleString()}\nSubject: ${targetEmail.subject}\n\n${targetEmail.body_text}`;

    setComposeInitialData({
      to,
      subject,
      body: prefilledBody ? `${prefilledBody}${quoteHeader}` : quoteHeader,
      in_reply_to: targetEmail.message_id,
      thread_id: targetEmail.thread_id,
    });
    setIsComposeOpen(true);
  };

  // 1-Click Compose to contact
  const handleComposeToContact = (recipientEmail: string) => {
    setComposeInitialData({
      to: [recipientEmail],
      subject: '',
      body: '',
    });
    setIsComposeOpen(true);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setShowAuthModal(true);
  };

  const unreadCount = emails.filter((e) => !e.is_read && e.folder === 'inbox').length;
  const draftsCount = emails.filter((e) => e.folder === 'drafts').length;
  const spamCount = emails.filter((e) => e.folder === 'spam').length;

  if (initialLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 animate-bounce flex items-center justify-center text-white font-bold text-xl shadow-lg">
          ✉️
        </div>
        <div className="font-bold text-base tracking-tight">ApexMail Custom Domain</div>
        <div className="text-xs text-gray-400">Loading mailbox clusters and DNS configurations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans antialiased text-gray-900">
      {/* Top Header */}
      <Header
        user={user}
        mailboxes={mailboxes}
        selectedMailbox={selectedMailbox}
        onSelectMailbox={(mb) => {
          setSelectedMailbox(mb);
          setSelectedEmail(null);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onChangeView={(v) => {
          setActiveView(v);
          setSelectedEmail(null);
        }}
        onOpenCompose={() => {
          setComposeInitialData(undefined);
          setIsComposeOpen(true);
        }}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onRefresh={() => {
          loadAllData();
          loadEmails();
        }}
        isRefreshing={isRefreshing}
      />

      {/* Main Body with Sidebar and Active View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentFolder={currentFolder}
          onSelectFolder={(folder) => {
            setCurrentFolder(folder);
            setSelectedEmail(null);
          }}
          unreadCount={unreadCount}
          draftsCount={draftsCount}
          spamCount={spamCount}
          onOpenCompose={() => {
            setComposeInitialData(undefined);
            setIsComposeOpen(true);
          }}
          activeView={activeView}
          onChangeView={(v) => {
            setActiveView(v);
            setSelectedEmail(null);
          }}
          user={user}
          mailboxes={mailboxes}
          selectedMailbox={selectedMailbox}
          onSelectMailbox={(mb) => {
            setSelectedMailbox(mb);
            setSelectedEmail(null);
          }}
          selectedLabel={selectedLabel}
          onSelectLabel={(lbl) => {
            setSelectedLabel(lbl);
            setSelectedEmail(null);
          }}
        />

        {/* View Router */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {activeView === 'mail' && (
            selectedEmail ? (
              <EmailDetail
                email={selectedEmail}
                threadEmails={threadEmails}
                onBack={() => {
                  setSelectedEmail(null);
                  loadEmails();
                }}
                onBulkAction={handleBulkAction}
                onReply={handleReply}
                activeMailbox={selectedMailbox}
                user={user}
              />
            ) : (
              <EmailList
                emails={emails}
                selectedEmailId={selectedEmail ? (selectedEmail as Email).id : null}
                onSelectEmail={handleSelectEmail}
                currentFolder={currentFolder}
                selectedLabel={selectedLabel}
                searchQuery={searchQuery}
                onRefresh={loadEmails}
                isRefreshing={isRefreshing}
                onBulkAction={handleBulkAction}
                onOpenCompose={() => {
                  setComposeInitialData(undefined);
                  setIsComposeOpen(true);
                }}
                onOpenSimulator={() => setIsSimulatorOpen(true)}
              />
            )
          )}

          {activeView === 'domains' && (
            <DomainManager
              domains={domains}
              mailboxes={mailboxes}
              onRefreshData={() => {
                loadAllData();
                loadEmails();
              }}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
            />
          )}

          {activeView === 'admin' && (
            <AdminDashboard
              mailboxes={mailboxes}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
            />
          )}

          {activeView === 'contacts' && (
            <ContactsView
              contacts={contacts}
              onRefreshData={loadAllData}
              onComposeTo={handleComposeToContact}
            />
          )}
        </main>
      </div>

      {/* Floating Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          setComposeInitialData(undefined);
        }}
        mailboxes={mailboxes}
        activeMailbox={selectedMailbox}
        contacts={contacts}
        initialData={composeInitialData}
        onEmailSent={(newEmail) => {
          loadEmails();
          loadAllData();
        }}
      />

      {/* Inbound Simulator Sandbox Modal */}
      <InboundSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        mailboxes={mailboxes}
        onEmailReceived={() => {
          loadEmails();
          loadAllData();
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        mailboxes={mailboxes}
        onRefreshData={() => {
          loadAllData();
          loadUser();
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(authedUser) => {
          setUser(authedUser);
          loadAllData();
          loadEmails();
        }}
      />
    </div>
  );
};

export default App;
