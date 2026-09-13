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
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

/** Send an email. Returns a promise. */
async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || 'BARBERFIE <no-reply@barberfie.local>';
  const t = getTransport();
  if (!t) {
    console.log('\n---- EMAIL (SMTP not configured, printing instead) ----');
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
