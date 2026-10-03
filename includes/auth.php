<?php
/**
 * Panorama Super App - Authentication & RBAC Authority Guard
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

define('AUTH_SECRET_KEY', 'panorama_super_app_secure_key_2026');

function generate_auth_token(string $userId): string {
    $expires = time() + (86400 * 7); // 7 days validity
    $signature = hash_hmac('sha256', $userId . ':' . $expires, AUTH_SECRET_KEY);
    return base64_encode($userId . ':' . $expires . ':' . $signature);
}

function verify_auth_token(string $token): ?string {
    $decoded = base64_decode($token, true);
    if (!$decoded || strpos($decoded, ':') === false) {
        return null;
    }
    $parts = explode(':', $decoded);
    if (count($parts) !== 3) {
        return null;
    }
    [$userId, $expires, $signature] = $parts;
    if ((int)$expires < time()) {
        return null; // Expired
    }
    $expectedSignature = hash_hmac('sha256', $userId . ':' . $expires, AUTH_SECRET_KEY);
    if (!hash_equals($expectedSignature, $signature)) {
        return null; // Invalid signature
    }
    return $userId;
}

function get_auth_user(): ?array {
    if (isset($_SESSION['user']) && is_array($_SESSION['user']) && !empty($_SESSION['user']['id'])) {
        return $_SESSION['user'];
    }

    // Token-based fallback (from Authorization Header)
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
        $userId = verify_auth_token($token);
        if ($userId) {
            $user = db_query_one("SELECT * FROM users WHERE id = ?", [$userId]);
            if ($user) {
                $mapped = map_user_row($user);
                $_SESSION['user'] = $mapped;
                return $mapped;
            }
        }
    }

    return null;
}

function require_auth(): array {
    $user = get_auth_user();
    if (!$user) {
        json_response([
            'success' => false,
            'message' => 'Sesi autentikasi telah berakhir. Silakan login kembali.'
        ], 401);
    }
    return $user;
}

function require_admin(): array {
    $user = require_auth();
    if ($user['role'] !== 'admin') {
        json_response([
            'success' => false,
            'message' => 'Akses ditolak: Anda tidak memiliki otoritas Administrator.'
        ], 403);
    }
    return $user;
}

function auth_login(string $identifier, string $pin = ''): array {
    $cleanId = strtolower(trim($identifier));
    $cleanPhone = preg_replace('/[^0-9]/', '', $cleanId);
    $cleanPin = trim($pin);

    if (empty($cleanId)) {
        return [
            'success' => false,
            'message' => 'Username, email, atau nomor HP wajib diisi.'
        ];
    }

    if ($cleanPin === '') {
        return [
            'success' => false,
            'message' => 'PIN keamanan wajib diisi.'
        ];
    }

    if (!ctype_digit($cleanPin)) {
        return [
            'success' => false,
            'message' => 'Kredensial salah: PIN keamanan harus berupa angka.'
        ];
    }

    // Strict exact matching (no loose LIKE substring matches)
    $sql = "
        SELECT * FROM users
        WHERE LOWER(username) = ?
           OR LOWER(email) = ?
           OR (? != '' AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?)
        LIMIT 1
    ";
    $user = db_query_one($sql, [$cleanId, $cleanId, $cleanPhone, $cleanPhone]);

    if (!$user) {
        return [
            'success' => false,
            'message' => 'Kredensial salah: Akun tidak ditemukan. Periksa kembali username atau nomor HP Anda.'
        ];
    }

    $expectedPin = (string)($user['pin'] ?: '123456');
    if ($cleanPin !== $expectedPin) {
        return [
            'success' => false,
            'message' => 'Kredensial salah: PIN keamanan yang Anda masukkan tidak cocok.'
        ];
    }

    $mapped = map_user_row($user);
    $_SESSION['user'] = $mapped;

    $token = generate_auth_token($mapped['id']);

    log_audit(null, $mapped['id'], 'USER_LOGIN', [
        'username' => $mapped['username'],
        'role' => $mapped['role']
    ]);

    return [
        'success' => true,
        'user' => $mapped,
        'token' => $token
    ];
}

function auth_logout(): void {
    if (isset($_SESSION['user']['id'])) {
        log_audit(null, $_SESSION['user']['id'], 'USER_LOGOUT');
    }
    unset($_SESSION['user']);
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }
}
