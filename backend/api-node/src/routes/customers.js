'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, one } = require('../db');
const { HttpError, wrap, requireAuth, requireAdmin, EMAIL_RE, publicUser } = require('../util');

router.use(requireAuth, requireAdmin);

/* GET /api/customers?q= */
router.get('/', wrap(async (req, res) => {
  const params = [];
  let where = "u.role = 'customer'";
  if (req.query.q) {
    where += " AND (CONCAT(u.first_name,' ',u.last_name) LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
    const like = `%${req.query.q}%`; params.push(like, like, like);
  }
  const rows = await query(
    `SELECT u.*, l.visits, l.total_spent, l.points, l.last_visit
     FROM users u LEFT JOIN v_loyalty l ON l.user_id = u.id
     WHERE ${where} ORDER BY u.first_name, u.last_name LIMIT 1000`, params
  );
  res.json(rows.map(u => ({ ...publicUser(u), visits: u.visits || 0, spent: u.total_spent || 0, points: u.points || 0, lastVisit: u.last_visit })));
}));

/* POST /api/customers  - admin creates a walk-in customer; a random password is set */
router.post('/', wrap(async (req, res) => {
  const { firstName, lastName, email, phone, notes } = req.body || {};
  if (!firstName || !lastName) throw new HttpError(400, 'First and last name are required.');
  if (!email && !phone) throw new HttpError(400, 'Add an email or a phone number.');
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email.');
  const finalEmail = email ? email.toLowerCase().trim() : `walkin-${Date.now()}@barberfie.local`;
  const hash = await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10);
  const r = await query(
    'INSERT INTO users (first_name, last_name, email, phone, password_hash, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [firstName.trim(), lastName.trim(), finalEmail, phone || null, hash, notes || null]
  );
  res.status(201).json(publicUser(await one('SELECT * FROM users WHERE id = ?', [r.insertId])));
}));

/* PATCH /api/customers/:id */
router.patch('/:id', wrap(async (req, res) => {
  const u = await one("SELECT * FROM users WHERE id = ? AND role = 'customer'", [req.params.id]);
  if (!u) throw new HttpError(404, 'Customer not found.');
  const b = req.body || {};
  if (b.email && !EMAIL_RE.test(b.email)) throw new HttpError(400, 'Enter a valid email.');
  await query('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?', [
    b.firstName !== undefined ? b.firstName.trim() : u.first_name,
    b.lastName !== undefined ? b.lastName.trim() : u.last_name,
    b.email !== undefined ? b.email.toLowerCase().trim() : u.email,
    b.phone !== undefined ? b.phone : u.phone,
    b.notes !== undefined ? b.notes : u.notes,
    u.id
  ]);
  res.json(publicUser(await one('SELECT * FROM users WHERE id = ?', [u.id])));
}));

/* DELETE /api/customers/:id  - bookings cascade */
router.delete('/:id', wrap(async (req, res) => {
  await query("DELETE FROM users WHERE id = ? AND role = 'customer'", [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
