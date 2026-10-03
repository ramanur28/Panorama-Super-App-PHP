<?php
/**
 * PANORAMA SUPER APP - CONFIGURATION
 * Optimized for Shared Hosting (cPanel / DirectAdmin / Apache / LiteSpeed)
 * 
 * Silakan sesuaikan kredensial MySQL di bawah ini sesuai akun cPanel Anda.
 */

// 1. Timezone & Localization
date_default_timezone_set('Asia/Jakarta');

// 2. Kredensial Database MySQL
// Di cPanel sesuaikan dengan database dan user yang dibuat di MySQL Databases
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'panorama_tour_db');
define('DB_USER', getenv('DB_USER') ?: 'panorama');
define('DB_PASS', getenv('DB_PASS') ?: 'panorama123');
define('DB_CHARSET', 'utf8mb4');

// 3. Environment & Error Reporting
define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_NAME', 'Panorama Super App');
define('APP_VERSION', '1.0.0');

if (APP_ENV === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// 4. Session Security
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') 
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    
    session_set_cookie_params([
        'lifetime' => 86400 * 30, // 30 hari
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

// 5. Helper Deteksi Base URL
function get_base_url() {
    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') 
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $protocol = $isHttps ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
    $basePath = preg_replace('/\/api.*$/', '', $scriptDir);
    $basePath = rtrim($basePath, '/');
    return $protocol . $host . $basePath;
}
