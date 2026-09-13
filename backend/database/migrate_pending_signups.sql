-- Run this once on an existing database.
-- Sign-ups now wait here until the email is verified; only then is a row
-- created in `users`. Nothing in `users` changes.
USE barberfie;
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

-- Optional: accounts created by the old flow that never verified were only
-- placeholders (they could not sign in). Uncomment to remove them.
-- DELETE FROM users WHERE email_verified = 0 AND role = 'customer' AND verify_token IS NOT NULL;
