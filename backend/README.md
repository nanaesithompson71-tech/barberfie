# BARBERFIE backend

One MySQL database, four services, each with a clear job.

| Part | Folder | Job | Default port |
|------|--------|-----|--------------|
| MySQL | `database/` | Single source of truth: users, barbers, services, bookings, hours, settings, contact messages, reminder log | 3306 |
| Node.js (Express) | `api-node/` | Main REST API used by the login, signup, user dashboard and admin dashboard pages | 4000 |
| PHP | `php/` | Public, no-login endpoints for the homepage: opening hours, services, slot availability, contact form | 8080 |
| Django | `django/` | Reports/analytics API for the admin dashboard, plus Django admin for direct database management | 8000 |
| C++ | `cpp/` | Background worker that sends appointment reminders 24 hours ahead | none |

All four services read the same `backend/.env` file.

## 1. Database

Install MySQL 8, then:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p barberfie < database/seed.sql
```

Seeded accounts (password for all of them is `Password123`):

| Email | Role |
|-------|------|
| admin@barberfie.com | admin |
| kwame@example.com | customer |
| nana@example.com | customer |
| kojo@example.com | customer |

Copy `.env.example` to `.env` and set `DB_PASSWORD` to match the user created in `schema.sql`. Change `JWT_SECRET` to a long random string.

## 2. Node.js API

```bash
cd api-node
npm install
npm start          # or: npm run dev  (auto-restarts on change)
```

Health check: `GET http://localhost:4000/api/health`

Main routes (all JSON, auth via `Authorization: Bearer <token>`):

| Method | Route | Who | Purpose |
|--------|-------|-----|---------|
| POST | `/api/auth/register` | public | Store the sign-up as *pending* and email a 6-digit code + link. No `users` row yet |
| GET | `/api/auth/verify?token=` | public | Emailed link: creates the account and returns a token |
| POST | `/api/auth/verify-code` | public | Typed code `{ email, code }`: creates the account and returns a token |
| GET | `/api/auth/pending?key=` | public | Polled by the signup page; returns a token once the email is verified |
| POST | `/api/auth/resend` | public | Send a fresh code and link to a pending sign-up |
| GET / POST | `/api/auth/google/config`, `/api/auth/google` | public | Google sign-in: client id for the browser, then exchange a Google access token for our token |
| POST | `/api/auth/login` | public | Sign in, returns token (403 `EMAIL_NOT_VERIFIED` while the sign-up is still pending) |
| GET | `/api/auth/me` | user | Current user |
| POST | `/api/auth/password` | user | Change password |
| GET / PATCH / DELETE | `/api/me` | user | Profile, preferences, loyalty summary, delete account |
| GET | `/api/services`, `/api/barbers`, `/api/hours` | public | Catalogue data |
| POST / PATCH / DELETE | `/api/services/:id`, `/api/barbers/:id` | admin | Manage catalogue |
| PUT | `/api/hours` | admin | Save opening hours |
| GET | `/api/bookings/availability?date=&barberId=` | public | Free slots |
| GET / POST | `/api/bookings` | user | Own bookings; admins see all with `?status=&barberId=&from=&to=&q=` |
| PATCH | `/api/bookings/:id` | user | Customers reschedule or cancel; admins change anything |
| DELETE | `/api/bookings/:id` | admin | Remove a booking |
| GET / POST / PATCH / DELETE | `/api/customers` | admin | Customer records |
| GET | `/api/payments/config` | public | Whether Paystack is enabled, public key, currency |
| POST | `/api/payments/paystack/start`, `/api/payments/paystack/verify` | user | Get a reference for the Paystack popup, then confirm the payment server-side |
| PATCH | `/api/payments/:bookingId` | admin | Mark a cash booking paid or refunded |
| GET / PUT | `/api/settings` | public / admin | Shop details and booking rules |

### Email verification

A sign-up is **not** stored as an account until the email is verified. `POST /api/auth/register` writes the details (with the hashed password) to `pending_signups` and emails a 6-digit code plus a link. The row in `users` is created only when the person types the code on the signup/login page (`/api/auth/verify-code`) or clicks the link (`/api/auth/verify`, which opens `auth/verify.html`). Set `APP_URL` in `.env` to wherever the site is served (default `http://localhost:5500`). Codes and links expire after 24 hours; five wrong code guesses cancel the code until a new one is requested; signing up again with the same address replaces the earlier pending sign-up.

- **Development:** leave `SMTP_HOST` empty and the email, including the link, is printed in the API console instead of being sent.
- **Production:** fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`. Any SMTP provider works (Gmail with an app password, Brevo, Mailgun, SendGrid, etc.).
- **Existing database:** run `database/migrate_email_verification.sql` once (adds the columns and marks current accounts as verified), then `database/migrate_pending_signups.sql` (creates the `pending_signups` table).

### Google sign-in

1. In Google Cloud Console (APIs & Services > Credentials) create an **OAuth client ID** of type **Web application**.
2. Add `http://localhost:5500` (and your real domain later) under **Authorised JavaScript origins**.
3. Paste the client ID into `GOOGLE_CLIENT_ID` in `.env` and restart the API.

Accounts created through Google are marked verified automatically and get a random password; users can set their own from the dashboard.

### Payments

When confirming a booking the customer chooses **cash at the shop** or **Pay now with Paystack** (card or mobile money). Cash bookings are created as `unpaid`; an admin can mark them paid via the payments route. Paystack bookings open the Paystack popup; after payment the API verifies the transaction with Paystack's own servers, checks the amount and currency, and marks the booking `paid`. If the customer closes the popup the booking is kept and shows a "Pay now" button in their dashboard.

To enable Paystack, paste the keys from https://dashboard.paystack.com/#/settings/developers into `.env` (`PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`) and restart the API. Test keys (`pk_test_...`, `sk_test_...`) let you try it with Paystack's test cards without real money. Until keys are set, the Paystack option is greyed out and only cash is offered. Existing databases need `database/migrate_payments.sql` once.

Rules enforced server side: no bookings in the past or outside opening hours, no double-booking a barber, barbers only on their working days, online booking can be paused, and bookings become `pending` when auto-confirm is off.

## 3. PHP public endpoints

Install PHP 8.1+ with the `pdo_mysql` extension, then either drop the `php/` folder into Apache/XAMPP `htdocs` or run the built-in server:

```bash
cd php
php -S localhost:8080
```

| Endpoint | Purpose |
|----------|---------|
| `GET /hours.php` | Opening hours and whether the shop is open right now |
| `GET /services.php` | Active services and barbers |
| `GET /availability.php?date=YYYY-MM-DD&barber_id=1` | Free time slots |
| `POST /contact.php` | Contact form. Body: `{name, email, message}`. Has a honeypot field and a rate limit |

## 4. Django reports

```bash
cd django
python -m pip install -r requirements.txt
python manage.py migrate            # creates Django's own auth/session tables in the same DB
python manage.py createsuperuser    # login for the Django admin site
python manage.py runserver 8000
```

Django admin: `http://localhost:8000/admin/`. The barbershop tables are mapped with `managed=False`, so Django reads and edits them but never changes their structure.

Report endpoints accept the same admin JWT the Node API issues, or a logged-in Django superuser session:

| Endpoint | Purpose |
|----------|---------|
| `GET /reports/summary/` | Today, week, month revenue and visits, pending count, no-shows |
| `GET /reports/revenue/?days=30` | Revenue and visits per day |
| `GET /reports/services/?days=90` | Bookings and revenue per service |
| `GET /reports/barbers/?days=30` | Per-barber completed, no-show, cancelled, revenue |
| `GET /reports/customers/top/?limit=10` | Best customers by spend |
| `GET /reports/retention/` | New versus returning visits per month |
| `GET /reports/export/bookings.csv?from=&to=` | CSV download |

## 5. C++ reminder worker

Needs the MySQL client library (`libmysqlclient-dev` on Debian/Ubuntu, `brew install mysql-client` on macOS, or MySQL Server with Connector/C on Windows).

```bash
cd cpp
# Linux / macOS
make && ./reminder_worker
# Any platform with CMake
cmake -B build -DMYSQL_DIR="C:/Program Files/MySQL/MySQL Server 8.0" && cmake --build build
./build/reminder_worker --once      # single pass, good for cron / Task Scheduler
```

Every `REMINDER_INTERVAL_SECONDS` it finds confirmed bookings starting within `REMINDER_HOURS_AHEAD` hours that have not been reminded, prints the reminder (replace `send_reminder()` with your SMS, email or WhatsApp provider), marks `reminder_sent`, and logs to `reminder_log`. It respects the customer's reminder preference and the admin "Send reminders" switch.

## Frontend wiring

`assets/api.js` is the shared browser client. The login and signup pages already use it: sign-in stores a JWT and sends admins to the admin dashboard and customers to the user dashboard. The two dashboards currently still render local demo data; every call they need is available on `BarberfieAPI` (for example `BarberfieAPI.bookings()`, `BarberfieAPI.createBooking()`, `BarberfieAPI.customers()`, `BarberfieAPI.report('/summary/')`).

Serve the frontend from a local server (for example VS Code Live Server on port 5500) so the browser origin matches `CORS_ORIGIN` in `.env`.

## Verified in this environment

- Node API: all route files load and pass a syntax check. `npm install` succeeded.
- Django: `manage.py check` reports no issues.
- C++: compiles cleanly with `-Wall -Wextra` against the MySQL header.
- PHP and MySQL are not installed on this machine, so the PHP files and the SQL scripts were reviewed but not executed.
