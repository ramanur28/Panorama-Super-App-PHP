<?php
/**
 * Panorama Super App - Agencies Management API
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

$agencyId = $_GET['id'] ?? '';
$action = $_GET['action'] ?? '';

// GET: LIST ALL AGENCIES
if ($method === 'GET') {
    $rows = db_query("SELECT * FROM agencies ORDER BY name ASC");
    $agencies = array_map(function($a) {
        return [
            'id' => $a['id'],
            'name' => $a['name'],
            'code' => $a['code'],
            'contactPerson' => $a['contact_person'] ?? '',
            'phone' => $a['phone'],
            'email' => $a['email'] ?? '',
            'address' => $a['address'] ?? ''
        ];
    }, $rows);
    json_response($agencies);
}

// POST: CREATE AGENCY
if ($method === 'POST' && empty($action) && empty($agencyId)) {
    $body = get_json_input();
    $name = trim($body['name'] ?? '');
    $code = strtoupper(trim($body['code'] ?? ''));
    $phone = trim($body['phone'] ?? '');

    if (!$name) {
        json_response(['success' => false, 'message' => 'Nama mitra agen travel wajib diisi.'], 400);
    }
    if (!$code) {
        $code = 'AG-' . mt_rand(10, 99);
    }

    $existing = db_query_one("SELECT id FROM agencies WHERE UPPER(code) = ?", [$code]);
    if ($existing) {
        json_response(['success' => false, 'message' => "Kode agen '{$code}' sudah digunakan."], 400);
    }

    $newId = 'ag-' . time();
    db_execute("
        INSERT INTO agencies (id, name, code, contact_person, phone, email, address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ", [
        $newId,
        $name,
        $code,
        $body['contactPerson'] ?? 'PIC Operasional',
        $phone ?: '0812-0000-0000',
        $body['email'] ?? strtolower($code) . '@travel.com',
        $body['address'] ?? 'Kantor Rekanan'
    ]);

    $created = db_query_one("SELECT * FROM agencies WHERE id = ?", [$newId]);
    json_response(['success' => true, 'agency' => [
        'id' => $created['id'],
        'name' => $created['name'],
        'code' => $created['code'],
        'contactPerson' => $created['contact_person'],
        'phone' => $created['phone'],
        'email' => $created['email'],
        'address' => $created['address']
    ]], 201);
}

// PUT: UPDATE AGENCY
if ($method === 'PUT' || ($method === 'POST' && $action === 'update')) {
    $id = $agencyId ?: ($_GET['id'] ?? null);
    $body = get_json_input();
    if (!$id && isset($body['id'])) $id = $body['id'];

    if (!$id) {
        json_response(['success' => false, 'message' => 'ID Agen wajib disertakan.'], 400);
    }

    $setClauses = [];
    $params = [];
    $fields = [
        'name' => 'name',
        'code' => 'code',
        'contactPerson' => 'contact_person',
        'phone' => 'phone',
        'email' => 'email',
        'address' => 'address'
    ];

    foreach ($fields as $jsKey => $col) {
        if (array_key_exists($jsKey, $body)) {
            $setClauses[] = "`{$col}` = ?";
            $params[] = $body[$jsKey];
        }
    }

    if (!empty($setClauses)) {
        $params[] = $id;
        db_execute("UPDATE agencies SET " . implode(', ', $setClauses) . " WHERE id = ?", $params);
    }

    $updated = db_query_one("SELECT * FROM agencies WHERE id = ?", [$id]);
    json_response(['success' => true, 'agency' => [
        'id' => $updated['id'],
        'name' => $updated['name'],
        'code' => $updated['code'],
        'contactPerson' => $updated['contact_person'],
        'phone' => $updated['phone'],
        'email' => $updated['email'],
        'address' => $updated['address']
    ]]);
}

// DELETE: DELETE AGENCY
if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $id = $agencyId ?: ($_GET['id'] ?? null);
    if (!$id) {
        $body = get_json_input();
        $id = $body['id'] ?? null;
    }
    if ($id === 'ag-direct') {
        json_response(['success' => false, 'message' => 'Agen Direct adalah agen bawaan sistem dan tidak dapat dihapus.'], 400);
    }
    db_execute("DELETE FROM agencies WHERE id = ?", [$id]);
    json_response(['success' => true, 'message' => 'Mitra agen berhasil dihapus.']);
}

json_response(['error' => 'Method not allowed'], 405);
