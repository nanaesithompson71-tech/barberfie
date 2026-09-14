/* ==========================================================
   BARBERFIE - main REST API
   Express + MySQL. Serves auth, bookings, customers,
   barbers, services, hours and settings to the frontend.
   ========================================================== */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// Strip stray spaces/line breaks that sneak into values pasted into hosting dashboards
for (const k of Object.keys(process.env)) if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();

const express = require('express');
const cors = require('cors');

const app = express();
app.set('trust proxy', true);   // behind a tunnel/proxy: use the public https address in links

const origins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'barberfie-api', time: new Date().toISOString() }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/services', require('./src/routes/services'));
app.use('/api/barbers', require('./src/routes/barbers'));
app.use('/api/hours', require('./src/routes/hours'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/me', require('./src/routes/me'));
app.use('/api/payments', require('./src/routes/payments'));

/* Serve the website itself so one address (and one tunnel) covers pages + API.
   Only the public folders are exposed; backend/ (with .env) is never served. */
const path = require('path');
const site = path.join(__dirname, '..', '..');
['landingpage.hmtl', 'auth', 'dashboard', 'admin', 'assets'].forEach(dir => {
  app.use('/' + dir, express.static(path.join(site, dir)));
});
app.get('/', (req, res) => res.sendFile(path.join(site, 'index.html')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).send('Not found');
});

// Central error handler: never leak stack traces to the client
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That record already exists.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const port = Number(process.env.PORT) || Number(process.env.API_PORT) || 4000;   // hosts like Railway set PORT

// Create the tables on first run (empty database), then start listening.
require('./src/bootstrap').bootstrap()
  .catch(err => console.error('[db] Setup failed:', err.message))
  .then(() => app.listen(port, () => console.log(`BARBERFIE API listening on http://localhost:${port}`)));
