// server/types.ts
// Data Models and Type Definitions for Custom Domain Webmail

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  created_at: string;
  updated_at: string;
}

export type DnsStatus = 'pending' | 'valid' | 'invalid';

export interface Domain {
  id: string;
  user_id: string;
  domain_name: string;
  is_verified: boolean;
  verification_token: string;
  mx_status: DnsStatus;
  spf_status: DnsStatus;
  dkim_selector: string;
  dkim_public_key: string;
  dkim_private_key: string;
  dkim_status: DnsStatus;
  dmarc_status: DnsStatus;
  dmarc_policy: 'none' | 'quarantine' | 'reject';
  custom_smtp_host?: string;
  custom_smtp_port?: number;
  custom_smtp_user?: string;
  custom_smtp_pass?: string;
  custom_smtp_secure?: boolean;
  last_verified_at?: string;
  created_at: string;
  // Computed diagnostics
  dns_diagnostics?: {
    mx_records_found?: string[];
    spf_record_found?: string;
    dkim_record_found?: string;
    dmarc_record_found?: string;
    notes?: string[];
  };
}

export interface Mailbox {
  id: string;
  user_id: string;
  domain_id: string;
  address: string; // e.g. "alex@mycompany.com"
  display_name: string;
  signature_html: string;
  is_default: boolean;
  is_active: boolean;
  forwarding_address?: string;
  auto_reply_enabled?: boolean;
  auto_reply_subject?: string;
  auto_reply_body?: string;
  created_at: string;
}

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive';

export interface EmailAddressParticipant {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
  path?: string;
}

export interface Email {
  id: string;
  mailbox_id: string;
  user_id: string;
  thread_id: string;
  folder: EmailFolder;
  from_address: string;
  from_name?: string;
  to_addresses: EmailAddressParticipant[];
  cc_addresses: EmailAddressParticipant[];
  bcc_addresses: EmailAddressParticipant[];
  reply_to?: string;
  subject: string;
  body_text: string;
  body_html: string;
  snippet: string;
  is_read: boolean;
  is_starred: boolean;
  is_pinned: boolean;
  labels: string[];
  attachments: EmailAttachment[];
  message_id: string;
  in_reply_to?: string;
  references_header?: string;
  headers?: Record<string, string>;
  spam_score: number;
  spam_reasons: string[];
  dkim_verified: boolean;
  spf_verified: boolean;
  size_bytes: number;
  received_at: string;
  created_at: string;
}

export type OutboxStatus = 'queued' | 'sending' | 'sent' | 'failed';

export interface OutboxItem {
  id: string;
  user_id: string;
  mailbox_id: string;
  email_id: string;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  last_error?: string;
  next_retry_at: string;
  sent_at?: string;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  avatar_url?: string;
  is_favorite: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  details: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface SystemStats {
  total_users: number;
  total_domains: number;
  total_mailboxes: number;
  total_emails: number;
  emails_sent_today: number;
  emails_received_today: number;
  outbox_queued: number;
  outbox_failed: number;
  total_storage_bytes: number;
}
