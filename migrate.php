<?php
/**
 * Panorama Super App - Web Installer & Database Migrator
 * Jalankan file ini melalui browser di Shared Hosting: https://namadomain.com/migrate.php
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$messages = [];
$status = 'idle';

// Test connection
$testPdo = null;
$connError = null;
try {
    $dsn = sprintf('mysql:host=%s;port=%s;charset=%s', DB_HOST, DB_PORT, DB_CHARSET);
    $testPdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    $connError = $e->getMessage();
}

if ($action === 'run' && $testPdo) {
    try {
        // Create database if not exists
        $testPdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $testPdo->exec("USE `" . DB_NAME . "`");
        
        // Read and execute database.sql
        $sqlFile = __DIR__ . '/database.sql';
        if (!file_exists($sqlFile)) {
            throw new Exception("Berkas database.sql tidak ditemukan di direktori " . __DIR__);
        }
        $sql = file_get_contents($sqlFile);
        
        // Execute SQL statements
        $testPdo->exec($sql);
        
        // Auto-migration for existing installations
        try {
            $guideCol = $testPdo->query("SHOW COLUMNS FROM trips LIKE 'guide_name'")->fetchAll();
            if (empty($guideCol)) {
                $testPdo->exec("ALTER TABLE trips ADD COLUMN guide_name VARCHAR(128) DEFAULT NULL AFTER photo_album_url");
                $testPdo->exec("ALTER TABLE trips ADD COLUMN guide_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER guide_name");
                $messages[] = "Kolom `guide_name` & `guide_fee` berhasil ditambahkan ke tabel `trips`.";
            }
            $guidePayCol = $testPdo->query("SHOW COLUMNS FROM trips LIKE 'guide_payroll_status'")->fetchAll();
            if (empty($guidePayCol)) {
                $testPdo->exec("ALTER TABLE trips ADD COLUMN guide_payroll_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid' AFTER guide_fee");
                $messages[] = "Kolom `guide_payroll_status` berhasil ditambahkan ke tabel `trips`.";
            }
            $userRoleCol = $testPdo->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch();
            if ($userRoleCol && strpos($userRoleCol['Type'], 'guide') === false) {
                $testPdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'driver_jeep', 'driver_lapangan', 'photographer', 'guide') NOT NULL");
                $messages[] = "Role `guide` berhasil ditambahkan ke tabel `users`.";
            }

            // Auto-sync driver lapangan & fotografer kru operasional
            $crewSeeds = [
                ['w-field-yoyok', 'yoyok', 'yoyok@panoramatour.com', '0821-5501-1001', '123456', 'Yoyok', 'driver_lapangan', 'internal', 'HiAce Shuttle / Innova', 175000.00],
                ['w-field-didik', 'didik_driver', 'didik.driver@panoramatour.com', '0821-5501-1002', '123456', 'Didik Pranoto', 'driver_lapangan', 'internal', 'HiAce Shuttle / Innova', 175000.00],
                ['w-field-andri', 'andri_driver', 'andri.driver@panoramatour.com', '0821-5501-1003', '123456', 'Andri', 'driver_lapangan', 'internal', 'HiAce Shuttle / Innova', 175000.00],
                ['w-field-kurniatrans', 'kurniatrans', 'kurniatrans@panoramatour.com', '0821-5501-1004', '123456', 'Kurnia Trans', 'driver_lapangan', 'external', 'Armada Shuttle Kurnia Trans', 200000.00],
                ['w-photo-annur', 'annur', 'annur@panoramatour.com', '0822-6601-2001', '123456', 'An-nur', 'photographer', 'internal', 'Camera Kit & Dokumentasi', 200000.00],
                ['w-photo-ferdy', 'ferdy', 'ferdy@panoramatour.com', '0822-6601-2002', '123456', 'Ferdy', 'photographer', 'internal', 'Camera Kit & Dokumentasi', 200000.00],
                ['w-photo-andy', 'andy', 'andy@panoramatour.com', '0822-6601-2003', '123456', 'Andy', 'photographer', 'internal', 'Camera Kit & Dokumentasi', 200000.00],
                ['w-photo-andri', 'andri_photo', 'andri.photo@panoramatour.com', '0822-6601-2004', '123456', 'Andri', 'photographer', 'internal', 'Camera Kit & Dokumentasi', 200000.00],
                ['w-photo-didik', 'didik_photo', 'didik.photo@panoramatour.com', '0822-6601-2005', '123456', 'Didik Pranoto', 'photographer', 'internal', 'Camera Kit & Dokumentasi', 200000.00]
            ];
            $stmtCrew = $testPdo->prepare("
                INSERT INTO users (id, username, email, phone, pin, name, role, type, vehicle_unit, base_rate_per_trip, is_available)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), role = VALUES(role), phone = VALUES(phone),
                    vehicle_unit = VALUES(vehicle_unit), base_rate_per_trip = VALUES(base_rate_per_trip),
                    type = VALUES(type)
            ");
            foreach ($crewSeeds as $cs) {
                $stmtCrew->execute($cs);
            }
            $messages[] = "Data kru operasional (Driver Lapangan & Fotografer) berhasil disinkronkan.";
        } catch (Exception $migErr) {
            // Ignore if column already exists or minor error
        }

        $status = 'success';
        $messages[] = "Database `" . DB_NAME . "` berhasil dihubungkan dan tabel berhasil dibuat/diperbarui.";
        
        // Count rows
        $uCount = $testPdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $aCount = $testPdo->query("SELECT COUNT(*) FROM agencies")->fetchColumn();
        $tCount = $testPdo->query("SELECT COUNT(*) FROM trips")->fetchColumn();
        $tplCount = $testPdo->query("SELECT COUNT(*) FROM itinerary_templates")->fetchColumn();
        
        $messages[] = "Tabel `users`: {$uCount} akun terdaftar.";
        $messages[] = "Tabel `agencies`: {$aCount} mitra agen travel terdaftar.";
        $messages[] = "Tabel `itinerary_templates`: {$tplCount} paket tour wisata.";
        $messages[] = "Tabel `trips`: {$tCount} data perjalanan siap operasional.";
    } catch (Exception $e) {
        $status = 'error';
        $messages[] = "Gagal menjalankan migrasi: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup & Migrasi Database - Panorama Super App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #059669;
      --primary-dark: #047857;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px 16px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      max-width: 620px;
      width: 100%;
      padding: 28px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .badge-icon {
      width: 48px;
      height: 48px;
      background: #ecfdf5;
      color: var(--primary);
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 12px;
    }
    h1 { font-size: 20px; font-weight: 800; color: var(--text); }
    p.sub { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .status-box {
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .status-box.success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #15803d;
    }
    .status-box.error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }
    .status-box.info {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0369a1;
    }
    .config-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .config-table td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    .config-table td:first-child {
      font-weight: 700;
      color: var(--muted);
      width: 35%;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 12px 16px;
      background: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover { background: var(--primary-dark); }
    .demo-accounts {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      margin-top: 20px;
      font-size: 12px;
    }
    .demo-accounts strong { color: var(--primary); }
    ul { padding-left: 20px; margin-top: 6px; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge-icon">&#9981;</div>
      <h1>Setup & Migrasi Database MySQL</h1>
      <p class="sub">Panorama Super App • Shared Hosting Deployment Assistant</p>
    </div>

    <?php if ($connError): ?>
      <div class="status-box error">
        <strong>Gagal Terhubung ke MySQL!</strong><br>
        <?= htmlspecialchars($connError) ?><br><br>
        <small>Silakan periksa dan sesuaikan file <code>config.php</code> dengan host, nama database, user, dan password MySQL di cPanel Anda.</small>
      </div>
    <?php else: ?>
      <div class="status-box info">
        &#10004; <strong>Koneksi MySQL Berhasil:</strong> Terhubung ke server <code><?= htmlspecialchars(DB_HOST . ':' . DB_PORT) ?></code> menggunakan user <code><?= htmlspecialchars(DB_USER) ?></code>.
      </div>
    <?php endif; ?>

    <?php if ($status === 'success'): ?>
      <div class="status-box success">
        <strong>&#10004; Migrasi Selesai dengan Sukses!</strong>
        <ul>
          <?php foreach ($messages as $msg): ?>
            <li><?= htmlspecialchars($msg) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php elseif ($status === 'error'): ?>
      <div class="status-box error">
        <strong>Terjadi Kesalahan:</strong>
        <ul>
          <?php foreach ($messages as $msg): ?>
            <li><?= htmlspecialchars($msg) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>

    <table class="config-table">
      <tr><td>Host Database</td><td><code><?= htmlspecialchars(DB_HOST) ?></code></td></tr>
      <tr><td>Port MySQL</td><td><code><?= htmlspecialchars(DB_PORT) ?></code></td></tr>
      <tr><td>Nama Database</td><td><code><?= htmlspecialchars(DB_NAME) ?></code></td></tr>
      <tr><td>User MySQL</td><td><code><?= htmlspecialchars(DB_USER) ?></code></td></tr>
      <tr><td>Lokasi File SQL</td><td><code>database.sql</code> (Siap Dieksekusi)</td></tr>
    </table>

    <?php if ($status !== 'success'): ?>
      <a href="?action=run" class="btn" onclick="return confirm('Jalankan migrasi database sekarang?');">
        &#9881; Jalankan Setup & Migrasi Database Sekarang
      </a>
    <?php else: ?>
      <a href="index.php" class="btn">
        &#128640; Buka Aplikasi Panorama Super App (PWA)
      </a>
    <?php endif; ?>

    <div class="demo-accounts">
      <div style="font-weight: 700; margin-bottom: 6px; color: #0f172a;">Akun Demo Tersedia (PIN Default: <strong>123456</strong>):</div>
      <ul>
        <li><strong>admin</strong> &bull; Administrator (Manajemen Trip, Kru, PnL, Payroll, Tagihan)</li>
        <li><strong>budi</strong> &bull; Driver Jeep (Armada Tetap N 1045 AB)</li>
        <li><strong>rian</strong> &bull; Driver Lapangan / Shuttle (HiAce N 7788 OP)</li>
        <li><strong>dimas</strong> &bull; Fotografer (Sony A7 IV + Dokumentasi Cloud)</li>
      </ul>
    </div>
  </div>
</body>
</html>
