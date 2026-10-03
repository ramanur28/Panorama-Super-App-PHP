<?php
/**
 * Panorama Super App - CLI Built-in Server Router
 * Digunakan untuk pengujian lokal: php -S 0.0.0.0:8000 router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$filePath = __DIR__ . $uri;

// 1. Serve static files directly if exist
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    // Set appropriate MIME types for PWA assets
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'ico' => 'image/x-icon'
    ];
    if (isset($mimes[$ext])) {
        header('Content-Type: ' . $mimes[$ext]);
    }
    if (in_array(basename($filePath), ['sw.js', 'manifest.json'])) {
        header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
    return false;
}

// 2. Route extensionless API calls: /api/trips -> api/trips.php
if (preg_match('/^\/api\/([a-zA-Z0-9_-]+)/', $uri, $matches)) {
    $apiScript = __DIR__ . '/api/' . $matches[1] . '.php';
    if (file_exists($apiScript)) {
        require $apiScript;
        exit;
    }
}

// 3. Fallback to index.php
require __DIR__ . '/index.php';
