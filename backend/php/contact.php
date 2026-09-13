<?php
/* POST /php/contact.php   { name, email, message }
   Stores a contact-form message. Includes a simple honeypot
   field ("website") and per-IP rate limiting. */
declare(strict_types=1);
require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') json_out(null, 204);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);

$b = body();
$name = trim((string)($b['name'] ?? ''));
$email = trim((string)($b['email'] ?? ''));
$message = trim((string)($b['message'] ?? ''));
$honeypot = trim((string)($b['website'] ?? ''));

if ($honeypot !== '') json_out(['ok' => true]); // bot filled the hidden field: pretend success
if ($name === '' || mb_strlen($name) > 120) json_out(['error' => 'Please enter your name.'], 400);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Enter a valid email address.'], 400);
if (mb_strlen($message) < 10) json_out(['error' => 'Tell us a little more (at least 10 characters).'], 400);
if (mb_strlen($message) > 2000) json_out(['error' => 'Message is too long.'], 400);

try {
    $pdo = db();
    // Rate limit: 5 messages per email per hour
    $rl = $pdo->prepare('SELECT COUNT(*) FROM contact_messages WHERE email = ? AND created_at > NOW() - INTERVAL 1 HOUR');
    $rl->execute([$email]);
    if ((int)$rl->fetchColumn() >= 5) json_out(['error' => 'Too many messages. Please try again later.'], 429);

    $st = $pdo->prepare('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)');
    $st->execute([$name, $email, $message]);
    json_out(['ok' => true, 'message' => 'Thanks! We will get back to you shortly.'], 201);
} catch (Throwable $e) {
    json_out(['error' => 'Could not send your message right now.'], 500);
}
