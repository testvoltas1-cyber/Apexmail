# 🚀 Complete Deployment Guide: Custom Domain Webmail (Render & VPS)

This guide covers deploying your **Gmail-like Custom Domain Email Platform** to **Render** and easily transitioning/scaling to a **Dedicated VPS** (DigitalOcean, Hetzner, AWS EC2, Linode) for high-volume raw SMTP/IMAP protocol hosting.

---

## 📑 Architecture Overview

The system consists of 4 modular layers:
1. **Webmail Frontend & REST API** (React + Express)
2. **Database Engine** (PostgreSQL with indexes, relations, and retry queues)
3. **Domain Verification & DKIM Signer** (DNS query engine for MX, SPF, DKIM TXT, DMARC + RSA 2048-bit DKIM Key Generator)
4. **Mail Protocol Bridge** (SMTP Sender with Retry Queue + Inbound Webhook / Raw RFC822 EML Parser)

---

## 🌐 Option 1: Deploy on Render (Recommended for Fast Launch)

Render offers managed Node.js web services and managed PostgreSQL databases.

### Step 1: Deploy via Blueprint (`render.yaml`)
1. Push this repository to **GitHub** or **GitLab**.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect your repository. Render will automatically detect `render.yaml` and provision:
   - **`custom-domain-webmail`** (Web Service running Node.js)
   - **`webmail-postgres`** (PostgreSQL Database)
5. Set the required Environment Variables in Render:
   - `APP_URL`: `https://your-service-name.onrender.com`
   - `JWT_SECRET`: Random 64-char string (Render auto-generates this)
   - `GEMINI_API_KEY`: (Optional, for AI Smart Replies & Summaries)

### Step 2: Render Outbound Mail Delivery Note
Cloud PaaS providers like Render, Heroku, and AWS Lambda **block outgoing Port 25** by default to prevent spam.
- In the **Domain Settings** tab in the Webmail Admin, you can easily configure a custom SMTP relay (e.g. Amazon SES, SendGrid, Mailgun, Postmark, or your own VPS SMTP on port 587 / 465).
- Or you can connect your own domain SMTP credentials directly.

---

## 🖥️ Option 2: Deploy on a Dedicated VPS / Docker (Zero Limits)

For full direct Port 25 SMTP sending and native IMAP daemon:

### 1. Requirements
- Ubuntu 22.04 / 24.04 LTS VPS with Port 25 unblocked (e.g., OVH, Hetzner, Linode upon request).
- Docker and Docker Compose installed.

### 2. Quickstart with Docker Compose
```bash
git clone <your-repo-url> webmail
cd webmail

# Copy and edit configuration
cp .env.example .env
nano .env

# Launch Postgres + Webmail
docker compose up -d --build

# View logs
docker compose logs -f webmail
```

---

## 🏷️ Custom Domain DNS Setup & Verification

When you add a domain (e.g. `example.com`), the Webmail system automatically generates exact DNS records:

| Record Type | Host / Name | Value / Destination | Purpose |
| :--- | :--- | :--- | :--- |
| **MX** | `@` (or `example.com`) | `mail.example.com` (Priority 10) | Directs inbound mail to your server |
| **A** | `mail` | `<YOUR_SERVER_IP>` | Resolves mail server hostname |
| **TXT (SPF)** | `@` | `v=spf1 mx ~all` | Authorizes your mail server IP to send mail |
| **TXT (DKIM)** | `mail._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBg...` | Cryptographic public key for DKIM signature verification |
| **TXT (DMARC)**| `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com` | Enforces SPF/DKIM alignment and reporting |

### Live Verification Engine
Inside the Webmail app:
1. Go to **Domains** tab in the sidebar.
2. Click **Add Custom Domain** (e.g. `example.com`).
3. View the generated records and paste them into your DNS provider (Cloudflare, GoDaddy, Namecheap, Route53).
4. Click **"Verify DNS Records"**. The server will perform live DNS lookups against global nameservers and mark each record as **Valid** ✅ or **Pending** ⏳.
5. Once verified, you can immediately create addresses like `alex@example.com` and start sending/receiving!

---

## 📥 Inbound Email Processing

The backend provides built-in endpoints for receiving incoming emails:

1. **RFC822 EML Endpoint**: `POST /api/inbound/raw-eml` (Receives raw MIME email stream, parses attachments, HTML/plain text, verifies SPF/DKIM, calculates spam score, and files into the recipient's Inbox).
2. **Webhook Endpoint**: `POST /api/inbound/webhook` (Standard JSON payload compatible with Postfix pipe, SendGrid Inbound Parse, Mailgun webhook, or Cloudflare Email Routing).
3. **Interactive Simulator**: The Webmail UI includes an **Inbound Mail Simulator** in the Domain/Admin panel so you can test receiving external emails with attachments anytime in 1 click!

---

## 🔒 Security Best Practices Implemented
- **Bcrypt Password Hashing** (12 salt rounds)
- **JWT Token Authentication** with expiry
- **DKIM Signing** (RSA-SHA256 2048-bit with canonicalization)
- **Attachment Sanitation & Type Whitelisting**
- **Spam Scoring Engine** (checks SPF, DKIM, spam trigger keywords, excessive links, uppercase subjects)
- **Outbox Retry Queue** with exponential backoff and persistent delivery logs
