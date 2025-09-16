// lib/mailer.ts
import nodemailer from 'nodemailer';
import { htmlToText } from 'html-to-text';
import type { IssuedTicket } from './tickets';
import type Mail from 'nodemailer/lib/mailer';

// ───────────────────────────────────────────────────────────────────────────────
// Env & constants
// ───────────────────────────────────────────────────────────────────────────────
const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Pasar Malam SIS';
export const mailBcc = process.env.MAIL_BCC || undefined;
export const mailReplyTo = process.env.MAIL_REPLY_TO || undefined;
export const EVENT_NAME = process.env.EVENT_NAME || 'Pasar Malam SIS 2025';

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set in env');
}

const FROM = `${MAIL_FROM_NAME} <${GMAIL_USER}>`;

// ───────────────────────────────────────────────────────────────────────────────
// Transport
// ───────────────────────────────────────────────────────────────────────────────
export const gmailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,         // SSL
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

export async function verifyMailer() {
  try {
    await gmailTransporter.verify();
    return true;
  } catch (e) {
    console.error('MAILER_VERIFY_ERROR:', e);
    return false;
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Generic sender
// ───────────────────────────────────────────────────────────────────────────────
type SendMailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Mail.Attachment[]; 
};

export async function sendMail(opts: SendMailOptions) {
  const {
    to, subject, html, text,
    cc, bcc = mailBcc, replyTo = mailReplyTo, headers = {}, attachments,
  } = opts;

  return gmailTransporter.sendMail({
    from: FROM,
    to, cc, bcc, replyTo,
    subject,
    html,
    text: text ?? htmlToText(html, { wordwrap: 100 }),
    headers: {
      'List-Unsubscribe': `<mailto:${replyTo || GMAIL_USER}>`,
      ...headers,
    },
    attachments,
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// Registration email
// ───────────────────────────────────────────────────────────────────────────────
export async function sendRegistrationEmail(params: {
  to: string;
  name: string;
  tickets_regular: number;
  tickets_member: number;
  tickets_student: number;
  tickets_children: number;
  total_amount: number;
  regId: string;
}) {
  const { to, name, tickets_regular, tickets_member, tickets_student, tickets_children, total_amount, regId } = params;

  const html = renderRegistrationHtml({
    name, tickets_regular, tickets_member, tickets_student, tickets_children, total_amount, regId,
  });

  await sendMail({
    to,
    subject: `Your registration to ${EVENT_NAME} is received 🎉`,
    html,
    headers: { 'X-Entity-Ref-ID': regId },
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// Tickets email
// ───────────────────────────────────────────────────────────────────────────────
export async function sendTicketsEmail(
  to: string,
  recipientName: string,
  tickets: IssuedTicket[],
  subject = 'Your Tickets'
) {
  if (!tickets?.length) return;

  // Build attachments (CID for each ticket)
  const attachments = tickets.map(t => {
    const cid = `qr-${t.ticketNo}@pm`; // any unique string
    return {
      filename: `${t.ticketNo}.png`,
      path: t.qrUrl,                 // Nodemailer will fetch and embed
      cid,                           // reference this in <img src="cid:...">
      contentType: 'image/png',
    };
  });

  // Map ticketNo -> cid for template
  const cidByTicketNo = Object.fromEntries(
    attachments.map(a => [a.filename.replace('.png',''), a.cid as string])
  );

  const html = renderTicketsHtml(recipientName, tickets, cidByTicketNo);
  const text = renderTicketsText(recipientName, tickets);

  await sendMail({ to, subject, html, text, attachments });
}

// ───────────────────────────────────────────────────────────────────────────────
// Templates & helpers
// ───────────────────────────────────────────────────────────────────────────────
function renderRegistrationHtml(params: {
  name: string;
  tickets_regular: number;
  tickets_member: number;
  tickets_children: number;
  tickets_student: number;
  total_amount: number;
  regId: string;
}) {
  const { name, tickets_regular, tickets_member, tickets_student, tickets_children, total_amount, regId } = params;

  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px;">
    <h2 style="margin:0 0 12px 0;">Registration received 😊</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for registering for <strong>${escapeHtml(EVENT_NAME)}</strong>.</p>
    <p>Your order:</p>
    <ul>
      <li>Regular: ${tickets_regular}</li>
      <li>Member: ${tickets_member}</li>
      <li>Student: ${tickets_student}</li>
      <li>Children: ${tickets_children}</li>
    </ul>
    <p>Total: <strong>${sek(total_amount)}</strong></p>
    <p>We will send your tickets once we’ve verified your payment (up to 48 hrs).</p>
    <p style="font-size:12px;color:#6b7280">— PM Team //Alex</p>
  </div>`;
}

function renderTicketsHtml(
  name: string,
  tickets: IssuedTicket[],
  cidByTicketNo?: Record<string, string>
) {
  const rows = tickets.map(t => {
    const cid = cidByTicketNo?.[t.ticketNo];
    const imgSrc = cid ? `cid:${cid}` : t.qrUrl; // fallback to remote if no cid
    return `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">
          <div style="font-weight:600">${escapeHtml(t.ticketNo)}</div>
          <div style="font-size:12px;color:#6b7280">${escapeHtml(t.type)}</div>
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;">
          <a href="${t.qrUrl}">
            <img src="${imgSrc}"
                 alt="QR for ${escapeHtml(t.ticketNo)}"
                 style="display:block;width:160px;height:auto;border:0;outline:none;text-decoration:none;" />
          </a>
        </td>
      </tr>
    `;
  }).join('');

  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px;">
    <h2 style="margin:0 0 12px 0;">Your ticket(s) are ready 🎟️</h2>
    <p style="margin:0 0 16px 0;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 12px 0;">Show the QR at entry and keep the ticket numbers. See you there!</p>
    <table style="border-collapse:collapse;width:100%;margin:12px 0 16px 0;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border:1px solid #e5e7eb;background:#f9fafb;">Ticket</th>
          <th style="text-align:left;padding:8px;border:1px solid #e5e7eb;background:#f9fafb;">QR</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#6b7280;margin-top:24px;">Problems? Reply to this email.</p>
    <p style="font-size:12px;color:#6b7280">— PM Team  //Alex</p>
  </div>`;
}


function renderTicketsText(name: string, tickets: IssuedTicket[]) {
  const lines = tickets.map(t => `• ${t.ticketNo} (${t.type}) — ${t.qrUrl}`).join('\n');
  return `Hi ${name},

Your ticket(s) are ready:
${lines}

Show the QR at entry and keep the ticket number(s). See you there!

— PM Team //Alex`;
}

function sek(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
}
