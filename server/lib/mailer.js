// server/lib/mailer.js
// Transactional email for verification + password reset.
// Set SMTP_HOST (and related env vars) in Vercel to enable live mail.
// Without SMTP configured, logs to console and skips sending.

let nodemailer;
try { nodemailer = require('nodemailer'); } catch {}

const { mail, isProd } = require('../config');

let transporter;
function getTransporter() {
  if (!nodemailer) throw new Error('nodemailer not installed — run: npm i nodemailer');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.port === 465,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!mail.host) {
    console.log(`[mailer:dev] to=${to} subject="${subject}"\n${text || html}`);
    if (isProd) {
      console.warn('[mailer] SMTP not configured — email not sent in production');
    }
    return { dev: true };
  }
  return getTransporter().sendMail({ from: mail.from, to, subject, html, text });
}

async function sendVerificationEmail(to, link) {
  return sendMail({
    to,
    subject: 'Confirm your DrinkedInn email',
    text: `Welcome to DrinkedInn. Confirm your email: ${link}`,
    html: `<p>Welcome to DrinkedInn 🥃</p>
           <p>Confirm your email to start posting:</p>
           <p><a href="${link}">Verify my email</a></p>
           <p>If you didn't sign up, ignore this message.</p>`,
  });
}

async function sendResetEmail(to, link) {
  return sendMail({
    to,
    subject: 'Reset your DrinkedInn password',
    text: `Reset your password: ${link} (expires in 1 hour)`,
    html: `<p>Reset your DrinkedInn password (link expires in 1 hour):</p>
           <p><a href="${link}">Reset password</a></p>`,
  });
}

async function sendDigestEmail(to, { subject, heading, intro, items = [], ctaUrl, ctaLabel, unsubscribeUrl }) {
  const itemsHtml = items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
           <div style="font-weight:600;color:#1a1a1a;">${i.title}</div>
           ${i.body ? `<div style="color:#555;font-size:14px;margin-top:2px;">${i.body}</div>` : ''}
         </td></tr>`
    )
    .join('');
  const itemsText = items.map((i) => `• ${i.title}${i.body ? ` — ${i.body}` : ''}`).join('\n');

  return sendMail({
    to,
    subject,
    text: `${heading}\n\n${intro}\n\n${itemsText}\n\n${ctaLabel}: ${ctaUrl}\n\nManage emails: ${unsubscribeUrl}`,
    html: `
      <div style="max-width:520px;margin:0 auto;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
        <h2 style="margin:0 0 4px;">🥃 ${heading}</h2>
        <p style="color:#555;font-size:15px;margin:0 0 16px;">${intro}</p>
        ${items.length ? `<table style="width:100%;border-collapse:collapse;">${itemsHtml}</table>` : ''}
        <p style="margin:24px 0;">
          <a href="${ctaUrl}" style="background:#0a66c2;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">${ctaLabel}</a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:12px;">
          You're getting this because you have digest emails on.
          <a href="${unsubscribeUrl}" style="color:#999;">Turn these off</a>. Enjoy responsibly. 🥃
        </p>
      </div>`,
  });
}

module.exports = { sendMail, sendVerificationEmail, sendResetEmail, sendDigestEmail };
