// server/lib/mailer.js
// Transactional email: verification links, password resets and the digest.
//
// Two transports, because the runtimes differ:
//   - HTTP API (Resend) — works everywhere, and is the ONLY option on
//     Cloudflare Workers, which cannot open the raw TCP socket SMTP needs.
//   - SMTP via nodemailer — Node only, kept so an existing SMTP provider
//     still works locally or on a Node host.
//
// HTTP is preferred when configured. With neither, mail is logged rather than
// sent, so development works with no credentials.

const config = require('../config');

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const HTTP_ENDPOINT = 'https://api.resend.com/emails';

let nodemailer;
try { nodemailer = require('nodemailer'); } catch {}

let transporter;
function smtpTransport() {
  if (!transporter && nodemailer) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
  }
  return transporter;
}

async function sendViaHttp({ to, subject, html, text }) {
  const res = await fetch(HTTP_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.mail.from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Email API ${res.status}: ${detail.slice(0, 200)}`);
  }
  return { via: 'http' };
}

async function sendMail({ to, subject, html, text }) {
  if (RESEND_KEY) return sendViaHttp({ to, subject, html, text });

  if (config.mail.host && nodemailer) {
    return smtpTransport().sendMail({ from: config.mail.from, to, subject, html, text });
  }

  // Nothing configured. Log rather than throw — a failed verification email
  // must not fail the registration that triggered it.
  console.log(`[mailer:unconfigured] to=${to} subject="${subject}"`);
  if (config.isProd) {
    console.warn('[mailer] No RESEND_API_KEY or SMTP_HOST set — email is NOT being delivered.');
  }
  return { via: 'log' };
}

async function sendVerificationEmail(to, link) {
  return sendMail({
    to,
    subject: 'Confirm your DrinkedInn email',
    text: `Welcome to DrinkedInn. Confirm your email: ${link}`,
    html: `<p>Welcome to DrinkedInn.</p>
           <p>Confirm your email to start sharing:</p>
           <p><a href="${link}">Verify my email</a></p>
           <p>If you didn't sign up, ignore this message.</p>`,
  });
}

async function sendResetEmail(to, link) {
  return sendMail({
    to,
    subject: 'Reset your DrinkedInn password',
    text: `Reset your password: ${link} (expires in 1 hour)`,
    html: `<p>Reset your DrinkedInn password (the link expires in 1 hour):</p>
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
        <h2 style="margin:0 0 4px;">${heading}</h2>
        <p style="color:#555;font-size:15px;margin:0 0 16px;">${intro}</p>
        ${items.length ? `<table style="width:100%;border-collapse:collapse;">${itemsHtml}</table>` : ''}
        <p style="margin:24px 0;">
          <a href="${ctaUrl}" style="background:#C8831F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">${ctaLabel}</a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:12px;">
          You're getting this because you have digest emails on.
          <a href="${unsubscribeUrl}" style="color:#999;">Turn these off</a>. Please drink responsibly.
        </p>
      </div>`,
  });
}

module.exports = { sendMail, sendVerificationEmail, sendResetEmail, sendDigestEmail };
