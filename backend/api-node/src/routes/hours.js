'use strict';
const router = require('express').Router();
const { query } = require('../db');
const { HttpError, wrap, requireAuth, requireAdmin, TIME_RE } = require('../util');

const shape = h => ({ day: h.day_of_week, opens: String(h.opens).slice(0, 5), closes: String(h.closes).slice(0, 5), open: !!h.is_open });

/* GET /api/hours */
router.get('/', wrap(async (req, res) => {
  res.json((await query('SELECT * FROM opening_hours ORDER BY day_of_week')).map(shape));
}));

/* PUT /api/hours (admin)  body: [{day, opens, closes, open}] */
router.put('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [];
  for (const h of list) {
    if (!(h.day >= 0 && h.day <= 6)) throw new HttpError(400, 'Day must be 0-6.');
    if (h.open && (!TIME_RE.test(h.opens) || !TIME_RE.test(h.closes))) throw new HttpError(400, 'Times must be HH:MM.');
    if (h.open && h.opens >= h.closes) throw new HttpError(400, 'Closing time must be after opening time.');
    await query(
      'INSERT INTO opening_hours (day_of_week, opens, closes, is_open) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE opens = VALUES(opens), closes = VALUES(closes), is_open = VALUES(is_open)',
      [h.day, h.opens || '00:00', h.closes || '00:00', h.open ? 1 : 0]
    );
  }
  res.json((await query('SELECT * FROM opening_hours ORDER BY day_of_week')).map(shape));
}));

module.exports = router;
