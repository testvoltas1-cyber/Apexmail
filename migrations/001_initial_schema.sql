-- 001_initial_schema.sql
-- Production PostgreSQL Database Migration for Custom Domain Email Service

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    avatar_url TEXT,
    storage_used_bytes BIGINT DEFAULT 0,
    storage_quota_bytes BIGINT DEFAULT 10737418240, -- 10 GB default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domains Table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    domain_name VARCHAR(255) UNIQUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) NOT NULL,
    mx_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'valid', 'invalid'
    spf_status VARCHAR(50) DEFAULT 'pending',
    dkim_selector VARCHAR(50) DEFAULT 'mail',
    dkim_public_key TEXT,
    dkim_private_key TEXT,
    dkim_status VARCHAR(50) DEFAULT 'pending',
    dmarc_status VARCHAR(50) DEFAULT 'pending',
    dmarc_policy VARCHAR(50) DEFAULT 'none',
    custom_smtp_host VARCHAR(255),
    custom_smtp_port INT DEFAULT 587,
    custom_smtp_user VARCHAR(255),
    custom_smtp_pass VARCHAR(255),
    custom_smtp_secure BOOLEAN DEFAULT FALSE,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mailboxes Table
CREATE TABLE IF NOT EXISTS mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    address VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    signature_html TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    forwarding_address VARCHAR(255),
    auto_reply_enabled BOOLEAN DEFAULT FALSE,
    auto_reply_subject VARCHAR(255),
    auto_reply_body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emails Table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL,
    folder VARCHAR(50) DEFAULT 'inbox', -- 'inbox', 'sent', 'drafts', 'spam', 'trash', 'archive'
    from_address VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    cc_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    bcc_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    reply_to VARCHAR(255),
    subject TEXT DEFAULT '',
    body_text TEXT DEFAULT '',
    body_html TEXT DEFAULT '',
    snippet TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    message_id VARCHAR(500),
    in_reply_to VARCHAR(500),
    references_header TEXT,
    headers JSONB DEFAULT '{}'::jsonb,
    spam_score NUMERIC(4, 2) DEFAULT 0.0,
    spam_reasons JSONB DEFAULT '[]'::jsonb,
    dkim_verified BOOLEAN DEFAULT FALSE,
    spf_verified BOOLEAN DEFAULT FALSE,
    size_bytes BIGINT DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Outbox Queue Table (For retry & reliable SMTP delivery)
CREATE TABLE IF NOT EXISTS outbox_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'sending', 'sent', 'failed'
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    last_error TEXT,
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    company VARCHAR(255),
    notes TEXT,
    avatar_url TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit / Mail Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_emails_user_folder ON emails(user_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_is_starred ON emails(user_id, is_starred);
CREATE INDEX IF NOT EXISTS idx_mailboxes_user ON mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_user ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status_retry ON outbox_queue(status, next_retry_at);
