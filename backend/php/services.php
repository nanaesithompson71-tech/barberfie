<?php
/* GET /php/services.php
   Public list of active services and barbers for the homepage. */
declare(strict_types=1);
require __DIR__ . '/config.php';

try {
    $services = db()->query('SELECT id, name, price, duration_min AS duration FROM services WHERE active = 1 ORDER BY id')->fetchAll();
    $barbers  = db()->query('SELECT id, name, bio, working_days FROM barbers WHERE active = 1 ORDER BY id')->fetchAll();
    foreach ($services as &$s) { $s['id'] = (int)$s['id']; $s['price'] = (float)$s['price']; $s['duration'] = (int)$s['duration']; }
    foreach ($barbers as &$b) { $b['id'] = (int)$b['id']; $b['days'] = array_map('intval', array_filter(explode(',', $b['working_days']), 'strlen')); unset($b['working_days']); }
    json_out(['services' => $services, 'barbers' => $barbers]);
} catch (Throwable $e) {
    json_out(['error' => 'Could not load services.'], 500);
}
