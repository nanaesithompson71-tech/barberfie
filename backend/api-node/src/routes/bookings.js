'use strict';
const router = require('express').Router();
const { query, one } = require('../db');
const { HttpError, wrap, requireAuth, requireAdmin, DATE_RE, TIME_RE, publicBooking, BOOKING_SELECT } = require('../util');

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];

/** Hourly slots between the shop's opening and closing time on a given date. */
async function slotsFor(date) {
  const dow = new Date(date + 'T00:00:00').getDay();
  const h = await one('SELECT * FROM opening_hours WHERE day_of_week = ?', [dow]);
  if (!h || !h.is_open) return [];
  const step = Number((await one("SELECT setting_value FROM shop_settings WHERE setting_key = 'slot_minutes'") || {}).setting_value) || 60;
  const toMin = t => { const [hh, mm] = String(t).split(':').map(Number); return hh * 60 + mm; };
  const out = [];
  for (let m = toMin(h.opens); m + step <= toMin(h.closes); m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/* GET /api/bookings/availability?date=YYYY-MM-DD&barberId=1 */
router.get('/availability', wrap(async (req, res) => {
  const { date, barberId } = req.query;
  if (!DATE_RE.test(date || '')) throw new HttpError(400, 'date must be YYYY-MM-DD.');
  const slots = await slotsFor(date);
  const params = [date];
  let where = "booking_date = ? AND status IN ('pending','confirmed')";
  if (barberId) { where += ' AND barber_id = ?'; params.push(barberId); }
  const taken = (await query(`SELECT TIME_FORMAT(booking_time, '%H:%i') AS t FROM bookings WHERE ${where}`, params)).map(r => r.t);
  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  res.json(slots.map(t => ({
    time: t,
    available: !taken.includes(t) && !(isToday && Number(t.slice(0, 2)) <= now.getHours())
  })));
}));

/* GET /api/bookings  - own bookings; admins see all with filters */
router.get('/', requireAuth, wrap(async (req, res) => {
  const where = [], params = [];
  if (req.user.role !== 'admin') { where.push('b.user_id = ?'); params.push(req.user.id); }
  else if (req.query.userId) { where.push('b.user_id = ?'); params.push(req.query.userId); }
  if (req.query.status && STATUSES.includes(req.query.status)) { where.push('b.status = ?'); params.push(req.query.status); }
  if (req.query.barberId) { where.push('b.barber_id = ?'); params.push(req.query.barberId); }
  if (req.query.from && DATE_RE.test(req.query.from)) { where.push('b.booking_date >= ?'); params.push(req.query.from); }
  if (req.query.to && DATE_RE.test(req.query.to)) { where.push('b.booking_date <= ?'); params.push(req.query.to); }
  if (req.query.q) {
    where.push("(CONCAT(u.first_name,' ',u.last_name) LIKE ? OR s.name LIKE ? OR br.name LIKE ?)");
    const like = `%${req.query.q}%`; params.push(like, like, like);
  }
  const sql = `${BOOKING_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT 500`;
  res.json((await query(sql, params)).map(publicBooking));
}));

/* POST /api/bookings  { serviceId, barberId, date, time, userId? (admin), status? (admin) } */
router.post('/', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const isAdmin = req.user.role === 'admin';
  const userId = isAdmin && b.userId ? Number(b.userId) : req.user.id;

  if (!isAdmin) {
    const online = await one("SELECT setting_value FROM shop_settings WHERE setting_key = 'online_booking'");
    if (online && online.setting_value === '0') throw new HttpError(503, 'Online booking is paused. Please call the shop.');
  }
  if (!DATE_RE.test(b.date || '')) throw new HttpError(400, 'Choose a valid date.');
  if (!TIME_RE.test(b.time || '')) throw new HttpError(400, 'Choose a valid time.');
  if (b.date < new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'That date has already passed.');

  const service = await one('SELECT * FROM services WHERE id = ? AND active = 1', [b.serviceId]);
  if (!service) throw new HttpError(400, 'Choose a valid service.');
  const barber = b.barberId ? await one('SELECT * FROM barbers WHERE id = ? AND active = 1', [b.barberId]) : null;
  if (b.barberId && !barber) throw new HttpError(400, 'That barber is not available.');

  const slots = await slotsFor(b.date);
  const time = b.time.slice(0, 5);
  if (!slots.includes(time)) throw new HttpError(400, 'The shop is closed at that time.');
  if (barber && !String(barber.working_days).split(',').map(Number).includes(new Date(b.date + 'T00:00:00').getDay())) {
    throw new HttpError(400, `${barber.name} does not work on that day.`);
  }
  if (barber) {
    const clash = await one("SELECT id FROM bookings WHERE barber_id = ? AND booking_date = ? AND booking_time = ? AND status IN ('pending','confirmed')", [barber.id, b.date, time]);
    if (clash) throw new HttpError(409, 'That slot was just taken. Pick another time.');
  }

  const auto = await one("SELECT setting_value FROM shop_settings WHERE setting_key = 'auto_confirm'");
  let status = auto && auto.setting_value === '0' ? 'pending' : 'confirmed';
  if (isAdmin && STATUSES.includes(b.status)) status = b.status;

  const paymentMethod = b.paymentMethod === 'paystack' ? 'paystack' : 'cash';
  const r = await query(
    'INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, price, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, barber ? barber.id : null, service.id, b.date, time, service.price, status, paymentMethod]
  );
  res.status(201).json(publicBooking(await one(`${BOOKING_SELECT} WHERE b.id = ?`, [r.insertId])));
}));

/* PATCH /api/bookings/:id  - customers may reschedule/cancel their own; admins may change anything */
router.patch('/:id', requireAuth, wrap(async (req, res) => {
  const cur = await one(`${BOOKING_SELECT} WHERE b.id = ?`, [req.params.id]);
  if (!cur) throw new HttpError(404, 'Booking not found.');
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && cur.user_id !== req.user.id) throw new HttpError(403, 'Not your booking.');

  const b = req.body || {};
  const next = {
    date: b.date !== undefined ? b.date : cur.booking_date,
    time: b.time !== undefined ? String(b.time).slice(0, 5) : String(cur.booking_time).slice(0, 5),
    barberId: b.barberId !== undefined ? (b.barberId || null) : cur.barber_id,
    serviceId: b.serviceId !== undefined ? b.serviceId : cur.service_id,
    status: b.status !== undefined ? b.status : cur.status,
    price: cur.price
  };

  if (!isAdmin) {
    // Customers can only reschedule or cancel a live booking
    if (!['pending', 'confirmed'].includes(cur.status)) throw new HttpError(400, 'This booking can no longer be changed.');
    if (b.status && b.status !== 'cancelled') throw new HttpError(403, 'You can only cancel a booking.');
    if (b.serviceId !== undefined || b.barberId !== undefined) throw new HttpError(403, 'Cancel and rebook to change the service or barber.');
  }
  if (!STATUSES.includes(next.status)) throw new HttpError(400, 'Invalid status.');
  if (!DATE_RE.test(next.date) || !TIME_RE.test(next.time)) throw new HttpError(400, 'Invalid date or time.');

  if (next.serviceId !== cur.service_id) {
    const s = await one('SELECT * FROM services WHERE id = ?', [next.serviceId]);
    if (!s) throw new HttpError(400, 'Invalid service.');
    next.price = s.price;
  }
  if (['pending', 'confirmed'].includes(next.status) && next.barberId) {
    const clash = await one(
      "SELECT id FROM bookings WHERE id <> ? AND barber_id = ? AND booking_date = ? AND booking_time = ? AND status IN ('pending','confirmed')",
      [cur.id, next.barberId, next.date, next.time]
    );
    if (clash) throw new HttpError(409, 'That barber already has a booking at that time.');
  }

  await query(
    'UPDATE bookings SET booking_date = ?, booking_time = ?, barber_id = ?, service_id = ?, status = ?, price = ? WHERE id = ?',
    [next.date, next.time, next.barberId, next.serviceId, next.status, next.price, cur.id]
  );
  res.json(publicBooking(await one(`${BOOKING_SELECT} WHERE b.id = ?`, [cur.id])));
}));

/* DELETE /api/bookings/:id (admin) */
router.delete('/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  await query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
