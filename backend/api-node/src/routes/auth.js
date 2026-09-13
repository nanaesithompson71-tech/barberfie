'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, one } = require('../db');
const { HttpError, wrap, EMAIL_RE, signToken, requireAuth, publicUser } = require('../util');
const { sendVerificationEmail } = require('../mailer');

const VERIFY_TTL_HOURS = 24;
const MAX_CODE_ATTEMPTS = 5;

function newToken() { return crypto.randomBytes(32).toString('hex'); }
function newCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function expiresAt() { return new Date(Date.now() + VERIFY_TTL_HOURS * 3600 * 1000); }
function isExpired(row) { return row.verify_expires && new Date(row.verify_expires) < new Date(); }

/** Work out which site address the request came from, so the emailed link
    opens on the same address (localhost, LAN IP, or a public tunnel).
    Only trusted origins are used: the CORS list, or the API's own host. */
function siteBase(req) {
  const origin = req.get('origin') || '';
  const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) return origin;
  try {
    const host = req.get('host');
    if (origin && new URL(origin).host === host) return origin;   // pages served by this API
    if (!origin && host) return (req.protocol || 'http') + '://' + host;
  } catch (e) { /* fall through */ }
  return null;
}

/* ----------------------------------------------------------------
   Sign-ups are NOT accounts yet. They wait in `pending_signups` until
   the person proves they own the address (typed code or clicked link).
   Only then is the row in `users` created.
   ---------------------------------------------------------------- */

async function sendCode(pending, req) {
  try { await sendVerificationEmail(pending, pending.verify_token, req ? siteBase(req) : null, pending.verify_code); }
  catch (err) {
    console.error('Could not send verification email:', err.message);
    throw new HttpError(502, 'We could not send the verification email. Please try again shortly.');
  }
}

/** Give a pending sign-up a fresh code + link, reset the guess counter, and email it. */
async function reissue(pending, req) {
  pending.verify_token = newToken();
  pending.verify_code = newCode();
  await query('UPDATE pending_signups SET verify_token = ?, verify_code = ?, verify_expires = ?, attempts = 0 WHERE id = ?',
    [pending.verify_token, pending.verify_code, expiresAt(), pending.id]);
  await sendCode(pending, req);
}

/** Turn a verified pending sign-up into a real account. Returns the new user row. */
async function promote(pending) {
  const clash = await one('SELECT id FROM users WHERE email = ?', [pending.email]);
  if (clash) {
    await query('DELETE FROM pending_signups WHERE id = ?', [pending.id]);
    throw new HttpError(409, 'An account with that email already exists. Please sign in.');
  }
  const result = await query(
    'INSERT INTO users (first_name, last_name, email, phone, password_hash, email_verified, pending_key) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [pending.first_name, pending.last_name, pending.email, pending.phone, pending.password_hash, pending.pending_key]
  );
  await query('DELETE FROM pending_signups WHERE id = ?', [pending.id]);
  return one('SELECT * FROM users WHERE id = ?', [result.insertId]);
}

/* POST /api/auth/register
   Validates, stores the sign-up as *pending* and emails the code. Nothing is
   written to `users` until /verify or /verify-code succeeds. */
router.post('/register', wrap(async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body || {};
  if (!firstName || !lastName) throw new HttpError(400, 'First and last name are required.');
  if (!EMAIL_RE.test(email || '')) throw new HttpError(400, 'Enter a valid email address.');
  const cleanPhone = String(phone || '').replace(/[\s()-]/g, '');
  if (!/^\+\d{7,15}$/.test(cleanPhone)) throw new HttpError(400, 'Enter a valid phone number with your country code.');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

  const cleanEmail = email.toLowerCase().trim();
  const exists = await one('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (exists) throw new HttpError(409, 'An account with that email already exists.');

  // Tidy up, then replace any earlier unfinished sign-up for this address with the new details.
  await query('DELETE FROM pending_signups WHERE verify_expires < NOW() OR email = ?', [cleanEmail]);

  const pending = {
    first_name: firstName.trim().slice(0, 60), last_name: lastName.trim().slice(0, 60),
    email: cleanEmail, phone: cleanPhone,
    password_hash: await bcrypt.hash(password, 10),
    verify_token: newToken(), verify_code: newCode(), pending_key: newToken()
  };
  const result = await query(
    'INSERT INTO pending_signups (first_name, last_name, email, phone, password_hash, verify_token, verify_code, verify_expires, pending_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [pending.first_name, pending.last_name, pending.email, pending.phone, pending.password_hash, pending.verify_token, pending.verify_code, expiresAt(), pending.pending_key]
  );
  pending.id = result.insertId;

  try { await sendCode(pending, req); }
  catch (err) { await query('DELETE FROM pending_signups WHERE id = ?', [pending.id]); throw err; }

  res.status(201).json({
    pendingVerification: true, email: pending.email, pendingKey: pending.pending_key,
    message: 'We emailed you a 6-digit code. Enter it to finish creating your account.'
  });
}));

/* GET /api/auth/pending?key=...
   Polled by the device that started the sign-up. The key is a secret only
   that device knows; once the email is verified anywhere, this answers with
   a session so the original device can open the dashboard. */
router.get('/pending', wrap(async (req, res) => {
  const key = String(req.query.key || '');
  if (!/^[a-f0-9]{64}$/.test(key)) throw new HttpError(400, 'Invalid key.');
  const user = await one('SELECT * FROM users WHERE pending_key = ?', [key]);
  if (user) {
    await query('UPDATE users SET pending_key = NULL WHERE id = ?', [user.id]);
    return res.json({ verified: true, token: signToken(user), user: publicUser(user) });
  }
  const pending = await one('SELECT id, verify_expires FROM pending_signups WHERE pending_key = ?', [key]);
  if (!pending || isExpired(pending)) throw new HttpError(404, 'Nothing pending for this key.');
  res.json({ verified: false });
}));

/* GET /api/auth/verify?token=...   (the emailed link) */
router.get('/verify', wrap(async (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'That verification link is not valid.');
  const pending = await one('SELECT * FROM pending_signups WHERE verify_token = ?', [token]);
  if (!pending) throw new HttpError(400, 'That verification link is not valid or has already been used.');
  if (isExpired(pending)) throw new HttpError(410, 'That verification link has expired. Start the sign-up again to get a new one.');
  const user = await promote(pending);
  res.json({ verified: true, token: signToken(user), user: publicUser(user) });
}));

/* POST /api/auth/verify-code  { email, code }
   Typed into the signup (or login) page from the email, so it works no matter
   which device or address the email was opened on. */
router.post('/verify-code', wrap(async (req, res) => {
  const email = String((req.body || {}).email || '').toLowerCase().trim();
  const code = String((req.body || {}).code || '').replace(/\D/g, '');
  if (!EMAIL_RE.test(email) || code.length !== 6) throw new HttpError(400, 'Enter the 6-digit code from your email.');
  const pending = await one('SELECT * FROM pending_signups WHERE email = ?', [email]);
  if (!pending) {
    const user = await one('SELECT id FROM users WHERE email = ?', [email]);
    if (user) throw new HttpError(409, 'That email is already verified. Please sign in.');
    throw new HttpError(400, 'That code is not correct.');
  }
  if (!pending.verify_code) throw new HttpError(400, 'No code is active for this sign-up. Request a new one.');
  if (isExpired(pending)) throw new HttpError(410, 'That code has expired. Request a new one.');
  if (pending.verify_code !== code) {
    // A few wrong guesses cancel the code so it cannot be brute-forced.
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await query('UPDATE pending_signups SET verify_code = NULL, attempts = 0 WHERE id = ?', [pending.id]);
      throw new HttpError(429, 'Too many wrong attempts. Request a new code.');
    }
    await query('UPDATE pending_signups SET attempts = ? WHERE id = ?', [attempts, pending.id]);
    throw new HttpError(400, 'That code is not correct.');
  }
  const user = await promote(pending);
  res.json({ verified: true, token: signToken(user), user: publicUser(user) });
}));

/* POST /api/auth/resend  { email } */
router.post('/resend', wrap(async (req, res) => {
  const email = String((req.body || {}).email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const pending = await one('SELECT * FROM pending_signups WHERE email = ?', [email]);
  // Always answer the same way so the endpoint cannot be used to look up accounts.
  if (pending) await reissue(pending, req);
  res.json({ ok: true, message: 'If that address has a sign-up waiting, a new code is on its way.' });
}));

/* POST /api/auth/login */
router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required.');
  const cleanEmail = String(email).toLowerCase().trim();
  const user = await one('SELECT * FROM users WHERE email = ?', [cleanEmail]);
  if (!user) {
    // Not an account yet, but maybe a sign-up waiting for its code. Only say so
    // when the password matches, so this cannot be used to look up addresses.
    const pending = await one('SELECT password_hash, verify_expires FROM pending_signups WHERE email = ?', [cleanEmail]);
    if (pending && !isExpired(pending) && await bcrypt.compare(password, pending.password_hash)) {
      const err = new HttpError(403, 'Your account is not created yet. Enter the code we emailed you to finish signing up.');
      err.code = 'EMAIL_NOT_VERIFIED';
      throw err;
    }
    throw new HttpError(401, 'Incorrect email or password.');
  }
  if (!(await bcrypt.compare(password, user.password_hash))) throw new HttpError(401, 'Incorrect email or password.');
  if (!user.email_verified) {
    const err = new HttpError(403, 'Please verify your email before signing in.');
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

/* GET /api/auth/google/config  -> which Google client the frontend should use */
router.get('/google/config', (req, res) => res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null }));

/* POST /api/auth/google  { accessToken }
   The browser signs in with Google and sends us the access token. We check the
   token was issued for our client, read the Google profile, then sign the user
   in (creating the account on first use). Google has already verified the email. */
router.post('/google', wrap(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(503, 'Google sign-in is not set up yet.');
  const accessToken = String((req.body || {}).accessToken || '');
  if (!accessToken) throw new HttpError(400, 'Missing Google token.');

  const info = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken)).then(r => r.json());
  if (!info || info.error || info.aud !== clientId) throw new HttpError(401, 'Google sign-in could not be verified.');

  const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } }).then(r => r.json());
  const email = String(profile.email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(email) || !profile.email_verified) throw new HttpError(401, 'Your Google account has no verified email.');

  let user = await one('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    await query('DELETE FROM pending_signups WHERE email = ?', [email]);   // Google has verified this address for us
    const first = profile.given_name || (profile.name || email).split(' ')[0] || 'Guest';
    const last = profile.family_name || (profile.name || '').split(' ').slice(1).join(' ') || '-';
    const randomHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const result = await query(
      'INSERT INTO users (first_name, last_name, email, password_hash, email_verified) VALUES (?, ?, ?, ?, 1)',
      [first.slice(0, 60), last.slice(0, 60), email, randomHash]
    );
    user = await one('SELECT * FROM users WHERE id = ?', [result.insertId]);
  } else if (!user.email_verified) {
    await query('UPDATE users SET email_verified = 1, verify_token = NULL, verify_code = NULL, verify_expires = NULL WHERE id = ?', [user.id]);
    user.email_verified = 1;
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

/* GET /api/auth/me */
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

/* POST /api/auth/password  { current, next } */
router.post('/password', requireAuth, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  if (!next || next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters.');
  const row = await one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current || '', row.password_hash))) throw new HttpError(400, 'Current password is incorrect.');
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
