<?php
/**
 * Panorama Super App - Auth API
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($_POST['action'] ?? 'session');

if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

if ($action === 'login' && ($method === 'POST' || !empty($_POST))) {
    $input = get_json_input();
    $identifier = $input['identifier'] ?? '';
    $pin = $input['pin'] ?? '';

    if (empty($identifier)) {
        json_response([
            'success' => false,
            'message' => 'Nomor HP, username, atau email wajib diisi.'
        ], 400);
    }

    $result = auth_login($identifier, $pin);
    json_response($result, $result['success'] ? 200 : 401);
}

if ($action === 'logout') {
    auth_logout();
    json_response(['success' => true, 'message' => 'Sesi akun berhasil ditutup.']);
}

// Check session / get current user
$user = get_auth_user();
if ($user) {
    json_response([
        'success' => true,
        'authenticated' => true,
        'user' => $user
    ]);
} else {
    json_response([
        'success' => false,
        'authenticated' => false,
        'user' => null
    ]);
}
