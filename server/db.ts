// server/db.ts
// Robust Persistent Data Store with Clean Slate Setup, Threading, Quotas & Audit logs

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  Domain,
  Mailbox,
  Email,
  OutboxItem,
  Contact,
  AuditLog,
  MailDeliveryLog,
  SmtpServerConfig,
  SystemStats
} from './types.js';

interface DatabaseSchema {
  users: User[];
  domains: Domain[];
  mailboxes: Mailbox[];
  emails: Email[];
  outbox: OutboxItem[];
  contacts: Contact[];
  audit_logs: AuditLog[];
  mail_delivery_logs?: MailDeliveryLog[];
  smtp_config?: SmtpServerConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'webmail_db.json');

class Database {
  private data: DatabaseSchema = {
    users: [],
    domains: [],
    mailboxes: [],
    emails: [],
    outbox: [],
    contacts: [],
    audit_logs: [],
  };
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Check if database contains old dummy seed data (like acmecorp.dev) and clean it if so
        const hasDummyData = parsed.domains?.some((d: any) => 
          d.domain_name === 'acmecorp.dev' || d.domain_name === 'cloudflow.io'
        ) || parsed.users?.some((u: any) => 
          u.email === 'admin@acmecorp.dev' || u.email === 'sarah.connor@acmecorp.dev'
        );

        if (!hasDummyData && Array.isArray(parsed.users) && parsed.users.length > 0) {
          this.data = parsed;
          this.isLoaded = true;
          return;
        }
      } catch (err) {
        console.error('Failed to parse database file, re-initializing seed data:', err);
      }
    }

    this.seedInitialData();
    this.save();
    this.isLoaded = true;
  }

  private save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  private seedInitialData() {
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);

    const adminUser: User = {
      id: 'admin-root-01',
      email: 'admin@apexmail.internal',
      name: 'System Administrator',
      password_hash: adminPasswordHash,
      role: 'admin',
      avatar_url: '',
      storage_used_bytes: 0,
      storage_quota_bytes: 10737418240, // 10 GB
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const auditLogs: AuditLog[] = [
      {
        id: uuidv4(),
        user_id: adminUser.id,
        action: 'SYSTEM_INITIALIZED',
        details: { message: 'ApexMail system initialized cleanly. Ready for admin to add custom domains and provision user accounts.' },
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString(),
      },
    ];

    // Completely clean state: zero dummy domains, zero dummy emails, zero dummy mailboxes, zero dummy contacts
    this.data = {
      users: [adminUser],
      domains: [],
      mailboxes: [],
      emails: [],
      outbox: [],
      contacts: [],
      audit_logs: auditLogs,
    };
  }

  // User Operations
  getUsers(): User[] {
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates, updated_at: new Date().toISOString() };
    this.save();
    return this.data.users[idx];
  }

  deleteUser(id: string): boolean {
    const prev = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== id);
    this.data.mailboxes = this.data.mailboxes.filter(m => m.user_id !== id);
    this.data.domains = this.data.domains.filter(d => d.user_id !== id);
    this.data.emails = this.data.emails.filter(e => e.user_id !== id);
    this.data.contacts = this.data.contacts.filter(c => c.user_id !== id);
    this.save();
    return this.data.users.length < prev;
  }

  // Domain Operations
  getDomains(userId?: string): Domain[] {
    if (userId) {
      return this.data.domains.filter(d => d.user_id === userId);
    }
    return this.data.domains;
  }

  getDomainById(id: string): Domain | undefined {
    return this.data.domains.find(d => d.id === id);
  }

  getDomainByName(name: string): Domain | undefined {
    return this.data.domains.find(d => d.domain_name.toLowerCase() === name.toLowerCase());
  }

  createDomain(domain: Domain): Domain {
    this.data.domains.push(domain);
    this.save();
    return domain;
  }

  updateDomain(id: string, updates: Partial<Domain>): Domain | undefined {
    const idx = this.data.domains.findIndex(d => d.id === id);
    if (idx === -1) return undefined;
    this.data.domains[idx] = { ...this.data.domains[idx], ...updates };
    this.save();
    return this.data.domains[idx];
  }

  deleteDomain(id: string): boolean {
    const prev = this.data.domains.length;
    this.data.domains = this.data.domains.filter(d => d.id !== id);
    this.data.mailboxes = this.data.mailboxes.filter(m => m.domain_id !== id);
    this.save();
    return this.data.domains.length < prev;
  }

  // Mailbox Operations
  getMailboxes(userId?: string): Mailbox[] {
    if (userId) {
      return this.data.mailboxes.filter(m => m.user_id === userId);
    }
    return this.data.mailboxes;
  }

  getMailboxById(id: string): Mailbox | undefined {
    return this.data.mailboxes.find(m => m.id === id);
  }

  getMailboxByAddress(address: string): Mailbox | undefined {
    return this.data.mailboxes.find(m => m.address.toLowerCase() === address.toLowerCase());
  }

  createMailbox(mailbox: Mailbox): Mailbox {
    this.data.mailboxes.push(mailbox);
    this.save();
    return mailbox;
  }

  updateMailbox(id: string, updates: Partial<Mailbox>): Mailbox | undefined {
    const idx = this.data.mailboxes.findIndex(m => m.id === id);
    if (idx === -1) return undefined;
    this.data.mailboxes[idx] = { ...this.data.mailboxes[idx], ...updates };
    this.save();
    return this.data.mailboxes[idx];
  }

  deleteMailbox(id: string): boolean {
    const prev = this.data.mailboxes.length;
    this.data.mailboxes = this.data.mailboxes.filter(m => m.id !== id);
    this.data.emails = this.data.emails.filter(e => e.mailbox_id !== id);
    this.save();
    return this.data.mailboxes.length < prev;
  }

  // Email Operations
  getEmails(userId: string, folder?: string, mailboxId?: string, query?: string): Email[] {
    return this.data.emails.filter(e => {
      if (e.user_id !== userId) return false;
      if (mailboxId && e.mailbox_id !== mailboxId) return false;
      if (folder && folder !== 'all' && folder !== 'starred' && folder !== 'important') {
        if (e.folder !== folder) return false;
      }
      if (folder === 'starred' && !e.is_starred) return false;
      if (folder === 'important' && !e.labels.includes('Important')) return false;

      if (query && query.trim()) {
        const q = query.toLowerCase().trim();
        const matchFrom = e.from_address.toLowerCase().includes(q) || (e.from_name && e.from_name.toLowerCase().includes(q));
        const matchTo = e.to_addresses.some(t => t.address.toLowerCase().includes(q) || (t.name && t.name.toLowerCase().includes(q)));
        const matchSub = e.subject.toLowerCase().includes(q);
        const matchSnippet = e.snippet.toLowerCase().includes(q);
        const matchBody = e.body_text.toLowerCase().includes(q);
        if (!matchFrom && !matchTo && !matchSub && !matchSnippet && !matchBody) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
  }

  getEmailById(id: string): Email | undefined {
    return this.data.emails.find(e => e.id === id);
  }

  getThreadEmails(threadId: string): Email[] {
    return this.data.emails
      .filter(e => e.thread_id === threadId)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  }

  createEmail(email: Email): Email {
    this.data.emails.push(email);
    // Update user storage
    const user = this.getUserById(email.user_id);
    if (user) {
      user.storage_used_bytes += (email.size_bytes || 5000);
    }
    this.save();
    return email;
  }

  updateEmail(id: string, updates: Partial<Email>): Email | undefined {
    const idx = this.data.emails.findIndex(e => e.id === id);
    if (idx === -1) return undefined;
    this.data.emails[idx] = { ...this.data.emails[idx], ...updates };
    this.save();
    return this.data.emails[idx];
  }

  bulkUpdateEmails(ids: string[], updates: Partial<Email>): number {
    let count = 0;
    for (const id of ids) {
      const idx = this.data.emails.findIndex(e => e.id === id);
      if (idx !== -1) {
        this.data.emails[idx] = { ...this.data.emails[idx], ...updates };
        count++;
      }
    }
    this.save();
    return count;
  }

  deleteEmailPermanent(id: string): boolean {
    const prev = this.data.emails.length;
    this.data.emails = this.data.emails.filter(e => e.id !== id);
    this.save();
    return this.data.emails.length < prev;
  }

  // Outbox Queue Operations
  getOutboxQueue(): OutboxItem[] {
    return this.data.outbox;
  }

  getPendingOutboxItems(): OutboxItem[] {
    const now = new Date().toISOString();
    return this.data.outbox.filter(item => 
      (item.status === 'queued' || (item.status === 'failed' && item.attempts < item.max_attempts)) &&
      item.next_retry_at <= now
    );
  }

  addOutboxItem(item: OutboxItem): OutboxItem {
    this.data.outbox.push(item);
    this.save();
    return item;
  }

  updateOutboxItem(id: string, updates: Partial<OutboxItem>): OutboxItem | undefined {
    const idx = this.data.outbox.findIndex(o => o.id === id);
    if (idx === -1) return undefined;
    this.data.outbox[idx] = { ...this.data.outbox[idx], ...updates };
    this.save();
    return this.data.outbox[idx];
  }

  deleteOutboxItem(id: string): boolean {
    const prev = this.data.outbox.length;
    this.data.outbox = this.data.outbox.filter(o => o.id !== id);
    this.save();
    return this.data.outbox.length < prev;
  }

  // Contact Operations
  getContacts(userId: string): Contact[] {
    return this.data.contacts
      .filter(c => c.user_id === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  createContact(contact: Contact): Contact {
    this.data.contacts.push(contact);
    this.save();
    return contact;
  }

  updateContact(id: string, updates: Partial<Contact>): Contact | undefined {
    const idx = this.data.contacts.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    this.data.contacts[idx] = { ...this.data.contacts[idx], ...updates };
    this.save();
    return this.data.contacts[idx];
  }

  deleteContact(id: string): boolean {
    const prev = this.data.contacts.length;
    this.data.contacts = this.data.contacts.filter(c => c.id !== id);
    this.save();
    return this.data.contacts.length < prev;
  }

  // Audit Logs
  logAction(action: string, details: Record<string, any>, userId?: string, ip?: string): AuditLog {
    const log: AuditLog = {
      id: uuidv4(),
      user_id: userId,
      action,
      details,
      ip_address: ip || '127.0.0.1',
      created_at: new Date().toISOString(),
    };
    this.data.audit_logs.unshift(log);
    // Keep max 500 audit logs
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.save();
    return log;
  }

  getAuditLogs(limit = 100): AuditLog[] {
    return this.data.audit_logs.slice(0, limit);
  }

  // Delivery & Mail Server Logs
  addDeliveryLog(logData: Omit<MailDeliveryLog, 'id' | 'created_at'>): MailDeliveryLog {
    if (!this.data.mail_delivery_logs) {
      this.data.mail_delivery_logs = [];
    }
    const log: MailDeliveryLog = {
      id: uuidv4(),
      ...logData,
      created_at: new Date().toISOString(),
    };
    this.data.mail_delivery_logs.unshift(log);
    if (this.data.mail_delivery_logs.length > 500) {
      this.data.mail_delivery_logs = this.data.mail_delivery_logs.slice(0, 500);
    }
    this.save();
    return log;
  }

  getDeliveryLogs(limit = 100, filter?: { status?: string; direction?: string; search?: string }): MailDeliveryLog[] {
    if (!this.data.mail_delivery_logs) {
      this.data.mail_delivery_logs = [];
    }
    return this.data.mail_delivery_logs
      .filter(l => {
        if (filter?.status && filter.status !== 'all' && l.status !== filter.status) return false;
        if (filter?.direction && filter.direction !== 'all' && l.direction !== filter.direction) return false;
        if (filter?.search && filter.search.trim()) {
          const s = filter.search.toLowerCase().trim();
          const matchMailbox = l.mailbox_address.toLowerCase().includes(s);
          const matchTo = l.to_addresses.some(a => a.toLowerCase().includes(s));
          const matchSub = l.subject.toLowerCase().includes(s);
          const matchHost = l.smtp_host?.toLowerCase().includes(s);
          const matchErr = l.error_reason?.toLowerCase().includes(s);
          if (!matchMailbox && !matchTo && !matchSub && !matchHost && !matchErr) return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  clearDeliveryLogs(): boolean {
    this.data.mail_delivery_logs = [];
    this.save();
    return true;
  }

  // Global SMTP Configuration
  getSmtpConfig(): SmtpServerConfig {
    if (this.data.smtp_config) {
      return this.data.smtp_config;
    }
    // Return env-based or default config
    return {
      host: process.env.SMTP_DEFAULT_HOST || '',
      port: Number(process.env.SMTP_DEFAULT_PORT) || 587,
      secure: process.env.SMTP_DEFAULT_SECURE === 'true',
      user: process.env.SMTP_DEFAULT_USER || '',
      pass: process.env.SMTP_DEFAULT_PASS || '',
      from_name: process.env.SMTP_DEFAULT_FROM_NAME || 'ApexMail Relay',
      is_active: Boolean(process.env.SMTP_DEFAULT_HOST && process.env.SMTP_DEFAULT_USER),
    };
  }

  updateSmtpConfig(config: Partial<SmtpServerConfig>): SmtpServerConfig {
    const current = this.getSmtpConfig();
    this.data.smtp_config = {
      ...current,
      ...config,
    };
    this.save();
    return this.data.smtp_config;
  }

  // System Statistics
  getSystemStats(): SystemStats {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const emailsSentToday = this.data.emails.filter(e => e.folder === 'sent' && e.created_at >= startOfDay).length;
    const emailsReceivedToday = this.data.emails.filter(e => e.folder === 'inbox' && e.received_at >= startOfDay).length;
    const outboxQueued = this.data.outbox.filter(o => o.status === 'queued' || o.status === 'sending').length;
    const outboxFailed = this.data.outbox.filter(o => o.status === 'failed').length;
    const totalStorage = this.data.users.reduce((acc, u) => acc + (u.storage_used_bytes || 0), 0);

    return {
      total_users: this.data.users.length,
      total_domains: this.data.domains.length,
      total_mailboxes: this.data.mailboxes.length,
      total_emails: this.data.emails.length,
      emails_sent_today: emailsSentToday,
      emails_received_today: emailsReceivedToday,
      outbox_queued: outboxQueued,
      outbox_failed: outboxFailed,
      total_storage_bytes: totalStorage,
    };
  }
}

export const db = new Database();
