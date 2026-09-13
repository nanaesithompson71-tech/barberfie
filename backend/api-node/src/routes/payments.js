'use strict';
/* ==========================================================
   BARBERFIE - payments (Paystack)
   Flow: the dashboard creates a booking with paymentMethod
   "paystack", asks /start for a reference, opens the Paystack
   popup, then calls /verify. We confirm with Paystack's own
   API using the secret key before marking the booking paid.
   ========================================================== */
const router = require('express').Router();
const crypto = require('crypto');
const { query, one } = require('../db');
const { HttpError, wrap, requireAuth, publicBooking, BOOKING_SELECT } = require('../util');

const CURRENCY = () => process.env.CURRENCY || 'GHS';
const configured = () => !!(process.env.PAYSTACK_PUBLIC_KEY && process.env.PAYSTACK_SECRET_KEY);

/* GET /api/payments/config  -> what the browser needs to show the options */
router.get('/config', (req, res) => {
  res.json({ paystack: configured(), publicKey: configured() ? process.env.PAYSTACK_PUBLIC_KEY : null, currency: CURRENCY() });
});

/* POST /api/payments/paystack/start  { bookingId } -> reference + amount for the popup */
router.post('/paystack/start', requireAuth, wrap(async (req, res) => {
  if (!configured()) throw new HttpError(503, 'Card and mobile money payment is not set up yet. Please choose cash.');
  const booking = await one(`${BOOKING_SELECT} WHERE b.id = ?`, [Number((req.body || {}).bookingId)]);
  if (!booking) throw new HttpError(404, 'Booking not found.');
  if (booking.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Not your booking.');
  if (booking.payment_status === 'paid') throw new HttpError(400, 'This booking is already paid.');
  if (!['pending', 'confirmed'].includes(booking.status)) throw new HttpError(400, 'This booking can no longer be paid online.');

  const reference = `BF-${booking.id}-${crypto.randomBytes(6).toString('hex')}`;
  await query("UPDATE bookings SET payment_method = 'paystack', payment_reference = ? WHERE id = ?", [reference, booking.id]);
  res.json({
    reference,
    amount: Math.round(Number(booking.price) * 100),   // Paystack wants the smallest unit (pesewas)
    currency: CURRENCY(),
    email: req.user.email,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY
  });
}));

/* POST /api/payments/paystack/verify  { reference } -> checks with Paystack and marks the booking paid */
router.post('/paystack/verify', requireAuth, wrap(async (req, res) => {
  if (!configured()) throw new HttpError(503, 'Payments are not set up.');
  const reference = String((req.body || {}).reference || '');
  if (!/^BF-\d+-[a-f0-9]{12}$/.test(reference)) throw new HttpError(400, 'Invalid payment reference.');

  const booking = await one(`${BOOKING_SELECT} WHERE b.payment_reference = ?`, [reference]);
  if (!booking) throw new HttpError(404, 'No booking matches that payment.');
  if (booking.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Not your booking.');
  if (booking.payment_status === 'paid') return res.json({ paid: true, booking: publicBooking(booking) });

  let result;
  try {
    result = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
      headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY }
    }).then(r => r.json());
  } catch (err) {
    throw new HttpError(502, 'Could not reach Paystack to confirm the payment. Please try again.');
  }

  const tx = result && result.data;
  const expected = Math.round(Number(booking.price) * 100);
  if (!result || !result.status || !tx || tx.status !== 'success') {
    throw new HttpError(402, 'Paystack has not confirmed this payment yet.');
  }
  if (Number(tx.amount) < expected || String(tx.currency).toUpperCase() !== CURRENCY().toUpperCase()) {
    throw new HttpError(400, 'The amount paid does not match the booking price.');
  }

  await query("UPDATE bookings SET payment_status = 'paid', payment_method = 'paystack', status = IF(status = 'pending', 'confirmed', status) WHERE id = ?", [booking.id]);
  res.json({ paid: true, booking: publicBooking(await one(`${BOOKING_SELECT} WHERE b.id = ?`, [booking.id])) });
}));

/* PATCH /api/payments/:bookingId  { paymentStatus }  - admin marks cash as paid at the counter */
router.patch('/:bookingId', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admin access only.');
  const status = String((req.body || {}).paymentStatus || '');
  if (!['unpaid', 'paid', 'refunded'].includes(status)) throw new HttpError(400, 'Invalid payment status.');
  const booking = await one(`${BOOKING_SELECT} WHERE b.id = ?`, [Number(req.params.bookingId)]);
  if (!booking) throw new HttpError(404, 'Booking not found.');
  await query('UPDATE bookings SET payment_status = ? WHERE id = ?', [status, booking.id]);
  res.json(publicBooking(await one(`${BOOKING_SELECT} WHERE b.id = ?`, [booking.id])));
}));

module.exports = router;
