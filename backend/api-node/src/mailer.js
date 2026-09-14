'use strict';
/* ==========================================================
   BARBERFIE - outgoing email
   Uses SMTP settings from backend/.env. When SMTP_HOST is not
   set (local development) the message is printed to the
   console instead, including the verification link.
   ========================================================== */
const nodemailer = require('nodemailer');

let transport = null;

function getTransport() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST) return null;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10000,   // fail fast if the host blocks SMTP (some cloud hosts do)
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  return transport;
}

/** Split "Name <addr@x>" into { name, email } for HTTP mail APIs. */
function parseFrom(raw) {
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw || '');
  return m ? { name: m[1].trim() || 'BARBERFIE', email: m[2].trim() } : { name: 'BARBERFIE', email: (raw || '').trim() };
}

/** Send through Brevo's HTTP API (works on hosts that block SMTP, e.g. Railway). */
async function sendViaBrevo({ from, to, subject, text, html }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: html })
    });
    if (!res.ok) throw new Error('Brevo rejected the email (' + res.status + '): ' + (await res.text()).slice(0, 200));
    return res.json();
  } finally { clearTimeout(timer); }
}

/** Send an email. Uses Brevo if BREVO_API_KEY is set, else SMTP, else prints to the console. */
async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || 'BARBERFIE <no-reply@barberfie.local>';
  if (process.env.BREVO_API_KEY) return sendViaBrevo({ from, to, subject, text, html });
  const t = getTransport();
  if (!t) {
    console.log('\n---- EMAIL (no mail provider configured, printing instead) ----');
    console.log('To: ' + to + '\nSubject: ' + subject + '\n\n' + text + '\n-------------------------------------------------------\n');
    return { dev: true };
  }
  return t.sendMail({ from, to, subject, text, html });
}

/** Build the link the user clicks to confirm their address.
    `base` is the site address the person signed up from (so the link works
    on a tunnel or LAN address); falls back to APP_URL from .env. */
function verifyLink(token, base) {
  base = (base || process.env.APP_URL || 'http://localhost:5500').replace(/\/$/, '');
  return base + '/auth/verify.html?token=' + encodeURIComponent(token);
}

async function sendVerificationEmail(user, token, base, code) {
  const link = verifyLink(token, base);
  console.log(`[verify] ${user.email} code=${code} -> ${link}`);   // always logged so link problems can be diagnosed
  const text =
'Hi ' + user.first_name + ',\n\n' +
'Welcome to BARBERFIE. Your verification code is:\n\n' +
'    ' + code + '\n\n' +
'Type it into the page where you signed up, or open this link instead:\n\n' +
link + '\n\n' +
'The code and link are valid for 24 hours. If you did not create an account, you can ignore this email.';
  const html =
'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#222">' +
'<h2 style="margin-top:0">Welcome to BARBER<span style="color:#c9a24a">FIE</span></h2>' +
'<p>Hi ' + user.first_name + ',</p>' +
'<p>Your verification code is:</p>' +
'<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:12px 0 20px">' + code + '</p>' +
'<p>Type it into the page where you signed up. Or, if you are on the same device, just click the button:</p>' +
'<p style="margin:20px 0"><a href="' + link + '" style="background:#c9a24a;color:#111;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">Verify my email</a></p>' +
'<p style="font-size:13px;color:#666">The code and link are valid for 24 hours. If you did not create an account, you can ignore this email.</p>' +
'</div>';
  return sendMail({ to: user.email, subject: 'Confirm your BARBERFIE email', text, html });
}

module.exports = { sendMail, sendVerificationEmail, verifyLink };
