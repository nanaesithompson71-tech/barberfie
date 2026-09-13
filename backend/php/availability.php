<?php
/* GET /php/availability.php?date=YYYY-MM-DD[&barber_id=1]
   Public slot availability so visitors can see free times
   before creating an account. Mirrors the Node API rules. */
declare(strict_types=1);
require __DIR__ . '/config.php';

$date = $_GET['date'] ?? '';
$barberId = isset($_GET['barber_id']) ? (int)$_GET['barber_id'] : 0;
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) {
    json_out(['error' => 'date must be YYYY-MM-DD'], 400);
}

try {
    $pdo = db();
    $dow = (int)date('w', strtotime($date));
    $h = $pdo->prepare('SELECT opens, closes, is_open FROM opening_hours WHERE day_of_week = ?');
    $h->execute([$dow]);
    $hours = $h->fetch();
    if (!$hours || !$hours['is_open']) json_out(['date' => $date, 'closed' => true, 'slots' => []]);

    $stepRow = $pdo->query("SELECT setting_value FROM shop_settings WHERE setting_key = 'slot_minutes'")->fetch();
    $step = max(15, (int)($stepRow['setting_value'] ?? 60));

    $sql = "SELECT TIME_FORMAT(booking_time, '%H:%i') AS t FROM bookings WHERE booking_date = ? AND status IN ('pending','confirmed')";
    $params = [$date];
    if ($barberId) { $sql .= ' AND barber_id = ?'; $params[] = $barberId; }
    $st = $pdo->prepare($sql); $st->execute($params);
    $taken = array_column($st->fetchAll(), 't');

    $toMin = fn(string $t) => (int)substr($t, 0, 2) * 60 + (int)substr($t, 3, 2);
    $isToday = $date === date('Y-m-d');
    $nowHour = (int)date('G');
    $slots = [];
    for ($m = $toMin($hours['opens']); $m + $step <= $toMin($hours['closes']); $m += $step) {
        $t = sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
        $slots[] = [
            'time' => $t,
            'available' => !in_array($t, $taken, true) && !($isToday && intdiv($m, 60) <= $nowHour),
        ];
    }
    json_out(['date' => $date, 'closed' => false, 'slots' => $slots]);
} catch (Throwable $e) {
    json_out(['error' => 'Could not load availability.'], 500);
}
