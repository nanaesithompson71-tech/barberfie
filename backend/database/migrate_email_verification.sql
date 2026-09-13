-- Run this once on an existing database to add email verification.
-- Existing accounts are marked verified so nobody gets locked out.
USE barberfie;
ALTER TABLE users
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER pref_whatsapp,
  ADD COLUMN verify_token   VARCHAR(64) NULL AFTER email_verified,
  ADD COLUMN verify_expires DATETIME NULL AFTER verify_token;
UPDATE users SET email_verified = 1;
ALTER TABLE users ADD COLUMN pending_key VARCHAR(64) NULL AFTER verify_expires;
ALTER TABLE users ADD COLUMN verify_code VARCHAR(6) NULL AFTER verify_expires;
