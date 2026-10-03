<?php
/**
 * Panorama Super App - Health Check API
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

$online = Database::isConnected();
$lastError = Database::getLastError();

json_response([
    'status' => $online ? 'ok' : 'degraded',
    'online' => $online,
    'database' => $online ? 'centralized_mysql_online' : 'disconnected',
    'engine' => 'MySQL (PDO / InnoDB / utf8mb4)',
    'host' => DB_HOST . ':' . DB_PORT,
    'dbName' => DB_NAME,
    'serverTime' => date('c'),
    'error' => $lastError
], $online ? 200 : 503);
