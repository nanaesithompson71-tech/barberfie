-- ==========================================================
-- BARBERFIE - sample data
-- Run after schema.sql:  mysql -u root -p barberfie < seed.sql
-- Passwords for every seeded user are:  Password123
-- (bcrypt hash generated with cost 10)
-- ==========================================================
USE barberfie;

INSERT INTO barbers (id, name, bio, working_days) VALUES
  (1, 'Daniel Asante', 'Fades and beard specialist. 6 years at the chair.', '1,2,3,4,5,6'),
  (2, 'Yaw Boateng',   'Classic cuts and scissor work. Great with kids.',   '0,1,2,3,5,6'),
  (3, 'Kofi Owusu',    'Hot towel shaves and line-ups.',                    '2,3,4,5,6')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO services (id, name, price, duration_min) VALUES
  (1, 'Classic Haircut',      40, 30),
  (2, 'Skin Fade',            50, 45),
  (3, 'Beard Trim & Shape',   25, 20),
  (4, 'Hot Towel Shave',      35, 30),
  (5, 'Kids Cut (under 12)',  30, 25),
  (6, 'Cut & Beard Combo',    60, 60)
ON DUPLICATE KEY UPDATE price = VALUES(price);

INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, favourite_barber_id, notes, email_verified) VALUES
  (1, 'Ama',   'Boakye', 'admin@barberfie.com', '+233 00 000 0000', '$2a$10$/IgCSBgHc3ZxgseaAtTmUeP4l9W.zk0.ZiXfwnViVQn4VwEOthMkm', 'admin', NULL, NULL, 1),
  (2, 'Kwame', 'Mensah', 'kwame@example.com',   '+233 24 000 0001', '$2a$10$/IgCSBgHc3ZxgseaAtTmUeP4l9W.zk0.ZiXfwnViVQn4VwEOthMkm', 'customer', 1, 'Number 2 on the sides.', 1),
  (3, 'Nana',  'Osei',   'nana@example.com',    '+233 24 000 0002', '$2a$10$/IgCSBgHc3ZxgseaAtTmUeP4l9W.zk0.ZiXfwnViVQn4VwEOthMkm', 'customer', 2, NULL, 1),
  (4, 'Kojo',  'Appiah', 'kojo@example.com',    '+233 24 000 0003', '$2a$10$/IgCSBgHc3ZxgseaAtTmUeP4l9W.zk0.ZiXfwnViVQn4VwEOthMkm', 'customer', 3, 'Sensitive skin - warm towel only.', 1)
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO opening_hours (day_of_week, opens, closes, is_open) VALUES
  (0, '12:00', '18:00', 1),
  (1, '08:00', '20:00', 1),
  (2, '08:00', '20:00', 1),
  (3, '08:00', '20:00', 1),
  (4, '08:00', '20:00', 1),
  (5, '08:00', '20:00', 1),
  (6, '08:00', '21:00', 1)
ON DUPLICATE KEY UPDATE opens = VALUES(opens), closes = VALUES(closes);

INSERT INTO shop_settings (setting_key, setting_value) VALUES
  ('shop_name',    'BARBERFIE'),
  ('shop_phone',   '+233 00 000 0000'),
  ('shop_email',   'hello@barberfie.com'),
  ('shop_address', '12 High Street, Accra'),
  ('online_booking', '1'),
  ('auto_confirm',   '1'),
  ('send_reminders', '1'),
  ('slot_minutes',   '60')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Bookings relative to today so the dashboards have something to show
INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, price, status) VALUES
  (2, 1, 2, CURDATE() + INTERVAL 3 DAY,  '10:00', 50, 'confirmed'),
  (3, 2, 1, CURDATE() + INTERVAL 1 DAY,  '14:00', 40, 'confirmed'),
  (4, 3, 4, CURDATE(),                   '11:00', 35, 'confirmed'),
  (2, 1, 6, CURDATE() - INTERVAL 12 DAY, '14:00', 60, 'completed'),
  (2, 2, 1, CURDATE() - INTERVAL 40 DAY, '11:00', 40, 'completed'),
  (2, 3, 4, CURDATE() - INTERVAL 70 DAY, '16:00', 35, 'completed'),
  (3, 1, 2, CURDATE() - INTERVAL 2 DAY,  '09:00', 50, 'completed'),
  (4, 1, 3, CURDATE() - INTERVAL 5 DAY,  '15:00', 25, 'completed'),
  (3, 2, 5, CURDATE() - INTERVAL 1 DAY,  '10:00', 30, 'no-show');
