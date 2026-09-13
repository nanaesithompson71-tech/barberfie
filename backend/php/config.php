<?php
/* ==========================================================
   BARBERFIE - PHP public endpoints: shared config
   Reads the same ../.env file as the other services.
   ========================================================== */
declare(strict_types=1);

function load_env(string $path): void {
    if (!is_file($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k); $v = trim($v);
        if (getenv($k) === false) putenv("$k=$v");
    }
}
load_env(__DIR__ . '/../.env');

function env(string $key, string $default = ''): string {
    $v = getenv($key);
    return $v === false ? $default : $v;
}

/** Shared PDO connection. */
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            env('DB_HOST', '127.0.0.1'), env('DB_PORT', '3306'), env('DB_NAME', 'barberfie'));
        $pdo = new PDO($dsn, env('DB_USER', 'barberfie'), env('DB_PASSWORD', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

/** Send a JSON response with CORS headers and stop. */
function json_out($data, int $status = 200): never {
    $allowed = array_map('trim', explode(',', env('CORS_ORIGIN', '*')));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array('*', $allowed, true) || in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Read a JSON or form-encoded request body. */
function body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $json = json_decode($raw, true);
    return is_array($json) ? $json : $_POST;
}
