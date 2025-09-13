import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER!;
const pass = process.env.GMAIL_APP_PASSWORD!;

export const mailFromName = process.env.MAIL_FROM_NAME || 'Pasar Malam SIS';
export const mailBcc = process.env.MAIL_BCC || undefined;

export const gmailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,            // 465 = SSL (recommended). Use 587 with secure:false if needed.
  secure: true,
  auth: { user, pass },
});

// Simple sanity check you can call at startup if you want
export async function verifyMailer() {
  try {
    await gmailTransporter.verify();
    return true;
  } catch (e) {
    console.error('MAILER_VERIFY_ERROR:', e);
    return false;
  }
}
