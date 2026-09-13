'use strict';
const router = require('express').Router();
const { query } = require('../db');
const { wrap, requireAuth, requireAdmin } = require('../util');

const PUBLIC_KEYS = ['shop_name', 'shop_phone', 'shop_email', 'shop_address', 'online_booking'];
const ADMIN_KEYS = [...PUBLIC_KEYS, 'auto_confirm', 'send_reminders', 'slot_minutes'];

async function read(keys) {
  const rows = await query(`SELECT * FROM shop_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`, keys);
  const out = {};
  rows.forEach(r => { out[r.setting_key] = r.setting_value; });
  return out;
}

/* GET /api/settings  - public keys for everyone, all keys for admins */
router.get('/', wrap(async (req, res) => {
  const header = req.headers.authorization || '';
  if (!header) return res.json(await read(PUBLIC_KEYS));
  requireAuth(req, res, async err => {
    if (err) return res.json(await read(PUBLIC_KEYS));
    res.json(await read(req.user.role === 'admin' ? ADMIN_KEYS : PUBLIC_KEYS));
  });
}));

/* PUT /api/settings (admin)  body: { shop_name: '...', auto_confirm: '0', ... } */
router.put('/', requireAuth, requireAdmin, wrap(async (req, res) => {
  const body = req.body || {};
  for (const key of Object.keys(body)) {
    if (!ADMIN_KEYS.includes(key)) continue;
    await query(
      'INSERT INTO shop_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, String(body[key])]
    );
  }
  res.json(await read(ADMIN_KEYS));
}));

module.exports = router;
