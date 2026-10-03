<?php
/**
 * Panorama Super App - PWA Main Entrypoint
 * Optimized for Shared Hosting (cPanel / DirectAdmin / Apache / LiteSpeed)
 */
require_once __DIR__ . '/config.php';

// Helper auto cache-busting berdasarkan waktu modifikasi file
function asset_v(string $relPath): string {
    $fullPath = __DIR__ . '/' . ltrim($relPath, '/');
    $ver = file_exists($fullPath) ? filemtime($fullPath) : time();
    return $relPath . '?v=' . $ver;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Panorama Super App - Tour & Travel Operations</title>
  
  <!-- PWA & Mobile Meta Tags -->
  <meta name="description" content="Aplikasi Operasional Tour Bromo, Driver Jeep, Driver Lapangan, Fotografer, dan Tagihan Agen Travel">
  <meta name="theme-color" content="#0284c7">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="PanoramaApp">
  
  <!-- Web App Manifest & Favicons -->
  <link rel="manifest" href="manifest.json">
  <link rel="icon" type="image/png" href="assets/icons/favicon.png">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  
  <!-- Typography: Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <!-- Styles with Dynamic Cache-Busting -->
  <link rel="stylesheet" href="<?= asset_v('assets/css/app.css') ?>">
</head>
<body>
  <div class="app-viewport-wrapper">
    <div id="app-root" class="app-container">
      <!-- Loading Skeleton -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; gap: 14px;">
        <img src="assets/icons/logo.png" alt="Loading Panorama" style="width: 54px; height: 54px; border-radius: 12px;" onerror="this.src='assets/icons/favicon.png'">
        <div style="font-weight: 700; font-size: 14px; color: #475569;">Memuat Panorama Super App...</div>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container" class="toast-container"></div>

  <!-- Modal Container Root -->
  <div id="modal-root"></div>

  <!-- Scripts with Dynamic Cache-Busting -->
  <script src="<?= asset_v('assets/js/icons.js') ?>"></script>
  <script src="<?= asset_v('assets/js/api.js') ?>"></script>
  <script src="<?= asset_v('assets/js/app.js') ?>"></script>

  <!-- PWA Service Worker Registration with Instant Auto-Update -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // updateViaCache: 'none' memberitahu browser untuk selalu memeriksa sw.js langsung dari server
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
            // Paksa pemeriksaan pembaruan service worker setiap kali halaman dimuat
            reg.update();

            // Tangani event jika service worker versi baru ditemukan
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] Versi baru terdeteksi, memuat ulang aplikasi...');
                    if (window.showToast) {
                      showToast('info', 'Pembaruan Aplikasi', 'Versi baru telah dipasang. Memperbarui halaman...');
                    }
                    setTimeout(() => window.location.reload(), 1000);
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });

        // Tangani pergantian controller Service Worker secara mulus
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      });
    }
  </script>
</body>
</html>
