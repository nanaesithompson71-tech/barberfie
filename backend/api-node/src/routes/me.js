'use strict';
const router = require('express').Router();
const { query, one } = require('../db');
const { HttpError, wrap, requireAuth, EMAIL_RE, publicUser } = require('../util');

router.use(requireAuth);

const REWARDS = [
  { points: 300, name: 'Free beard trim' },
  { points: 600, name: 'Free classic haircut' },
  { points: 1000, name: 'Free cut & beard combo' }
];

/* GET /api/me  - profile + loyalty summary */
router.get('/', wrap(async (req, res) => {
  const loyalty = await one('SELECT * FROM v_loyalty WHERE user_id = ?', [req.user.id]);
  const history = await query(
    "SELECT b.id, b.booking_date AS date, b.price, s.name AS service FROM bookings b JOIN services s ON s.id = b.service_id WHERE b.user_id = ? AND b.status = 'completed' ORDER BY b.booking_date DESC",
    [req.user.id]
  );
  const points = loyalty ? loyalty.points : 0;
  res.json({
    user: publicUser(req.user),
    loyalty: {
      points, visits: loyalty ? loyalty.visits : 0, spent: loyalty ? loyalty.total_spent : 0,
      lastVisit: loyalty ? loyalty.last_visit : null,
      rewards: REWARDS.map(r => ({ ...r, unlocked: points >= r.points })),
      next: REWARDS.find(r => r.points > points) || null,
      history
    }
  });
}));

/* PATCH /api/me  { firstName, lastName, email, phone, notes, favouriteBarberId, prefs:{...} } */
router.patch('/', wrap(async (req, res) => {
  const u = req.user, b = req.body || {};
  if (b.email && !EMAIL_RE.test(b.email)) throw new HttpError(400, 'Enter a valid email.');
  if (b.email && b.email.toLowerCase() !== u.email) {
    const taken = await one('SELECT id FROM users WHERE email = ? AND id <> ?', [b.email.toLowerCase(), u.id]);
    if (taken) throw new HttpError(409, 'That email is already in use.');
  }
  const prefs = { reminders: u.pref_reminders, promos: u.pref_promos, whatsapp: u.pref_whatsapp, ...(b.prefs || {}) };
  await query(
    'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ?, favourite_barber_id = ?, pref_reminders = ?, pref_promos = ?, pref_whatsapp = ? WHERE id = ?',
    [
      b.firstName !== undefined ? String(b.firstName).trim() : u.first_name,
      b.lastName !== undefined ? String(b.lastName).trim() : u.last_name,
      b.email !== undefined ? b.email.toLowerCase().trim() : u.email,
      b.phone !== undefined ? b.phone : u.phone,
      b.notes !== undefined ? b.notes : u.notes,
      b.favouriteBarberId !== undefined ? (b.favouriteBarberId || null) : u.favourite_barber_id,
      prefs.reminders ? 1 : 0, prefs.promos ? 1 : 0, prefs.whatsapp ? 1 : 0,
      u.id
    ]
  );
  res.json({ user: publicUser(await one('SELECT * FROM users WHERE id = ?', [u.id])) });
}));

/* DELETE /api/me  - delete own account (bookings cascade) */
router.delete('/', wrap(async (req, res) => {
  if (req.user.role === 'admin') throw new HttpError(400, 'Admin accounts cannot be deleted from here.');
  await query('DELETE FROM users WHERE id = ?', [req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
