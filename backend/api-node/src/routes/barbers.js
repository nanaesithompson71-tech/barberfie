'use strict';
const router = require('express').Router();
const { query, one } = require('../db');
const { HttpError, wrap, requireAuth, requireAdmin } = require('../util');

const shape = b => ({
  id: b.id, name: b.name, bio: b.bio, active: !!b.active,
  days: String(b.working_days || '').split(',').filter(Boolean).map(Number)
});

/* GET /api/barbers */
router.get('/', wrap(async (req, res) => {
  const all = req.query.all === '1';
  res.json((await query(`SELECT * FROM barbers ${all ? '' : 'WHERE active = 1'} ORDER BY id`)).map(shape));
}));

/* POST /api/barbers (admin) */
router.post('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { name, bio, days } = req.body || {};
  if (!name) throw new HttpError(400, 'Name is required.');
  const dayList = Array.isArray(days) ? days.map(Number).filter(d => d >= 0 && d <= 6).join(',') : '1,2,3,4,5,6';
  const r = await query('INSERT INTO barbers (name, bio, working_days) VALUES (?, ?, ?)', [name.trim(), bio || null, dayList]);
  res.status(201).json(shape(await one('SELECT * FROM barbers WHERE id = ?', [r.insertId])));
}));

/* PATCH /api/barbers/:id (admin) */
router.patch('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const b = await one('SELECT * FROM barbers WHERE id = ?', [req.params.id]);
  if (!b) throw new HttpError(404, 'Barber not found.');
  const body = req.body || {};
  await query('UPDATE barbers SET name = ?, bio = ?, working_days = ?, active = ? WHERE id = ?', [
    body.name !== undefined ? String(body.name).trim() : b.name,
    body.bio !== undefined ? body.bio : b.bio,
    Array.isArray(body.days) ? body.days.map(Number).join(',') : b.working_days,
    body.active !== undefined ? (body.active ? 1 : 0) : b.active,
    b.id
  ]);
  res.json(shape(await one('SELECT * FROM barbers WHERE id = ?', [b.id])));
}));

/* DELETE /api/barbers/:id (admin) - upcoming bookings keep their record with barber set to NULL */
router.delete('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const upcoming = await one(
    "SELECT COUNT(*) AS n FROM bookings WHERE barber_id = ? AND booking_date >= CURDATE() AND status IN ('pending','confirmed')",
    [req.params.id]
  );
  await query('DELETE FROM barbers WHERE id = ?', [req.params.id]);
  res.json({ ok: true, unassignedBookings: upcoming.n });
}));

module.exports = router;
