// src/api/client.ts
// Unified REST API Client for Webmail Backend

import { User, Domain, Mailbox, Email, OutboxItem, Contact, AuditLog, SystemStats, SmtpServerConfig, MailDeliveryLog } from '../types';

const TOKEN_KEY = 'webmail_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) errorMessage = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  logout() {
    clearStoredToken();
  },

  async getMe(): Promise<{ user: User }> {
    return apiFetch<{ user: User }>('/api/auth/me');
  },

  async switchUser(userId: string): Promise<{ token: string; user: User }> {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setStoredToken(res.token);
    return res;
  },

  // Domains
  async getDomains(): Promise<{ domains: Domain[] }> {
    return apiFetch<{ domains: Domain[] }>('/api/domains');
  },

  async createDomain(domain_name: string, dkim_selector?: string, dmarc_policy?: string): Promise<{ domain: Domain }> {
    return apiFetch<{ domain: Domain }>('/api/domains', {
      method: 'POST',
      body: JSON.stringify({ domain_name, dkim_selector, dmarc_policy }),
    });
  },

  async verifyDomain(id: string): Promise<{ domain: Domain }> {
    return apiFetch<{ domain: Domain }>(`/api/domains/${id}/verify`, { method: 'POST' });
  },

  async simulateVerifyDomain(id: string): Promise<{ domain: Domain }> {
    return apiFetch<{ domain: Domain }>(`/api/domains/${id}/simulate-verify`, { method: 'POST' });
  },

  async updateDomain(id: string, updates: Partial<Domain>): Promise<{ domain: Domain }> {
    return apiFetch<{ domain: Domain }>(`/api/domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteDomain(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/domains/${id}`, { method: 'DELETE' });
  },

  // Mailboxes
  async getMailboxes(): Promise<{ mailboxes: Mailbox[] }> {
    return apiFetch<{ mailboxes: Mailbox[] }>('/api/mailboxes');
  },

  async createMailbox(data: { 
    domain_id: string; 
    username: string; 
    display_name: string; 
    signature_html?: string;
    password?: string;
    role?: 'user' | 'admin';
  }): Promise<{ mailbox: Mailbox; user?: Partial<User> }> {
    return apiFetch<{ mailbox: Mailbox; user?: Partial<User> }>('/api/mailboxes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createAccount(data: {
    domain_id: string;
    username: string;
    display_name: string;
    password: string;
    role?: 'user' | 'admin';
  }): Promise<{ success: boolean; user: User; mailbox: Mailbox }> {
    return apiFetch<{ success: boolean; user: User; mailbox: Mailbox }>('/api/admin/create-account', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateMailbox(id: string, updates: Partial<Mailbox>): Promise<{ mailbox: Mailbox }> {
    return apiFetch<{ mailbox: Mailbox }>(`/api/mailboxes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteMailbox(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/mailboxes/${id}`, { method: 'DELETE' });
  },

  // Emails
  async getEmails(params: { folder?: string; mailbox_id?: string; q?: string; label?: string } = {}): Promise<{ emails: Email[]; count: number }> {
    const query = new URLSearchParams();
    if (params.folder) query.set('folder', params.folder);
    if (params.mailbox_id) query.set('mailbox_id', params.mailbox_id);
    if (params.q) query.set('q', params.q);
    if (params.label) query.set('label', params.label);
    return apiFetch<{ emails: Email[]; count: number }>(`/api/emails?${query.toString()}`);
  },

  async getEmail(id: string): Promise<{ email: Email; thread: Email[] }> {
    return apiFetch<{ email: Email; thread: Email[] }>(`/api/emails/${id}`);
  },

  async getThread(threadId: string): Promise<{ thread: Email[] }> {
    return apiFetch<{ thread: Email[] }>(`/api/threads/${threadId}`);
  },

  async sendEmail(payload: {
    mailbox_id: string;
    to_addresses: { name?: string; address: string }[];
    cc_addresses?: { name?: string; address: string }[];
    bcc_addresses?: { name?: string; address: string }[];
    subject: string;
    body_html?: string;
    body_text?: string;
    attachments?: any[];
    in_reply_to?: string;
    thread_id?: string;
  }): Promise<{ success: boolean; email: Email; outbox?: OutboxItem; warning?: string }> {
    return apiFetch<{ success: boolean; email: Email; outbox?: OutboxItem; warning?: string }>('/api/emails/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async saveDraft(payload: any): Promise<{ draft: Email }> {
    return apiFetch<{ draft: Email }>('/api/emails/draft', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async bulkEmailAction(action: string, ids: string[], value?: any): Promise<{ success: boolean; affectedCount: number }> {
    return apiFetch<{ success: boolean; affectedCount: number }>('/api/emails/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, action, value }),
    });
  },

  // Attachments
  async uploadAttachments(files: File[]): Promise<{ attachments: any[] }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return apiFetch<{ attachments: any[] }>('/api/attachments/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Inbound Simulation
  async simulateInbound(payload: {
    from_address?: string;
    from_name?: string;
    to_address: string;
    subject: string;
    body_text?: string;
    body_html?: string;
    attachments?: any[];
  }): Promise<{ success: boolean; message: string; email?: Email; folder?: string; spam_score?: number }> {
    return apiFetch<{ success: boolean; message: string; email?: Email; folder?: string; spam_score?: number }>('/api/inbound/simulate-external', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async simulateInboundEmail(payload: any) {
    return this.simulateInbound(payload);
  },

  // Contacts
  async getContacts(): Promise<{ contacts: Contact[] }> {
    return apiFetch<{ contacts: Contact[] }>('/api/contacts');
  },

  async createContact(contact: Partial<Contact>): Promise<{ contact: Contact }> {
    return apiFetch<{ contact: Contact }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<{ contact: Contact }> {
    return apiFetch<{ contact: Contact }>(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteContact(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/contacts/${id}`, { method: 'DELETE' });
  },

  // Admin & Outbox
  async getAdminStats(): Promise<{ stats: SystemStats }> {
    return apiFetch<{ stats: SystemStats }>('/api/admin/stats');
  },

  async getOutbox(): Promise<{ outbox: OutboxItem[] }> {
    return apiFetch<{ outbox: OutboxItem[] }>('/api/admin/outbox');
  },

  async retryOutboxItem(id: string): Promise<{ success: boolean; message?: string }> {
    return apiFetch<{ success: boolean; message?: string }>(`/api/admin/outbox/${id}/retry`, { method: 'POST' });
  },

  async flushOutbox(): Promise<{ success: boolean; processed: number; sent: number; failed: number }> {
    return apiFetch<{ success: boolean; processed: number; sent: number; failed: number }>('/api/admin/outbox/flush', { method: 'POST' });
  },

  async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    return apiFetch<{ logs: AuditLog[] }>('/api/admin/audit-logs');
  },

  async getUsers(): Promise<{ users: User[] }> {
    return apiFetch<{ users: User[] }>('/api/admin/users');
  },

  // SMTP Relay & Delivery Diagnostics
  async getSmtpConfig(): Promise<{ config: SmtpServerConfig; ports_status: { port: number; name: string; status: string; description: string }[] }> {
    return apiFetch<{ config: SmtpServerConfig; ports_status: { port: number; name: string; status: string; description: string }[] }>('/api/admin/smtp/config');
  },

  async updateSmtpConfig(config: Partial<SmtpServerConfig>): Promise<{ success: boolean; config: SmtpServerConfig }> {
    return apiFetch<{ success: boolean; config: SmtpServerConfig }>('/api/admin/smtp/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async testSmtpConnection(payload: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    to_email?: string;
    from_email?: string;
  }): Promise<{ success: boolean; logs: string[]; duration_ms: number; error?: string; response?: string }> {
    return apiFetch<{ success: boolean; logs: string[]; duration_ms: number; error?: string; response?: string }>('/api/admin/smtp/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async autoSetupSmtp(payload: { email_address?: string; password: string; provider?: string; host?: string; port?: number; secure?: boolean }): Promise<{ success: boolean; message: string; config: SmtpServerConfig; logs: string[] }> {
    return apiFetch<{ success: boolean; message: string; config: SmtpServerConfig; logs: string[] }>('/api/admin/smtp/auto-setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMailDeliveryLogs(params: { status?: string; direction?: string; q?: string; limit?: number } = {}): Promise<{ logs: MailDeliveryLog[]; count: number }> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.direction) query.set('direction', params.direction);
    if (params.q) query.set('q', params.q);
    if (params.limit) query.set('limit', String(params.limit));
    return apiFetch<{ logs: MailDeliveryLog[]; count: number }>(`/api/admin/mail-logs?${query.toString()}`);
  },

  async clearMailDeliveryLogs(): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/admin/mail-logs', { method: 'DELETE' });
  },

  // AI Helpers
  async getSmartReplies(subject: string, body_text: string): Promise<{ replies: string[] }> {
    return apiFetch<{ replies: string[] }>('/api/ai/smart-replies', {
      method: 'POST',
      body: JSON.stringify({ subject, body_text }),
    });
  },

  async summarizeEmail(subject: string, body_text: string): Promise<{ summary: string }> {
    return apiFetch<{ summary: string }>('/api/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ subject, body_text }),
    });
  },

  async polishDraft(draft_text: string, tone: string = 'professional'): Promise<{ polished: string }> {
    return apiFetch<{ polished: string }>('/api/ai/polish', {
      method: 'POST',
      body: JSON.stringify({ draft_text, tone }),
    });
  },
};
