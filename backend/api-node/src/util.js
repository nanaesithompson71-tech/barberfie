'use strict';
const jwt = require('jsonwebtoken');
const { one } = require('./db');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Wrap async route handlers so thrown errors reach the error middleware. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:\d{2})?$/;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.first_name },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

/** Require a valid Bearer token. Attaches req.user. */
const requireAuth = wrap(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Sign in required.');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'); }
  catch { throw new HttpError(401, 'Session expired. Please sign in again.'); }
  const user = await one('SELECT id, first_name, last_name, email, phone, role, notes, favourite_barber_id, pref_reminders, pref_promos, pref_whatsapp, created_at FROM users WHERE id = ?', [payload.sub]);
  if (!user) throw new HttpError(401, 'Account not found.');
  req.user = user;
  next();
});

/** Require admin role. Use after requireAuth. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new HttpError(403, 'Admin access only.'));
  next();
}

/** Strip a user row down to what the client should see. */
function publicUser(u) {
  return {
    id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, phone: u.phone,
    role: u.role, notes: u.notes, favouriteBarberId: u.favourite_barber_id,
    prefs: { reminders: !!u.pref_reminders, promos: !!u.pref_promos, whatsapp: !!u.pref_whatsapp },
    since: u.created_at
  };
}

/** Shape a booking row (joined with names) for the client. */
function publicBooking(b) {
  return {
    id: b.id, userId: b.user_id, customer: b.customer_name, barberId: b.barber_id, barber: b.barber_name,
    serviceId: b.service_id, service: b.service_name, date: b.booking_date, time: String(b.booking_time).slice(0, 5),
    price: b.price, status: b.status, reminderSent: !!b.reminder_sent, createdAt: b.created_at,
    paymentMethod: b.payment_method || 'cash', paymentStatus: b.payment_status || 'unpaid', paymentReference: b.payment_reference || null
  };
}

const BOOKING_SELECT = `
  SELECT b.*, CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
         br.name AS barber_name, s.name AS service_name
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  LEFT JOIN barbers br ON br.id = b.barber_id
  JOIN services s ON s.id = b.service_id`;

module.exports = { HttpError, wrap, EMAIL_RE, DATE_RE, TIME_RE, signToken, requireAuth, requireAdmin, publicUser, publicBooking, BOOKING_SELECT };
