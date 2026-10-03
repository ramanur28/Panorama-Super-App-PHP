# Panduan Deployment Panorama Super App ke Shared Hosting (cPanel)

Aplikasi **Panorama Super App** versi ini telah dibangun ulang secara penuh menggunakan **Native PHP murni + MySQL Relational Database** dengan standar **Progressive Web App (PWA)** modern.

Versi ini dirancang khusus agar dapat langsung diunggah (*upload & run*) pada paket **Shared Hosting** mana pun (cPanel, DirectAdmin, Apache, LiteSpeed, Hostinger, Niagahoster, DomaiNesia, dll) tanpa memerlukan Node.js daemon, Docker, VPS, atau proses `npm run build`.

---

## 🚀 Keunggulan Arsitektur PHP Native

1. **Zero External Dependencies**: Berjalan murni menggunakan ekstensi bawaan PHP (PDO MySQL, JSON, Session). Tidak memerlukan Composer atau dependensi eksternal.
2. **Kompatibilitas Versi PHP Luas**: Kompatibel dari PHP 7.4, 8.0, 8.1, 8.2, 8.3, hingga PHP 8.5+.
3. **Database Relasional MySQL / MariaDB**: Menggunakan skema InnoDB terstruktur dengan indeks optimal, relasi antar tabel, dan sanitasi ketat untuk keamanan data.
4. **PWA Siap Pakai**: Dilengkapi Web App Manifest (`manifest.json`) dan Service Worker (`sw.js`) untuk caching offline dan pemasangan langsung di layar utama smartphone (Android & iOS).
5. **Strict Role-Based Security (RBAC)**: Otoritas data terlindungi secara ketat di sisi server (PHP PDO). Driver dan fotografer tidak dapat melihat biaya operasional rahasia milik Administrator.

---

## 📋 Langkah-langkah Instalasi di cPanel

### Langkah 1: Buat Database MySQL di cPanel
1. Masuk ke cPanel akun hosting Anda.
2. Cari dan klik menu **MySQL® Databases** (atau *MySQL Database Wizard*).
3. **Buat Database Baru**: Misalnya `username_panoramatour`.
4. **Buat Pengguna MySQL Baru**: Misalnya `username_dbuser` dengan kata sandi yang kuat.
5. **Hubungkan Pengguna ke Database**:
   - Pilih user dan database yang baru dibuat.
   - Centang opsi **ALL PRIVILEGES** (Semua Hak Akses).
   - Klik **Make Changes**.

---

### Langkah 2: Konfigurasi Kredensial Database (`config.php`)
Buka berkas `config.php` (dapat diedit melalui File Manager cPanel atau sebelum diunggah), lalu sesuaikan konstanta database:

```php
define('DB_HOST', 'localhost');                  // Biasanya localhost di cPanel
define('DB_PORT', '3306');
define('DB_NAME', 'cpaneluser_panoramatour');    // Ganti dengan nama database Anda
define('DB_USER', 'cpaneluser_dbuser');          // Ganti dengan username MySQL Anda
define('DB_PASS', 'PasswordDatabaseAnda123!');    // Ganti dengan kata sandi MySQL Anda
define('DB_CHARSET', 'utf8mb4');
```

---

### Langkah 3: Unggah Berkas Aplikasi ke Hosting
1. Di cPanel, buka **File Manager**.
2. Masuk ke direktori target:
   - Jika untuk domain utama: masuk ke folder `public_html/`.
   - Jika untuk subdomain / subfolder (misal: `app.domainanda.com` atau `domainanda.com/app`): buat folder target.
3. Unggah berkas arsip: **`panorama-super-app-cpanel.zip`**.
4. Klik kanan pada berkas zip tersebut, lalu pilih **Extract** (Ekstrak di direktori tersebut).

---

### Langkah 4: Setup & Migrasi Database Otomatis (1-Klik)
Aplikasi telah dilengkapi dengan antarmuka installer web otomatis:
1. Buka browser Anda dan akses:
   ```
   https://namadomainanda.com/migrate.php
   ```
   *(atau `https://namadomainanda.com/subfolder/migrate.php` jika di dalam subfolder)*.
2. Halaman asisten migrasi akan memvalidasi koneksi ke server MySQL.
3. Klik tombol hijau: **"⚙ Jalankan Setup & Migrasi Database Sekarang"**.
4. Sistem akan otomatis mengeksekusi skema `database.sql`, membuat seluruh tabel, dan menyuntikkan data operasional awal.
5. Setelah muncul notifikasi sukses, klik tombol **"🚀 Buka Aplikasi Panorama Super App"**.

> **Tips Keamanan**: Setelah instalasi pertama selesai dan database aktif, Anda dapat menghapus berkas `migrate.php` atau mengubah namanya demi keamanan ekstra.

---

## 🔑 Akun Demo Default

Aplikasi sudah disiapkan dengan akun operasional siap pakai (PIN Default: **`123456`**):

| Username | Peran (Role) | Keterangan Akses |
|---|---|---|
| **`admin`** | **Administrator** | Hak akses penuh: Manajemen Trip, Kru, PnL Keuangan, Tagihan Agen, Cetak Invoice, Payroll |
| **`budi`** | **Driver Jeep** | Portal Armada Jeep (Jadwal Bromo, titik jemput, kontak WA tamu, rekap honor) |
| **`slamet`** | **Driver Jeep** | Armada Jeep 04 (Hardtop N 7182 XY) |
| **`rian`** | **Driver Lapangan** | Portal Shuttle Penjemputan (HiAce Shuttle N 7788 OP, kontak tamu) |
| **`agus`** | **Driver Lapangan** | Shuttle Sewa (Innova Reborn N 1122 TR) |
| **`dimas`** | **Fotografer** | Portal Dokumentasi (Input & simpan tautan Google Drive / Cloud album foto) |
| **`fajar`** | **Fotografer** | Fotografer Dokumentasi Freelance |

---

## 📱 Panduan Pemasangan sebagai Aplikasi HP (PWA)

Aplikasi ini memenuhi standar **Progressive Web App (PWA)** sehingga dapat dipasang layaknya aplikasi native tanpa perlu Google Play Store atau Apple App Store:

### Di Ponsel Android (Google Chrome):
1. Buka website aplikasi melalui Google Chrome dengan koneksi HTTPS.
2. Klik tombol **"Pasang Aplikasi ke Layar Utama"** pada halaman login, atau klik menu titik tiga di kanan atas Chrome lalu pilih **"Install app"** / **"Tambahkan ke Layar Utama"**.
3. Ikon aplikasi *PanoramaApp* akan muncul di layar utama smartphone Anda.

### Di iPhone / iPad iOS (Apple Safari):
1. Buka website aplikasi menggunakan peramban **Safari**.
2. Ketuk tombol **Bagikan (Share)** (ikon kotak dengan panah ke atas di bagian bawah).
3. Gulir ke bawah dan pilih **"Tambahkan ke Layar Utama" (Add to Home Screen)**.
4. Ketuk **Tambah**. Aplikasi siap dibuka secara layar penuh (*standalone*).

---

## 🛠 Struktur Direktori Berkas

```
php-version/
├── .htaccess                     # Konfigurasi Apache, kompresi Gzip, rewrite API, security headers
├── config.php                    # Konfigurasi koneksi MySQL dan environment
├── database.sql                  # Skema database relasional & seed data awal
├── index.php                     # Entrypoint & App Shell PWA utama
├── manifest.json                 # Web App Manifest PWA
├── migrate.php                   # Web installer migrasi database
├── sw.js                         # Service Worker untuk caching dan offline support
├── api/
│   ├── auth.php                  # Endpoint autentikasi login, logout, sesi
│   ├── trips.php                 # Endpoint CRUD trip & proteksi role
│   ├── workers.php               # Endpoint master kru operasional
│   ├── agencies.php              # Endpoint master mitra agen travel
│   ├── templates.php             # Endpoint paket & itinerary template
│   ├── analytics.php             # Endpoint Laba Rugi (PnL) & Payroll
│   ├── health.php                # Pemeriksaan status koneksi MySQL
│   └── sync.php                  # Sinkronisasi data offline
├── includes/
│   ├── db.php                    # Singleton PDO connection wrapper
│   ├── helpers.php               # Helper sanitasi, kapasitas kru, dan respons JSON
│   └── auth.php                  # Guard hak akses RBAC
└── assets/
    ├── css/
    │   └── app.css               # Desain UI Clean Light Canvas responsif
    ├── js/
    │   ├── icons.js              # Pustaka icon SVG lokal mandiri (100% offline)
    │   ├── api.js                # Klien HTTP API dengan fallback LocalStorage
    │   └── app.js                # State controller & interaksi antarmuka
    └── icons/                    # Asset ikon PWA (192x192, 512x512, favicon, logo)
```

---

*Hak Cipta © 2026 Panorama Tour Indonesia. Hak cipta dilindungi undang-undang.*
