'use strict';
const router = require('express').Router();
const { query, one } = require('../db');
const { HttpError, wrap, requireAuth, requireAdmin } = require('../util');

const shape = s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration_min, active: !!s.active });

/* GET /api/services  (public: active only; admin with ?all=1: everything) */
router.get('/', wrap(async (req, res) => {
  const all = req.query.all === '1';
  const rows = await query(`SELECT * FROM services ${all ? '' : 'WHERE active = 1'} ORDER BY id`);
  res.json(rows.map(shape));
}));

/* POST /api/services  (admin) */
router.post('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { name, price, duration } = req.body || {};
  if (!name) throw new HttpError(400, 'Service name is required.');
  if (!(Number(price) >= 0)) throw new HttpError(400, 'Price must be zero or more.');
  const r = await query('INSERT INTO services (name, price, duration_min) VALUES (?, ?, ?)', [name.trim(), Number(price), Number(duration) || 30]);
  res.status(201).json(shape(await one('SELECT * FROM services WHERE id = ?', [r.insertId])));
}));

/* PATCH /api/services/:id  (admin) */
router.patch('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const s = await one('SELECT * FROM services WHERE id = ?', [req.params.id]);
  if (!s) throw new HttpError(404, 'Service not found.');
  const b = req.body || {};
  await query('UPDATE services SET name = ?, price = ?, duration_min = ?, active = ? WHERE id = ?', [
    b.name !== undefined ? String(b.name).trim() : s.name,
    b.price !== undefined ? Number(b.price) : s.price,
    b.duration !== undefined ? Number(b.duration) : s.duration_min,
    b.active !== undefined ? (b.active ? 1 : 0) : s.active,
    s.id
  ]);
  res.json(shape(await one('SELECT * FROM services WHERE id = ?', [s.id])));
}));

/* DELETE /api/services/:id  (admin) - soft delete if bookings reference it */
router.delete('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const used = await one('SELECT COUNT(*) AS n FROM bookings WHERE service_id = ?', [req.params.id]);
  if (used.n > 0) {
    await query('UPDATE services SET active = 0 WHERE id = ?', [req.params.id]);
    return res.json({ ok: true, hidden: true, message: 'Service has bookings, so it was hidden instead of deleted.' });
  }
  await query('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
