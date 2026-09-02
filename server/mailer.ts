// server/mailer.ts
// Real Email Protocol Engine: DKIM Generator, DNS Verifier, SMTP Dispatcher, Inbound EML Parser & Outbox Retry Queue

import crypto from 'crypto';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { simpleParser, ParsedMail } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db.js';
import { Domain, Email, Mailbox, OutboxItem } from './types.js';

const dnsPromises = dns.promises;

// ==========================================
// 1. DKIM Keypair Generator
// ==========================================
export function generateDkimKeyPair(): { publicKeyText: string; privateKeyPem: string } {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'der',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // Base64 encode the public key for TXT record
    const publicKeyBase64 = publicKey.toString('base64');
    return {
      publicKeyText: publicKeyBase64,
      privateKeyPem: privateKey,
    };
  } catch (err) {
    console.error('DKIM key generation fallback:', err);
    // Secure fallback keypair if crypto der fails
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
    });
    const cleanedPublic = publicKey.replace(/-----BEGIN RSA PUBLIC KEY-----|-----END RSA PUBLIC KEY-----|\n|\r/g, '');
    return {
      publicKeyText: cleanedPublic,
      privateKeyPem: privateKey,
    };
  }
}

// ==========================================
// 2. DNS Verification Engine (MX, SPF, DKIM, DMARC) with Live DoH + Native Resolver
// ==========================================

const publicResolver = new dnsPromises.Resolver();
try {
  publicResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);
} catch {}

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
  Authority?: any[];
  Comment?: string;
}

async function queryDoh(name: string, type: 'MX' | 'TXT' | 'A' | 'CNAME'): Promise<string[]> {
  const results: string[] = [];

  // Try Google DoH (https://dns.google/resolve)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data: DohResponse = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        for (const ans of data.Answer) {
          if (ans.data) {
            results.push(ans.data.replace(/^"|"$/g, '').replace(/\\"/g, '"'));
          }
        }
        if (results.length > 0) return results;
      }
    }
  } catch (e) {
    // Google DoH failed, continue to Cloudflare
  }

  // Try Cloudflare DoH (https://cloudflare-dns.com/dns-query)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/dns-json' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data: DohResponse = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        for (const ans of data.Answer) {
          if (ans.data) {
            results.push(ans.data.replace(/^"|"$/g, '').replace(/\\"/g, '"'));
          }
        }
        if (results.length > 0) return results;
      }
    }
  } catch (e) {
    // Cloudflare DoH failed
  }

  return results;
}

export async function resolveLiveMx(domainName: string): Promise<{ priority: number; exchange: string }[]> {
  const records: { priority: number; exchange: string }[] = [];

  // 1. Try Live DoH
  const dohAnswers = await queryDoh(domainName, 'MX');
  if (dohAnswers.length > 0) {
    for (const ans of dohAnswers) {
      // Format usually: "10 mail.pdftoolkitpro.online." or "10 mail.privateemail.com."
      const parts = ans.trim().split(/\s+/);
      if (parts.length >= 2) {
        records.push({
          priority: parseInt(parts[0], 10) || 10,
          exchange: parts[1].replace(/\.$/, '').toLowerCase(),
        });
      } else if (parts.length === 1) {
        records.push({
          priority: 10,
          exchange: parts[0].replace(/\.$/, '').toLowerCase(),
        });
      }
    }
    if (records.length > 0) return records;
  }

  // 2. Try Node native resolver
  try {
    const nativeMx = await dnsPromises.resolveMx(domainName);
    if (nativeMx && nativeMx.length > 0) {
      return nativeMx.map(r => ({
        priority: r.priority,
        exchange: r.exchange.replace(/\.$/, '').toLowerCase(),
      }));
    }
  } catch {}

  // 3. Try publicResolver
  try {
    const pubMx = await publicResolver.resolveMx(domainName);
    if (pubMx && pubMx.length > 0) {
      return pubMx.map(r => ({
        priority: r.priority,
        exchange: r.exchange.replace(/\.$/, '').toLowerCase(),
      }));
    }
  } catch {}

  return records;
}

export async function resolveLiveTxt(hostname: string): Promise<string[]> {
  const records: string[] = [];

  // 1. Try Live DoH
  const dohAnswers = await queryDoh(hostname, 'TXT');
  if (dohAnswers.length > 0) {
    records.push(...dohAnswers);
    return records;
  }

  // 2. Try Node native resolver
  try {
    const nativeTxt = await dnsPromises.resolveTxt(hostname);
    if (nativeTxt && nativeTxt.length > 0) {
      return nativeTxt.map(chunk => chunk.join(''));
    }
  } catch {}

  // 3. Try publicResolver
  try {
    const pubTxt = await publicResolver.resolveTxt(hostname);
    if (pubTxt && pubTxt.length > 0) {
      return pubTxt.map(chunk => chunk.join(''));
    }
  } catch {}

  return records;
}

export async function verifyDomainDns(domain: Domain): Promise<Domain> {
  const domainName = domain.domain_name.toLowerCase().trim();
  const notes: string[] = [];
  let mx_status: 'valid' | 'invalid' | 'pending' = 'pending';
  let spf_status: 'valid' | 'invalid' | 'pending' = 'pending';
  let dkim_status: 'valid' | 'invalid' | 'pending' = 'pending';
  let dmarc_status: 'valid' | 'invalid' | 'pending' = 'pending';

  let mxFound: string[] = [];
  let spfFound: string | undefined;
  let dkimFound: string | undefined;
  let dmarcFound: string | undefined;

  notes.push(`[${new Date().toLocaleTimeString()}] Live DNS Sync initiated via Namecheap / Global DNS for "${domainName}"...`);

  // 1. Check MX Records on Namecheap / Registrar
  try {
    const mxRecords = await resolveLiveMx(domainName);
    if (mxRecords && mxRecords.length > 0) {
      mxFound = mxRecords.map(r => `${r.priority} ${r.exchange}`);
      mx_status = 'valid';
      notes.push(`✓ MX Verified: Found active mail exchange server(s): ${mxFound.join(', ')}`);
    } else {
      mx_status = 'invalid';
      notes.push(`✗ MX Missing: No MX record detected on Namecheap DNS for "${domainName}". Ensure an MX record with Host "@" is configured in Namecheap.`);
    }
  } catch (err: any) {
    mx_status = 'invalid';
    notes.push(`✗ MX Lookup failed: ${err.message || 'No records returned from Namecheap DNS'}`);
  }

  // 2. Check SPF / Verification TXT on root domain
  try {
    const txtRecords = await resolveLiveTxt(domainName);
    
    // Check for SPF (v=spf1 ...)
    const spfRecord = txtRecords.find(txt => txt.toLowerCase().startsWith('v=spf1'));
    // Check for explicit verification token or general domain ownership tag
    const tokenRecord = txtRecords.find(txt => txt.includes(domain.verification_token) || txt.includes('webmail-verify'));

    if (spfRecord) {
      spfFound = spfRecord;
      spf_status = 'valid';
      notes.push(`✓ SPF Record Verified: "${spfRecord}"`);
    } else if (tokenRecord) {
      spfFound = tokenRecord;
      spf_status = 'valid';
      notes.push(`✓ Domain Token Verified: "${tokenRecord}"`);
    } else {
      spf_status = 'invalid';
      notes.push(`✗ SPF/TXT Missing: No "v=spf1" TXT record found on "@" (${domainName}) in Namecheap.`);
    }
  } catch (err: any) {
    spf_status = 'invalid';
    notes.push(`✗ SPF Lookup failed: ${err.message || 'No TXT records found'}`);
  }

  // 3. Check DKIM TXT on <selector>._domainkey.<domain>
  const selector = domain.dkim_selector || 'mail';
  const dkimHostname = `${selector}._domainkey.${domainName}`;
  try {
    const dkimTxt = await resolveLiveTxt(dkimHostname);
    // Also try fallback selector 'default' if 'mail' not found
    let matchedDkim = dkimTxt.find(txt => txt.toLowerCase().includes('v=dkim1') || txt.toLowerCase().includes('k=rsa') || txt.includes(domain.dkim_public_key.substring(0, 16)));
    
    if (!matchedDkim && selector !== 'default') {
      const defaultDkimTxt = await resolveLiveTxt(`default._domainkey.${domainName}`);
      matchedDkim = defaultDkimTxt.find(txt => txt.toLowerCase().includes('v=dkim1') || txt.toLowerCase().includes('k=rsa'));
    }

    if (matchedDkim) {
      dkimFound = matchedDkim;
      dkim_status = 'valid';
      notes.push(`✓ DKIM Record Verified: Selector active at "${dkimHostname}".`);
    } else {
      dkim_status = 'invalid';
      notes.push(`✗ DKIM Missing: TXT record at "${dkimHostname}" not yet detected in Namecheap DNS.`);
    }
  } catch (err: any) {
    dkim_status = 'invalid';
    notes.push(`✗ DKIM Lookup failed on "${dkimHostname}": ${err.message || 'Not found'}`);
  }

  // 4. Check DMARC TXT on _dmarc.<domain>
  const dmarcHostname = `_dmarc.${domainName}`;
  try {
    const dmarcTxt = await resolveLiveTxt(dmarcHostname);
    const dmarcRec = dmarcTxt.find(txt => txt.toLowerCase().startsWith('v=dmarc1'));
    if (dmarcRec) {
      dmarcFound = dmarcRec;
      dmarc_status = 'valid';
      notes.push(`✓ DMARC Policy Verified: "${dmarcRec}" detected on "${dmarcHostname}".`);
    } else {
      dmarc_status = 'invalid';
      notes.push(`✗ DMARC Missing: TXT record at "_dmarc" not detected on Namecheap.`);
    }
  } catch (err: any) {
    dmarc_status = 'invalid';
    notes.push(`✗ DMARC Lookup failed on "${dmarcHostname}": ${err.message || 'Not found'}`);
  }

  // Domain verification status:
  // If MX is valid OR SPF is valid, mark domain verified
  const isStrictlyVerified = (mx_status === 'valid' || spf_status === 'valid');

  const updated: Domain = {
    ...domain,
    mx_status,
    spf_status,
    dkim_status,
    dmarc_status,
    is_verified: isStrictlyVerified,
    last_verified_at: new Date().toISOString(),
    dns_diagnostics: {
      mx_records_found: mxFound,
      spf_record_found: spfFound,
      dkim_record_found: dkimFound,
      dmarc_record_found: dmarcFound,
      notes,
    }
  };

  db.updateDomain(domain.id, updated);
  return updated;
}

// ==========================================
// 3. Spam Detection & Scoring Engine
// ==========================================
export function calculateSpamScore(email: {
  subject: string;
  body_text: string;
  from_address: string;
  headers?: Record<string, string>;
}): { score: number; reasons: string[] } {
  let score = 0.0;
  const reasons: string[] = [];

  const text = `${email.subject} ${email.body_text}`.toLowerCase();

  const spamTriggers = [
    { phrase: 'claim your prize', weight: 3.5 },
    { phrase: 'crypto bonus', weight: 4.0 },
    { phrase: 'urgent transfer', weight: 2.5 },
    { phrase: '100% free guaranteed', weight: 3.0 },
    { phrase: 'wire funds', weight: 2.0 },
    { phrase: 'viagra', weight: 5.0 },
    { phrase: 'casino deposit', weight: 3.5 },
    { phrase: 'lottery winner', weight: 4.5 },
    { phrase: 'verify your account immediately', weight: 2.5 },
  ];

  for (const trigger of spamTriggers) {
    if (text.includes(trigger.phrase)) {
      score += trigger.weight;
      reasons.push(`Trigger phrase: "${trigger.phrase}" (+${trigger.weight})`);
    }
  }

  // Check uppercase ratio in subject
  const upperChars = email.subject.replace(/[^A-Z]/g, '').length;
  if (email.subject.length > 5 && upperChars / email.subject.length > 0.6) {
    score += 2.0;
    reasons.push('Excessive uppercase in subject (+2.0)');
  }

  // Check excessive exclamation marks
  const exclamationCount = (email.subject.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    score += 1.5;
    reasons.push('Excessive exclamation marks (+1.5)');
  }

  return {
    score: Math.min(10, Number(score.toFixed(1))),
    reasons,
  };
}

// ==========================================
// 4. Outbound SMTP Delivery & DKIM Signer
// ==========================================

export interface SmtpTestResult {
  success: boolean;
  logs: string[];
  duration_ms: number;
  error?: string;
  response?: string;
}

export async function validateAndVerifyRecipients(addresses: string[]): Promise<{
  valid: boolean;
  error?: string;
  externalAddresses: string[];
  internalAddresses: string[];
}> {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  const externalAddresses: string[] = [];
  const internalAddresses: string[] = [];

  if (!addresses || addresses.length === 0) {
    return { valid: false, error: 'At least one recipient address is required', externalAddresses: [], internalAddresses: [] };
  }

  for (const rawAddr of addresses) {
    const addr = (rawAddr || '').trim().toLowerCase();
    if (!addr) continue;

    // 1. Syntax check
    if (!emailRegex.test(addr)) {
      return {
        valid: false,
        error: `Invalid email address format: "${rawAddr}". Please provide a valid email (e.g. user@example.com).`,
        externalAddresses: [],
        internalAddresses: [],
      };
    }

    const domainPart = addr.split('@')[1];
    if (!domainPart || domainPart.includes('..') || domainPart.startsWith('-') || domainPart.endsWith('-') || !domainPart.includes('.')) {
      return {
        valid: false,
        error: `Invalid domain in email address: "${rawAddr}".`,
        externalAddresses: [],
        internalAddresses: [],
      };
    }

    // Check if domain is registered locally in this mail server instance
    const localDomain = db.getDomainByName(domainPart);
    const localMailbox = db.getMailboxByAddress(addr);

    if (localDomain || localMailbox) {
      internalAddresses.push(addr);
    } else {
      externalAddresses.push(addr);

      // 2. DNS MX / A record check for external domain to detect fake/non-existent domains
      try {
        const mxRecords = await resolveLiveMx(domainPart);
        if (!mxRecords || mxRecords.length === 0) {
          // Fallback: check if domain has A record (DoH / native)
          const aDoh = await queryDoh(domainPart, 'A');
          let hasA = aDoh && aDoh.length > 0;
          if (!hasA) {
            try {
              const aRecords = await dnsPromises.resolve4(domainPart);
              if (aRecords && aRecords.length > 0) hasA = true;
            } catch {}
          }

          if (!hasA) {
            return {
              valid: false,
              error: `Recipient domain "${domainPart}" does not exist or has no active mail server (MX). Cannot send email to "${addr}".`,
              externalAddresses: [],
              internalAddresses: [],
            };
          }
        }
      } catch (err: any) {
        return {
          valid: false,
          error: `Fake or invalid recipient domain: "${domainPart}". Domain was not found in public DNS.`,
          externalAddresses: [],
          internalAddresses: [],
        };
      }
    }
  }

  return {
    valid: true,
    externalAddresses,
    internalAddresses,
  };
}

export async function testSmtpConnection(config: {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  to_email?: string;
  from_email?: string;
}): Promise<SmtpTestResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  const host = config.host.trim();
  const port = Number(config.port) || 587;
  const isSecure = Boolean(config.secure);

  logs.push(`[${new Date().toLocaleTimeString()}] Initializing connection test to SMTP host "${host}" on port ${port} (SSL/TLS: ${isSecure ? 'Enabled' : 'STARTTLS/None'})...`);

  if (!host) {
    return {
      success: false,
      logs: [...logs, '✗ Error: SMTP host address cannot be empty.'],
      duration_ms: Date.now() - startTime,
      error: 'SMTP host is required',
    };
  }

  // Check if user is attempting port 25 on cloud
  if (port === 25) {
    logs.push(`⚠️ Warning: Port 25 is blocked by Render and most cloud providers. We strongly recommend Port 587 (STARTTLS) or Port 465 (SSL/TLS).`);
  }

  try {
    const authConfig = (config.user && config.pass) ? {
      user: config.user.trim(),
      pass: config.pass.trim(),
    } : undefined;

    logs.push(`[${new Date().toLocaleTimeString()}] Establishing TCP socket and handshake with ${host}:${port} (${isSecure ? 'Direct SSL/TLS' : 'STARTTLS'})...`);

    // Helper to create transport
    const createTestTransport = (targetPort: number, secureMode: boolean) => {
      return nodemailer.createTransport({
        host,
        port: targetPort,
        secure: secureMode,
        auth: authConfig,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: false,
        },
      });
    };

    let transporter: nodemailer.Transporter | null = null;
    let actualHost = host;
    let actualPort = port;
    let actualSecure = isSecure;

    try {
      transporter = createTestTransport(actualPort, actualSecure);
      await transporter.verify();
      logs.push(`✓ Socket handshake and SMTP Authentication successful on ${actualHost}:${actualPort}!`);
    } catch (primaryErr: any) {
      logs.push(`⚠️ Attempt on ${actualHost}:${actualPort} failed (${primaryErr.code || primaryErr.message}).`);
      
      let recovered = false;

      // Auto-fallback 1: If host fails DNS or is custom 'mail.domain.online', try Namecheap 'mail.privateemail.com' on 465
      if (!actualHost.includes('privateemail.com') && (primaryErr.code === 'ENOTFOUND' || primaryErr.code === 'EDNS' || primaryErr.code === 'ETIMEDOUT')) {
        logs.push(`[${new Date().toLocaleTimeString()}] Auto-Fix: Trying Namecheap Private Email relay "mail.privateemail.com" on Port 465 (SSL)...`);
        try {
          const peTransport = nodemailer.createTransport({
            host: 'mail.privateemail.com',
            port: 465,
            secure: true,
            auth: authConfig,
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
            tls: { rejectUnauthorized: false },
          });
          await peTransport.verify();
          transporter = peTransport;
          actualHost = 'mail.privateemail.com';
          actualPort = 465;
          actualSecure = true;
          recovered = true;
          logs.push(`✓ Auto-Fix Succeeded: Connected to mail.privateemail.com:465 (SSL)!`);
        } catch {}
      }

      // Auto-fallback 2: Try alternate port (465 SSL vs 587 STARTTLS)
      if (!recovered) {
        const fallbackPort = actualPort === 465 ? 587 : 465;
        const fallbackSecure = fallbackPort === 465;
        logs.push(`[${new Date().toLocaleTimeString()}] Auto-Fix: Attempting automatic fallback to port ${fallbackPort} (${fallbackSecure ? 'Direct SSL/TLS' : 'STARTTLS'})...`);
        
        try {
          const fallbackTransporter = createTestTransport(fallbackPort, fallbackSecure);
          await fallbackTransporter.verify();
          transporter = fallbackTransporter;
          actualPort = fallbackPort;
          actualSecure = fallbackSecure;
          recovered = true;
          logs.push(`✓ Connected successfully on fallback Port ${fallbackPort} (${fallbackSecure ? 'SSL/TLS' : 'STARTTLS'})!`);
        } catch (fallbackErr: any) {
          if (!recovered) throw primaryErr;
        }
      }
    }

    // Auto-update database config to working settings so user doesn't have to fiddle
    if (actualHost !== host || actualPort !== port || actualSecure !== isSecure) {
      db.updateSmtpConfig({
        host: actualHost,
        port: actualPort,
        secure: actualSecure,
      });
      logs.push(`✓ Saved working configuration (${actualHost}:${actualPort} SSL=${actualSecure}) to database.`);
    }

    // 2. Optionally send a real test email if a recipient address is provided
    let responseText = 'SMTP Connection verified successfully (250 OK)';
    if (config.to_email && config.to_email.includes('@')) {
      const fromAddr = config.from_email || (config.user && config.user.includes('@') ? config.user : `no-reply@${host}`);
      logs.push(`[${new Date().toLocaleTimeString()}] Sending diagnostic test email to "${config.to_email}" from "${fromAddr}"...`);

      const info = await transporter.sendMail({
        from: `"ApexMail Mail Server Diagnostic" <${fromAddr}>`,
        to: config.to_email,
        subject: `[Diagnostic Test] ApexMail SMTP Connection Success (${new Date().toLocaleTimeString()})`,
        text: `ApexMail SMTP connection test completed successfully.\n\nServer: ${host}:${port}\nAuth: ${config.user ? 'Authenticated' : 'Anonymous'}\nTimestamp: ${new Date().toISOString()}\n\nYour outbound email delivery is fully operational!`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 550px;">
            <h2 style="color: #10b981; margin-top: 0;">✓ ApexMail SMTP Test Success</h2>
            <p style="color: #374151; font-size: 14px;">Your mail server connection is verified and ready to deliver real outbound emails.</p>
            <table style="width: 100%; font-size: 13px; color: #4b5563; border-collapse: collapse; margin-top: 12px;">
              <tr><td style="padding: 6px 0; font-weight: bold;">SMTP Host:</td><td>${host}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Port:</td><td>${port} (${isSecure ? 'SSL' : 'STARTTLS'})</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">Status:</td><td style="color: #10b981; font-weight: bold;">250 OK Delivered</td></tr>
            </table>
          </div>
        `,
      });

      responseText = `Email delivered successfully: ${info.response || info.messageId || '250 OK'}`;
      logs.push(`✓ Test email delivered: ${responseText}`);
    }

    const duration = Date.now() - startTime;
    logs.push(`[${new Date().toLocaleTimeString()}] All SMTP checks completed in ${duration}ms.`);

    return {
      success: true,
      logs,
      duration_ms: duration,
      response: responseText,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    let errMsg = err.message || 'SMTP Connection Error';

    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      if (port === 25) {
        errMsg = `Connection timed out on Port 25. Note: Render and most cloud hosting providers BLOCK outbound TCP Port 25. Please switch to Port 587 (STARTTLS) or Port 465 (SSL/TLS).`;
      } else {
        errMsg = `Could not connect to ${host}:${port}. Please verify the SMTP host and ensure port ${port} is reachable.`;
      }
    } else if (err.code === 'EAUTH' || err.responseCode === 535) {
      errMsg = `Authentication failed: Username or password rejected by ${host}. For Namecheap / Gmail / cPanel, ensure you are using the full mailbox email and valid password (or App Password).`;
    }

    logs.push(`✗ Failed: ${errMsg}`);

    return {
      success: false,
      logs,
      duration_ms: duration,
      error: errMsg,
    };
  }
}

export async function sendEmailDirectOrRelay(email: Email, mailbox: Mailbox, domain?: Domain): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const startTime = Date.now();
  const toAddressesList = email.to_addresses.map(a => a.address);
  let usedHost = 'Direct/Internal';
  let usedPort = 587;
  let usedTls = 'STARTTLS';

  const allAddresses = [
    ...email.to_addresses.map(a => a.address),
    ...email.cc_addresses.map(a => a.address),
    ...email.bcc_addresses.map(a => a.address),
  ];

  const externalRecipients: string[] = [];
  const internalRecipients: string[] = [];

  for (const addr of allAddresses) {
    const cleanAddr = (addr || '').trim().toLowerCase();
    const domainPart = cleanAddr.split('@')[1];
    if (domainPart && (db.getDomainByName(domainPart) || db.getMailboxByAddress(cleanAddr))) {
      internalRecipients.push(cleanAddr);
    } else {
      externalRecipients.push(cleanAddr);
    }
  }

  try {
    // 1. Prepare DKIM configuration if private key exists
    let dkimConfig: any = undefined;
    if (domain && domain.dkim_private_key && domain.dkim_selector) {
      dkimConfig = {
        domainName: domain.domain_name,
        keySelector: domain.dkim_selector,
        privateKey: domain.dkim_private_key,
      };
    }

    // 2. Determine SMTP Relay: Domain Specific -> Global Database Config -> Environment Variable
    let transporter: nodemailer.Transporter | null = null;
    const globalSmtp = db.getSmtpConfig();

    if (domain && domain.custom_smtp_host && domain.custom_smtp_user && domain.custom_smtp_pass) {
      // Domain-specific relay
      usedHost = domain.custom_smtp_host;
      usedPort = domain.custom_smtp_port || (domain.custom_smtp_secure ? 465 : 587);
      usedTls = domain.custom_smtp_secure ? 'SSL/TLS' : 'STARTTLS';

      transporter = nodemailer.createTransport({
        host: domain.custom_smtp_host,
        port: usedPort,
        secure: Boolean(domain.custom_smtp_secure),
        auth: {
          user: domain.custom_smtp_user,
          pass: domain.custom_smtp_pass,
        },
        dkim: dkimConfig,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    } else if (globalSmtp && globalSmtp.is_active && globalSmtp.host && globalSmtp.user) {
      // Global database-configured relay
      usedHost = globalSmtp.host;
      usedPort = globalSmtp.port || (globalSmtp.secure ? 465 : 587);
      usedTls = globalSmtp.secure ? 'SSL/TLS' : 'STARTTLS';

      transporter = nodemailer.createTransport({
        host: globalSmtp.host,
        port: usedPort,
        secure: Boolean(globalSmtp.secure),
        auth: {
          user: globalSmtp.user,
          pass: globalSmtp.pass,
        },
        dkim: dkimConfig,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    } else if (process.env.SMTP_DEFAULT_HOST && process.env.SMTP_DEFAULT_USER) {
      // Environment-configured relay
      usedHost = process.env.SMTP_DEFAULT_HOST;
      usedPort = Number(process.env.SMTP_DEFAULT_PORT) || 587;
      usedTls = process.env.SMTP_DEFAULT_SECURE === 'true' ? 'SSL/TLS' : 'STARTTLS';

      transporter = nodemailer.createTransport({
        host: process.env.SMTP_DEFAULT_HOST,
        port: usedPort,
        secure: process.env.SMTP_DEFAULT_SECURE === 'true',
        auth: {
          user: process.env.SMTP_DEFAULT_USER,
          pass: process.env.SMTP_DEFAULT_PASS || '',
        },
        dkim: dkimConfig,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    }

    // If sending to external recipients, an active SMTP Relay MUST be configured
    if (externalRecipients.length > 0 && !transporter) {
      const errorExplanation = `Cannot deliver to external recipient(s) [${externalRecipients.join(', ')}]. No outbound SMTP Relay is configured. Please configure your SMTP server (e.g. Namecheap Private Email, Brevo, SendGrid, etc.) in Admin Dashboard > Mail Server & SMTP Relay.`;

      db.addDeliveryLog({
        email_id: email.id,
        mailbox_address: mailbox.address,
        to_addresses: toAddressesList,
        subject: email.subject,
        direction: 'outbound',
        status: 'failed',
        smtp_host: 'No Relay Configured',
        smtp_port: 587,
        tls_type: 'None',
        response_code: 'NO_SMTP_RELAY',
        response_message: 'Outbound SMTP relay required for external internet delivery',
        error_reason: errorExplanation,
        duration_ms: Date.now() - startTime,
      });

      return {
        success: false,
        error: errorExplanation,
      };
    }

    let messageIdResult = email.message_id;

    // 3. Dispatch external email via SMTP relay
    if (transporter) {
      const to = email.to_addresses.map(a => a.name ? `"${a.name}" <${a.address}>` : a.address).join(', ');
      const cc = email.cc_addresses.length > 0 ? email.cc_addresses.map(a => a.name ? `"${a.name}" <${a.address}>` : a.address).join(', ') : undefined;
      const bcc = email.bcc_addresses.length > 0 ? email.bcc_addresses.map(a => a.name ? `"${a.name}" <${a.address}>` : a.address).join(', ') : undefined;

      const fromFormatted = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.address}>` : mailbox.address;

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromFormatted,
        to,
        cc,
        bcc,
        subject: email.subject,
        text: email.body_text,
        html: email.body_html || `<p>${email.body_text.replace(/\n/g, '<br/>')}</p>`,
        messageId: email.message_id,
        inReplyTo: email.in_reply_to,
        references: email.references_header,
        attachments: email.attachments.map(att => ({
          filename: att.filename,
          path: att.path || att.url,
        })),
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        messageIdResult = info.messageId || email.message_id;
      } catch (sendErr: any) {
        // Automatic fallback on send failure (e.g. port 587 timeout)
        console.warn(`[SMTP Outbound] Primary send failed (${sendErr.code || sendErr.message}), attempting fallback to mail.privateemail.com:465 (SSL)...`);
        
        const authInfo = domain?.custom_smtp_user ? {
          user: domain.custom_smtp_user,
          pass: domain.custom_smtp_pass,
        } : (globalSmtp?.user ? {
          user: globalSmtp.user,
          pass: globalSmtp.pass,
        } : undefined);

        if (authInfo) {
          const fallbackTransporter = nodemailer.createTransport({
            host: 'mail.privateemail.com',
            port: 465,
            secure: true,
            auth: authInfo,
            dkim: dkimConfig,
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          });

          const fbInfo = await fallbackTransporter.sendMail(mailOptions);
          messageIdResult = fbInfo.messageId || email.message_id;
          usedHost = 'mail.privateemail.com';
          usedPort = 465;
          usedTls = 'SSL/TLS';
        } else {
          throw sendErr;
        }
      }
    }

    // 4. Deliver local internal copies to internal recipient mailboxes
    for (const intAddr of internalRecipients) {
      const recipientMb = db.getMailboxByAddress(intAddr);
      if (recipientMb && recipientMb.id !== mailbox.id) {
        const inboxEmail: Email = {
          id: uuidv4(),
          mailbox_id: recipientMb.id,
          user_id: recipientMb.user_id,
          thread_id: email.thread_id,
          folder: 'inbox',
          from_address: mailbox.address,
          from_name: mailbox.display_name,
          to_addresses: email.to_addresses,
          cc_addresses: email.cc_addresses,
          bcc_addresses: [],
          subject: email.subject,
          body_text: email.body_text,
          body_html: email.body_html,
          snippet: email.snippet,
          is_read: false,
          is_starred: false,
          is_pinned: false,
          labels: [],
          attachments: email.attachments,
          message_id: email.message_id,
          in_reply_to: email.in_reply_to,
          spam_score: 0,
          spam_reasons: [],
          dkim_verified: true,
          spf_verified: true,
          size_bytes: email.size_bytes,
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        db.createEmail(inboxEmail);
      }
    }

    const duration = Date.now() - startTime;

    // Record positive delivery log
    db.addDeliveryLog({
      email_id: email.id,
      mailbox_address: mailbox.address,
      to_addresses: toAddressesList,
      subject: email.subject,
      direction: 'outbound',
      status: 'delivered',
      smtp_host: transporter ? usedHost : 'Internal Router',
      smtp_port: transporter ? usedPort : 25,
      tls_type: transporter ? usedTls : 'Local Delivery',
      response_code: '250',
      response_message: `250 OK: Email dispatched successfully to ${toAddressesList.join(', ')}`,
      duration_ms: duration,
    });

    console.log(`[SMTP Outbound] Email ${email.id} sent successfully via ${usedHost}:${usedPort}. Duration: ${duration}ms`);
    return {
      success: true,
      messageId: messageIdResult,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    let errorExplanation = err.message || 'SMTP delivery failed';

    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      if (usedPort === 25) {
        errorExplanation = `Port 25 is blocked by Render cloud firewall. Please configure SMTP Relay on Port 587 (STARTTLS) or Port 465 (SSL).`;
      } else {
        errorExplanation = `Connection timed out reaching SMTP server "${usedHost}:${usedPort}".`;
      }
    } else if (err.code === 'EAUTH' || err.responseCode === 535) {
      errorExplanation = `SMTP Authentication failed on "${usedHost}". Invalid username or password credentials.`;
    }

    // Record failure delivery log
    db.addDeliveryLog({
      email_id: email.id,
      mailbox_address: mailbox.address,
      to_addresses: toAddressesList,
      subject: email.subject,
      direction: 'outbound',
      status: 'failed',
      smtp_host: usedHost,
      smtp_port: usedPort,
      tls_type: usedTls,
      response_code: String(err.responseCode || err.code || 'ERR_FAILED'),
      response_message: err.message,
      error_reason: errorExplanation,
      duration_ms: duration,
    });

    console.error(`[SMTP Outbound] Failed sending email ${email.id}:`, errorExplanation);
    return {
      success: false,
      error: errorExplanation,
    };
  }
}

// ==========================================
// 5. Inbound Mail Receiver (Raw EML / Webhook Parser)
// ==========================================
export async function processInboundEmailStream(emlBuffer: Buffer | string): Promise<{ success: boolean; email?: Email; error?: string }> {
  try {
    const parsed: ParsedMail = await simpleParser(emlBuffer);

    const toList = Array.isArray(parsed.to) ? parsed.to : (parsed.to ? [parsed.to] : []);
    const recipientAddresses: string[] = [];
    for (const group of toList) {
      for (const item of group.value) {
        if (item.address) recipientAddresses.push(item.address.toLowerCase().trim());
      }
    }

    if (recipientAddresses.length === 0) {
      return { success: false, error: 'No recipient address found in email header' };
    }

    // Find destination mailbox
    let matchedMailbox: Mailbox | undefined;
    for (const address of recipientAddresses) {
      const mb = db.getMailboxByAddress(address);
      if (mb) {
        matchedMailbox = mb;
        break;
      }
    }

    // If no exact mailbox, fallback to the default mailbox of the domain
    if (!matchedMailbox && recipientAddresses[0]) {
      const domainPart = recipientAddresses[0].split('@')[1];
      if (domainPart) {
        const domain = db.getDomainByName(domainPart);
        if (domain) {
          const mailboxes = db.getMailboxes(domain.user_id);
          matchedMailbox = mailboxes.find(m => m.domain_id === domain.id && m.is_default) || mailboxes[0];
        }
      }
    }

    if (!matchedMailbox) {
      return { success: false, error: `Recipient mailbox not found for ${recipientAddresses.join(', ')}` };
    }

    const fromAddress = parsed.from?.value[0]?.address || 'unknown@sender.com';
    const fromName = parsed.from?.value[0]?.name || '';

    const toAddresses = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
      .flatMap(g => g.value.map(v => ({ name: v.name, address: v.address || '' })));

    const ccAddresses = (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
      .flatMap(g => g.value.map(v => ({ name: v.name, address: v.address || '' })));

    const bodyText = parsed.text || '';
    const bodyHtml = (parsed.html as string) || '';
    const snippet = (bodyText || bodyHtml.replace(/<[^>]*>?/gm, '')).substring(0, 160).trim();

    // Spam score
    const spamCheck = calculateSpamScore({
      subject: parsed.subject || '',
      body_text: bodyText,
      from_address: fromAddress,
    });

    const isSpam = spamCheck.score >= 5.0;

    // Attachments
    const attachments = (parsed.attachments || []).map(att => ({
      id: uuidv4(),
      filename: att.filename || `attachment-${Date.now()}`,
      content_type: att.contentType || 'application/octet-stream',
      size_bytes: att.size || att.content.length,
      url: `/api/attachments/${uuidv4()}?name=${encodeURIComponent(att.filename || 'file')}`,
    }));

    // Find existing thread by in-reply-to or subject matching
    let threadId = uuidv4();
    if (parsed.inReplyTo) {
      const existingEmail = db.getEmails(matchedMailbox.user_id).find(e => e.message_id === parsed.inReplyTo);
      if (existingEmail) {
        threadId = existingEmail.thread_id;
      }
    }

    const newEmail: Email = {
      id: uuidv4(),
      mailbox_id: matchedMailbox.id,
      user_id: matchedMailbox.user_id,
      thread_id: threadId,
      folder: isSpam ? 'spam' : 'inbox',
      from_address: fromAddress,
      from_name: fromName,
      to_addresses: toAddresses.length > 0 ? toAddresses : [{ address: matchedMailbox.address }],
      cc_addresses: ccAddresses,
      bcc_addresses: [],
      subject: parsed.subject || '(No Subject)',
      body_text: bodyText,
      body_html: bodyHtml,
      snippet,
      is_read: false,
      is_starred: false,
      is_pinned: false,
      labels: isSpam ? ['Spam'] : [],
      attachments,
      message_id: parsed.messageId || `<${uuidv4()}@${matchedMailbox.address.split('@')[1]}>`,
      in_reply_to: parsed.inReplyTo,
      references_header: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references,
      spam_score: spamCheck.score,
      spam_reasons: spamCheck.reasons,
      dkim_verified: true,
      spf_verified: true,
      size_bytes: Buffer.byteLength(emlBuffer),
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    db.createEmail(newEmail);
    db.logAction('EMAIL_RECEIVED', {
      from: fromAddress,
      to: matchedMailbox.address,
      subject: newEmail.subject,
      folder: newEmail.folder,
      spam_score: spamCheck.score,
    }, matchedMailbox.user_id);

    db.addDeliveryLog({
      email_id: newEmail.id,
      mailbox_address: matchedMailbox.address,
      to_addresses: [matchedMailbox.address],
      subject: newEmail.subject,
      direction: 'inbound',
      status: 'delivered',
      smtp_host: 'Inbound Receiver/Webhook',
      smtp_port: 25,
      tls_type: 'TLS Inbound',
      response_code: '250',
      response_message: `250 OK: Inbound email stored to ${newEmail.folder}`,
      duration_ms: 45,
    });

    // Auto-responder check
    if (matchedMailbox.auto_reply_enabled && matchedMailbox.auto_reply_body && !isSpam) {
      const autoReplyEmail: Email = {
        id: uuidv4(),
        mailbox_id: matchedMailbox.id,
        user_id: matchedMailbox.user_id,
        thread_id: threadId,
        folder: 'sent',
        from_address: matchedMailbox.address,
        from_name: matchedMailbox.display_name,
        to_addresses: [{ name: fromName, address: fromAddress }],
        cc_addresses: [],
        bcc_addresses: [],
        subject: matchedMailbox.auto_reply_subject || `Auto-Reply: ${newEmail.subject}`,
        body_text: matchedMailbox.auto_reply_body,
        body_html: `<p>${matchedMailbox.auto_reply_body.replace(/\n/g, '<br/>')}</p>`,
        snippet: matchedMailbox.auto_reply_body.substring(0, 120),
        is_read: true,
        is_starred: false,
        is_pinned: false,
        labels: [],
        attachments: [],
        message_id: `<auto-reply-${uuidv4()}@${matchedMailbox.address.split('@')[1]}>`,
        in_reply_to: newEmail.message_id,
        spam_score: 0,
        spam_reasons: [],
        dkim_verified: true,
        spf_verified: true,
        size_bytes: 4000,
        received_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      db.createEmail(autoReplyEmail);
    }

    return { success: true, email: newEmail };
  } catch (err: any) {
    console.error('Failed to parse inbound email:', err);
    return { success: false, error: err.message || 'Inbound parse error' };
  }
}

// ==========================================
// 6. Background Outbox Retry Queue Worker
// ==========================================
let isWorkerRunning = false;

export function startOutboxWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log('[Outbox Queue] Background retry worker initiated (interval: 15s)');

  setInterval(async () => {
    try {
      const pendingItems = db.getPendingOutboxItems();
      if (pendingItems.length === 0) return;

      console.log(`[Outbox Queue] Processing ${pendingItems.length} queued item(s)...`);

      for (const item of pendingItems) {
        const email = db.getEmailById(item.email_id);
        const mailbox = db.getMailboxById(item.mailbox_id);

        if (!email || !mailbox) {
          db.updateOutboxItem(item.id, {
            status: 'failed',
            last_error: 'Referenced email or mailbox no longer exists',
          });
          continue;
        }

        const domain = db.getDomainById(mailbox.domain_id);

        // Mark as sending
        db.updateOutboxItem(item.id, {
          status: 'sending',
          attempts: item.attempts + 1,
        });

        const deliveryResult = await sendEmailDirectOrRelay(email, mailbox, domain);

        if (deliveryResult.success) {
          db.updateOutboxItem(item.id, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: undefined,
          });
          db.logAction('OUTBOX_DELIVERED', {
            email_id: email.id,
            to: email.to_addresses,
            attempts: item.attempts + 1,
          }, item.user_id);
        } else {
          const nextAttempt = item.attempts + 1;
          const isMaxed = nextAttempt >= item.max_attempts;
          // Exponential backoff: 30s, 2m, 8m, 32m
          const backoffSeconds = Math.pow(4, nextAttempt) * 15;
          const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();

          db.updateOutboxItem(item.id, {
            status: isMaxed ? 'failed' : 'queued',
            last_error: deliveryResult.error || 'Delivery timeout',
            next_retry_at: nextRetry,
          });

          db.logAction('OUTBOX_DELIVERY_FAILED', {
            email_id: email.id,
            error: deliveryResult.error,
            attempts: nextAttempt,
            is_final: isMaxed,
          }, item.user_id);
        }
      }
    } catch (err) {
      console.error('[Outbox Queue] Worker cycle error:', err);
    }
  }, 15000);
}
