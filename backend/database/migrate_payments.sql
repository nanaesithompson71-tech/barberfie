-- Run once on an existing database to add booking payment tracking.
USE barberfie;
ALTER TABLE bookings
  ADD COLUMN payment_method    ENUM('cash','paystack') NOT NULL DEFAULT 'cash' AFTER status,
  ADD COLUMN payment_status    ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid' AFTER payment_method,
  ADD COLUMN payment_reference VARCHAR(100) NULL AFTER payment_status;
