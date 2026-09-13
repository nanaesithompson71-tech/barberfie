<?php
/* GET /php/hours.php
   Public opening hours + whether the shop is open right now.
   Used by the homepage "Opening Hours" card. */
declare(strict_types=1);
require __DIR__ . '/config.php';

try {
    $rows = db()->query('SELECT day_of_week, opens, closes, is_open FROM opening_hours ORDER BY day_of_week')->fetchAll();
    $shop = db()->query("SELECT setting_key, setting_value FROM shop_settings WHERE setting_key IN ('shop_name','shop_phone','shop_address')")->fetchAll(PDO::FETCH_KEY_PAIR);

    $now   = new DateTime('now');
    $today = (int)$now->format('w');
    $time  = $now->format('H:i:s');
    $openNow = false;
    $hours = [];
    foreach ($rows as $r) {
        $hours[] = [
            'day'    => (int)$r['day_of_week'],
            'opens'  => substr($r['opens'], 0, 5),
            'closes' => substr($r['closes'], 0, 5),
            'open'   => (bool)$r['is_open'],
        ];
        if ((int)$r['day_of_week'] === $today && $r['is_open'] && $time >= $r['opens'] && $time < $r['closes']) {
            $openNow = true;
        }
    }
    json_out(['shop' => $shop, 'openNow' => $openNow, 'hours' => $hours]);
} catch (Throwable $e) {
    json_out(['error' => 'Could not load opening hours.'], 500);
}
