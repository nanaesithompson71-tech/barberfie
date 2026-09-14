-- ==========================================================
-- BARBERFIE - MySQL schema
-- Shared by the Node.js API, PHP endpoints, Django reports
-- and the C++ reminder worker.
-- Run:  mysql -u root -p < schema.sql
-- ==========================================================

CREATE DATABASE IF NOT EXISTS barberfie
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE barberfie;

-- Dedicated app user (change the password before going live)
CREATE USER IF NOT EXISTS 'barberfie'@'localhost' IDENTIFIED BY 'barberfie_dev_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON barberfie.* TO 'barberfie'@'localhost';
FLUSH PRIVILEGES;

-- ---------- Users (customers, barbers and admins share one table) ----------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  phone         VARCHAR(30)  NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  notes         TEXT NULL COMMENT 'Cut preferences shown to the barber',
  favourite_barber_id INT UNSIGNED NULL,
  pref_reminders TINYINT(1) NOT NULL DEFAULT 1,
  pref_promos    TINYINT(1) NOT NULL DEFAULT 0,
  pref_whatsapp  TINYINT(1) NOT NULL DEFAULT 1,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verify_token   VARCHAR(64) NULL,
  verify_expires DATETIME NULL,
  verify_code    VARCHAR(6) NULL COMMENT '6-digit code from the verification email',
  pending_key    VARCHAR(64) NULL COMMENT 'Lets the signup page detect verification from another device',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Pending sign-ups (waiting for email verification) ----------
-- A sign-up is stored here first. The row in `users` is only created once the
-- person types the emailed code or clicks the emailed link.
CREATE TABLE IF NOT EXISTS pending_signups (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name     VARCHAR(60)  NOT NULL,
  last_name      VARCHAR(60)  NOT NULL,
  email          VARCHAR(190) NOT NULL UNIQUE,
  phone          VARCHAR(30)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  verify_token   VARCHAR(64)  NOT NULL UNIQUE COMMENT 'Secret in the emailed link',
  verify_code    VARCHAR(6)   NULL COMMENT '6-digit code from the email; NULL once cancelled',
  verify_expires DATETIME     NOT NULL,
  pending_key    VARCHAR(64)  NOT NULL UNIQUE COMMENT 'Lets the signup page detect verification from another device',
  attempts       TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Wrong code guesses since the last code was sent',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Barbers ----------
CREATE TABLE IF NOT EXISTS barbers (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  bio          VARCHAR(255) NULL,
  working_days VARCHAR(20)  NOT NULL DEFAULT '1,2,3,4,5,6' COMMENT 'Comma list, 0=Sunday',
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE users
  ADD CONSTRAINT fk_users_fav_barber FOREIGN KEY (favourite_barber_id)
  REFERENCES barbers(id) ON DELETE SET NULL;

-- ---------- Services ----------
CREATE TABLE IF NOT EXISTS services (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120)  NOT NULL,
  price        DECIMAL(8,2)  NOT NULL,
  duration_min SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Bookings ----------
CREATE TABLE IF NOT EXISTS bookings (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  barber_id     INT UNSIGNED NULL,
  service_id    INT UNSIGNED NOT NULL,
  booking_date  DATE NOT NULL,
  booking_time  TIME NOT NULL,
  price         DECIMAL(8,2) NOT NULL COMMENT 'Price at time of booking',
  status        ENUM('pending','confirmed','completed','cancelled','no-show') NOT NULL DEFAULT 'confirmed',
  payment_method    ENUM('cash','paystack') NOT NULL DEFAULT 'cash',
  payment_status    ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  payment_reference VARCHAR(100) NULL COMMENT 'Paystack transaction reference',
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_bookings_barber  FOREIGN KEY (barber_id)  REFERENCES barbers(id)  ON DELETE SET NULL,
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_bookings_date (booking_date, booking_time),
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_status (status)
) ENGINE=InnoDB;

-- A barber can only hold one live booking per slot
CREATE UNIQUE INDEX uq_barber_slot
  ON bookings (barber_id, booking_date, booking_time, (CASE WHEN status IN ('pending','confirmed') THEN 1 ELSE NULL END));

-- ---------- Opening hours ----------
CREATE TABLE IF NOT EXISTS opening_hours (
  day_of_week TINYINT UNSIGNED PRIMARY KEY COMMENT '0=Sunday',
  opens       TIME NOT NULL,
  closes      TIME NOT NULL,
  is_open     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------- Shop settings (key/value) ----------
CREATE TABLE IF NOT EXISTS shop_settings (
  setting_key   VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- ---------- Contact form messages (written by PHP) ----------
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  message    TEXT NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Reminder log (written by the C++ worker) ----------
CREATE TABLE IF NOT EXISTS reminder_log (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL,
  channel    ENUM('sms','email','whatsapp') NOT NULL,
  sent_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminder_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Loyalty view: 1 point per GH₵ 1 on completed visits ----------
CREATE OR REPLACE VIEW v_loyalty AS
SELECT u.id AS user_id,
       COUNT(b.id)                 AS visits,
       COALESCE(SUM(b.price), 0)   AS total_spent,
       COALESCE(SUM(b.price), 0)   AS points,
       MAX(b.booking_date)         AS last_visit
FROM users u
LEFT JOIN bookings b ON b.user_id = u.id AND b.status = 'completed'
GROUP BY u.id;
