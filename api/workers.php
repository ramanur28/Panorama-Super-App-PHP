<?php
/**
 * Panorama Super App - Workers / Crew Management API
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

$workerId = $_GET['id'] ?? '';
$action = $_GET['action'] ?? '';

// GET: LIST ALL WORKERS
if ($method === 'GET' && empty($workerId)) {
    $rows = db_query("SELECT * FROM users ORDER BY role ASC, name ASC");
    $workers = array_map('map_user_row', $rows);
    json_response($workers);
}

// POST: CREATE WORKER (Admin)
if ($method === 'POST' && empty($action) && empty($workerId)) {
    $body = get_json_input();
    $name = trim($body['name'] ?? '');
    $username = strtolower(trim($body['username'] ?? ''));
    $phone = trim($body['phone'] ?? '');
    $role = $body['role'] ?? 'driver_jeep';
    $type = $body['type'] ?? 'internal';
    $pin = trim($body['pin'] ?? '123456');
    $vehicleUnit = trim($body['vehicleUnit'] ?? '');
    $baseRate = (float)($body['baseRatePerTrip'] ?? 200000);

    if (!$name) {
        json_response(['success' => false, 'message' => 'Nama lengkap kru wajib diisi.'], 400);
    }
    if (!$username) {
        json_response(['success' => false, 'message' => 'Username wajib diisi.'], 400);
    }

    $existing = db_query_one("SELECT id FROM users WHERE LOWER(username) = ?", [$username]);
    if ($existing) {
        json_response(['success' => false, 'message' => "Username '{$username}' sudah digunakan oleh kru lain."], 400);
    }

    $newId = 'w-' . $role . '-' . time();
    $avatar = null;

    db_execute("
        INSERT INTO users (id, username, email, phone, pin, name, role, type, vehicle_unit, avatar, base_rate_per_trip, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ", [
        $newId, $username, $username . '@panoramatour.com', $phone ?: '0812-0000-0000',
        $pin ?: '123456', $name, $role, $type, $vehicleUnit ?: null, $avatar, $baseRate
    ]);

    $created = db_query_one("SELECT * FROM users WHERE id = ?", [$newId]);
    json_response(['success' => true, 'worker' => map_user_row($created)], 201);
}

// PUT: UPDATE WORKER
if ($method === 'PUT' || ($method === 'POST' && $action === 'update')) {
    $id = $workerId ?: ($_GET['id'] ?? null);
    $body = get_json_input();
    if (!$id && isset($body['id'])) $id = $body['id'];

    if (!$id) {
        json_response(['success' => false, 'message' => 'ID Kru wajib disertakan.'], 400);
    }

    $existing = db_query_one("SELECT * FROM users WHERE id = ?", [$id]);
    if (!$existing) {
        json_response(['success' => false, 'message' => 'Data kru tidak ditemukan.'], 404);
    }

    if (!empty($body['username'])) {
        $cleanUsername = strtolower(trim($body['username']));
        $dup = db_query_one("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", [$cleanUsername, $id]);
        if ($dup) {
            json_response(['success' => false, 'message' => "Username '{$cleanUsername}' sudah digunakan."], 400);
        }
    }

    $setClauses = [];
    $params = [];
    $fields = [
        'name' => 'name',
        'role' => 'role',
        'type' => 'type',
        'phone' => 'phone',
        'username' => 'username',
        'vehicleUnit' => 'vehicle_unit',
        'baseRatePerTrip' => 'base_rate_per_trip',
        'isAvailable' => 'is_available'
    ];

    foreach ($fields as $jsKey => $col) {
        if (array_key_exists($jsKey, $body)) {
            $setClauses[] = "`{$col}` = ?";
            $params[] = $body[$jsKey];
        }
    }

    if (!empty($body['pin'])) {
        $setClauses[] = "`pin` = ?";
        $params[] = trim($body['pin']);
    }

    if (!empty($setClauses)) {
        $params[] = $id;
        db_execute("UPDATE users SET " . implode(', ', $setClauses) . " WHERE id = ?", $params);
    }

    $updated = db_query_one("SELECT * FROM users WHERE id = ?", [$id]);
    json_response(['success' => true, 'worker' => map_user_row($updated)]);
}

// DELETE: DELETE WORKER
if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $id = $workerId ?: ($_GET['id'] ?? null);
    if (!$id) {
        $body = get_json_input();
        $id = $body['id'] ?? null;
    }
    if ($id === 'w-admin-1') {
        json_response(['success' => false, 'message' => 'Akun Administrator utama tidak dapat dihapus.'], 400);
    }
    db_execute("DELETE FROM users WHERE id = ?", [$id]);
    json_response(['success' => true, 'message' => 'Data kru berhasil dihapus.']);
}

json_response(['error' => 'Method not allowed'], 405);
