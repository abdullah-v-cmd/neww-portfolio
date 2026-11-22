import nodemailer from 'nodemailer';
import { db } from './db.ts';
import { decryptSecret } from './crypto.ts';

interface SmtpSettingsRow {
  id: number;
  host: string;
  port: number;
  username: string;
  password_enc: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  notification_email: string;
  encryption_mode: string;
  is_enabled: number;
}

function getSmtpSettings(): SmtpSettingsRow | undefined {
  return db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get() as SmtpSettingsRow | undefined;
}

function createTransport(settings: SmtpSettingsRow) {
  const password = decryptSecret(settings.password_enc);
  return nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port) || 587,
    secure: settings.encryption_mode === 'ssl' || Number(settings.port) === 465,
    requireTLS: settings.encryption_mode === 'starttls',
    auth: settings.username ? { user: settings.username, pass: password } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
}

function logDelivery(recipient: string, subject: string, status: string, errorMessage = '', messageId = '') {
  db.prepare(
    `INSERT INTO email_delivery_logs (recipient, subject, status, error_message, message_id) VALUES (?, ?, ?, ?, ?)`
  ).run(recipient, subject, status, errorMessage, messageId);
}

export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  const settings = getSmtpSettings();
  if (!settings || !settings.host) {
    return { ok: false, message: 'SMTP host is not configured yet.' };
  }
  try {
    const transport = createTransport(settings);
    await transport.verify();
    return { ok: true, message: `SMTP connection verified with ${settings.host}:${settings.port}` };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'SMTP verification failed.' };
  }
}

export async function sendEmailViaSmtp(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
  forceEvenIfDisabled?: boolean;
}): Promise<{
  ok: boolean;
  statusLabel: 'Accepted by SMTP provider' | 'Failed' | 'Skipped';
  message: string;
  messageId?: string;
}> {
  const settings = getSmtpSettings();
  if (!settings || !settings.host || !settings.from_email) {
    logDelivery(params.to, params.subject, 'skipped', 'SMTP host or sender email not configured');
    return { ok: false, statusLabel: 'Skipped', message: 'SMTP is awaiting configuration in Admin -> Email Settings.' };
  }
  if (!settings.is_enabled && !params.forceEvenIfDisabled) {
    logDelivery(params.to, params.subject, 'skipped', 'SMTP sending is disabled');
    return { ok: false, statusLabel: 'Skipped', message: 'SMTP sending is currently disabled in Admin -> Email Settings.' };
  }

  try {
    const transport = createTransport(settings);
    const info = await transport.sendMail({
      from: settings.from_name ? `"${settings.from_name}" <${settings.from_email}>` : settings.from_email,
      to: params.to,
      replyTo: params.replyTo || settings.reply_to || settings.from_email,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });
    logDelivery(params.to, params.subject, 'sent', '', info.messageId || '');
    return {
      ok: true,
      statusLabel: 'Accepted by SMTP provider',
      message: 'Email accepted by SMTP provider.',
      messageId: info.messageId,
    };
  } catch (err: any) {
    const errMsg = err?.message || 'SMTP send error';
    logDelivery(params.to, params.subject, 'failed', errMsg);
    return { ok: false, statusLabel: 'Failed', message: errMsg };
  }
}

export async function notifyAdminOfRecruiterMessage(params: {
  recruiterName: string;
  recruiterEmail: string;
  company: string;
  subject: string;
  body: string;
  threadToken: string;
}): Promise<void> {
  const settings = getSmtpSettings();
  if (!settings || !settings.is_enabled || !settings.notification_email) return;

  await sendEmailViaSmtp({
    to: settings.notification_email,
    subject: `[Portfolio Inquiry] ${params.subject} — ${params.recruiterName}`,
    replyTo: params.recruiterEmail,
    text: [
      `New recruiter message received on Abdullah Naveed's portfolio:`,
      `From: ${params.recruiterName} <${params.recruiterEmail}>`,
      params.company ? `Company: ${params.company}` : '',
      `Subject: ${params.subject}`,
      `Thread Reference: ${params.threadToken}`,
      ``,
      params.body,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

export async function notifyAdminOfCvRequest(params: {
  requestUid: string;
  fullName: string;
  company: string;
  email: string;
  jobTitle: string;
  message: string;
}): Promise<void> {
  const settings = getSmtpSettings();
  if (!settings || !settings.is_enabled || !settings.notification_email) return;

  await sendEmailViaSmtp({
    to: settings.notification_email,
    subject: `[CV Request ${params.requestUid}] ${params.fullName} — ${params.company}`,
    replyTo: params.email,
    text: [
      `New Recruiter CV Request received (${params.requestUid}):`,
      `Name: ${params.fullName}`,
      `Company: ${params.company}`,
      `Email: ${params.email}`,
      params.jobTitle ? `Job Title: ${params.jobTitle}` : '',
      params.message ? `Message: ${params.message}` : '',
      ``,
      `Review and respond from Admin Panel -> Recruiter Requests -> CV Requests.`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}
