# 🌄 Panorama Super App

[![PHP Version](https://img.shields.io/badge/PHP-7.4%20|%208.0%20|%208.1%20|%208.2%20|%208.3%20|%208.4%20|%208.5+-777bb4?logo=php&logoColor=white)](https://www.php.net/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7%20|%208.0+-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Progressive%20Web%20App-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Native)-success)](#)
[![Deployment](https://img.shields.io/badge/Deployment-cPanel%20|%20Shared%20Hosting%20|%20VPS-orange)](#)

> **Panorama Super App** is an all-in-one Tour & Travel Operational Management Platform built with pure **Native PHP** and **MySQL (InnoDB)**, delivered as an offline-first **Progressive Web App (PWA)**.

Designed specifically for travel agencies, destination operators (Bromo, Ijen, Malang, East Java), jeep fleets, shuttle drivers, tour leaders, and photographers. It runs out-of-the-box on **Shared Hosting (cPanel, DirectAdmin, Apache, LiteSpeed)**, VPS, or local PHP environments with **zero external dependencies** (no Composer, Node.js, Docker, or build steps required).

---

## 🌟 Key Features

- **👥 Multi-Role Access Control (RBAC)**:
  - **Administrator**: Complete control over operational dispatch, financial PnL analytics, crew payroll, trip CRUD, and agency commissions.
  - **Driver Jeep**: Personalized dashboard showing assigned 4x4 Jeep trips, guest count, pickup schedules, and trip status toggles.
  - **Driver Lapangan (Field / Shuttle)**: Dedicated portal for transfers, drop-offs, and shuttle unit management.
  - **Photographer**: Trip documentation portal to upload and store client cloud album links (Google Drive, Dropbox, etc.).
- **🚙 End-to-End Trip Lifecycle**:
  - Live status tracking: `scheduled`, `in_progress`, `completed`, `cancelled`.
  - Automated worker dispatch and vehicle assignment validation.
  - Capacity calculation and guest distribution alerts.
- **📊 Real-Time Financials & PnL**:
  - Automated revenue, expense, and profit margin computation per trip.
  - Agency B2B commission deduction and tracking.
  - Transparent gross profit and net margin analytics.
- **💰 Crew Payroll Engine**:
  - Automated wage tallying for internal and external/freelance drivers and photographers.
  - One-click payroll status settlement (`pending` / `paid`).
- **📱 Progressive Web App (PWA)**:
  - Installable directly to Android and iOS home screens with standalone app appearance.
  - Service Worker (`sw.js`) with smart caching strategies for network resilience and fast load times.
  - Offline sync client fallback.
- **⚡ Zero External Dependencies**:
  - Pure PHP PDO + Vanilla ES6+ JavaScript.
  - Self-contained SVG icon library (100% offline, no CDN or font downloads required).
- **🛠 1-Click Database Migrator**:
  - Built-in web installer (`migrate.php`) for automatic schema generation, foreign keys, and seed data.

---

## 🏗 System Architecture & Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Native PHP (7.4 - 8.5+) | Pure object-oriented PDO queries, strict type checks, JSON responses. |
| **Database** | MySQL / MariaDB (InnoDB) | Normalized relational schema with foreign key constraints, indexes, and utf8mb4 encoding. |
| **Frontend** | Vanilla JavaScript (ES6+) | Lightweight reactive state controller, client-side routing, and modal dialogs. |
| **Styling** | Vanilla CSS3 | Modern light canvas UI with responsive flexbox/grid layout and smooth micro-interactions. |
| **PWA** | Web App Manifest & Service Worker | Standalone mobile shell, offline asset caching, app shortcuts. |
| **Server** | Apache / LiteSpeed / Nginx / PHP CLI | `.htaccess` configuration with gzip compression, cache policies, and clean URL rewrites. |

---

## 📁 Directory Structure

```
Panorama-Super-App-php/
├── .htaccess                     # Apache/LiteSpeed URL rewrites, gzip compression & security headers
├── .gitignore                    # Git ignore file for temporary & OS files
├── config.php                    # Application settings & database connection constants
├── database.sql                  # MySQL database schema, indexes, and initial seed data
├── index.php                     # Main application entry point & PWA app shell
├── manifest.json                 # Web App Manifest for mobile installation
├── migrate.php                   # Web-based database migration & setup wizard
├── router.php                    # Built-in PHP CLI development server router
├── sw.js                         # Service Worker caching logic
├── README.md                     # GitHub project documentation
├── README_SHARED_HOSTING.md      # Detailed cPanel / Shared Hosting installation guide (Indonesian)
├── api/                          # RESTful JSON API endpoints
│   ├── agencies.php              # B2B Travel Agency partners & commission rates
│   ├── analytics.php             # Real-time PnL financial analysis & crew payroll
│   ├── auth.php                  # Authentication, session verification & logout
│   ├── health.php                # Database health and server diagnostics probe
│   ├── sync.php                  # Offline data synchronization endpoint
│   ├── templates.php             # Tour itinerary and package master templates
│   ├── trips.php                 # Core trip management and dispatch operations
│   └── workers.php               # Fleet crew, drivers, and photographers directory
├── assets/                       # Static public assets
│   ├── css/
│   │   └── app.css               # Clean Light Canvas UI design stylesheet
│   ├── icons/                    # PWA icons, favicons, and app logos
│   │   ├── apple-touch-icon.png
│   │   ├── favicon.png
│   │   ├── favicon.svg
│   │   ├── logo.png
│   │   ├── pwa-192x192.png
│   │   ├── pwa-512x512.png
│   │   ├── pwa-maskable-192x192.png
│   │   └── pwa-maskable-512x512.png
│   └── js/
│       ├── api.js                # HTTP client wrapper with LocalStorage fallback
│       ├── app.js                # Core UI interaction controller & state management
│       └── icons.js              # Standalone embedded SVG icon library
└── includes/                     # Backend core helper utilities
    ├── auth.php                  # Session guard and Role-Based Access Control (RBAC)
    ├── db.php                    # Singleton PDO connection wrapper
    └── helpers.php               # Data sanitizer, capacity calculator, and JSON utilities
```

---

## 🚀 Quick Start Guide

### Option 1: Local Development (PHP Built-in Server)

#### 1. Prerequisites
- **PHP** 7.4 or newer (with `pdo_mysql` extension enabled)
- **MySQL** 5.7+ or **MariaDB** 10.3+
- **Git**

#### 2. Clone the Repository
```bash
git clone https://github.com/your-username/panorama-super-app.git
cd panorama-super-app
```

#### 3. Configure Database Credentials
Edit `config.php` (or set environment variables):
```php
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'panorama_tour_db');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: 'your_password');
```

#### 4. Run the Built-in Server
Use `router.php` to handle extensionless API routing and static PWA assets:
```bash
php -S localhost:8000 router.php
```

#### 5. Execute 1-Click Database Migration
Open your browser and navigate to:
```
http://localhost:8000/migrate.php?action=run
```
The database and tables will be created automatically, and default seed accounts will be inserted.

After migration completes, access the application at `http://localhost:8000/`.

---

### Option 2: Shared Hosting Deployment (cPanel / DirectAdmin / Apache)

1. **Upload Files**: Upload the project directory to `public_html/` (or your subdomain folder) via cPanel File Manager or FTP.
2. **Create MySQL Database**: In cPanel, navigate to **MySQL® Databases** and create a new database and user. Assign **ALL PRIVILEGES**.
3. **Update `config.php`**: Set `DB_NAME`, `DB_USER`, and `DB_PASS` in `config.php`.
4. **Run Migration**: Open `https://yourdomain.com/migrate.php?action=run` in your browser.
5. **Security Cleanup**: Remove or restrict access to `migrate.php` after the initial setup.

> 📖 For detailed step-by-step instructions in Indonesian, see [README_SHARED_HOSTING.md](README_SHARED_HOSTING.md).

---

## 🔑 Default Demo Accounts

All seed accounts come pre-configured with the default PIN: **`123456`**.

| Username | Role | Full Name / Assigned Unit | Access Scope |
| :--- | :--- | :--- | :--- |
| **`admin`** | Administrator | Admin Panorama Operasional | Complete access: Dispatch, Analytics, PnL, Payroll, Agency B2B, Settings. |
| **`andi`** | Driver Jeep | Andi (Jeep Hardtop 4x4) | View assigned trips, guest count, and update duty status. |
| **`sait`** | Driver Jeep | Sait (Jeep Hardtop 4x4) | View assigned trips, guest count, and update duty status. |
| **`krisna`** | Driver Jeep | Krisna (Jeep Hardtop 4x4) | View assigned trips, guest count, and update duty status. |
| **`andri_jeep`** | Driver Jeep | Andri (Jeep Hardtop 4x4) | View assigned trips, guest count, and update duty status. |
| **`yoyok`** | Driver Lapangan | Yoyok (HiAce Shuttle / Innova) | Shuttle transfer schedules and passenger manifest. |
| **`didik_driver`** | Driver Lapangan | Didik Pranoto (HiAce Shuttle / Innova) | Shuttle transfer schedules and passenger manifest. |
| **`andri_driver`** | Driver Lapangan | Andri (HiAce Shuttle / Innova) | Shuttle transfer schedules and passenger manifest. |
| **`kurniatrans`** | Driver Lapangan | Kurnia Trans (Armada Shuttle Kurnia Trans) | External partner shuttle portal. |
| **`annur`** | Photographer | An-nur (Camera Kit & Dokumentasi) | Documentation portal: input & share cloud album links. |
| **`ferdy`** | Photographer | Ferdy (Camera Kit & Dokumentasi) | Documentation portal: input & share cloud album links. |
| **`andy`** | Photographer | Andy (Camera Kit & Dokumentasi) | Documentation portal: input & share cloud album links. |
| **`andri_photo`** | Photographer | Andri (Camera Kit & Dokumentasi) | Documentation portal: input & share cloud album links. |
| **`didik_photo`** | Photographer | Didik Pranoto (Camera Kit & Dokumentasi) | Documentation portal: input & share cloud album links. |

---

## 🔌 API Reference Overview

The application features a clean RESTful JSON API located under `/api/`:

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth.php?action=login` | `POST` | Public | Authenticates user with username & PIN; creates session. |
| `/api/auth.php?action=me` | `GET` | Authenticated | Retrieves current authenticated session user details. |
| `/api/auth.php?action=logout` | `POST` | Authenticated | Terminates user session. |
| `/api/trips.php` | `GET` | Authenticated | Lists trips (filtered automatically by worker role or full list for Admin). |
| `/api/trips.php` | `POST` | Admin | Creates a new operational trip with crew & vehicle assignments. |
| `/api/trips.php?id={id}` | `PUT` | Authenticated | Updates trip status, cloud photo URL, or operational details. |
| `/api/trips.php?id={id}` | `DELETE` | Admin | Deletes an existing trip record. |
| `/api/workers.php` | `GET` | Authenticated | Retrieves available drivers, photographers, and equipment units. |
| `/api/agencies.php` | `GET` | Admin | Lists B2B travel agency partners and commission percentages. |
| `/api/templates.php` | `GET` | Authenticated | Retrieves standard tour itinerary templates & itinerary stops. |
| `/api/analytics.php?type=pnl` | `GET` | Admin | Calculates revenue, expenses, agency commission, and net margin. |
| `/api/analytics.php?type=payroll` | `GET` | Admin | Aggregates crew payroll balance and trip fee breakdown. |
| `/api/analytics.php?action=mark_paid` | `POST` | Admin | Marks a crew member's trip payroll as settled/paid. |
| `/api/health.php` | `GET` | Public | Probes database connectivity and server runtime status. |
| `/api/sync.php` | `POST` | Authenticated | Syncs offline client actions with centralized database. |

---

## 🔒 Security Best Practices

1. **Prepared Statements**: All database operations use PDO prepared statements with parameter binding to prevent SQL injection.
2. **Strict RBAC Enforcement**: Role checks are enforced at the server API level in `includes/auth.php`. Sensitive financial data is never transmitted to driver or photographer sessions.
3. **Session Hardening**: Cookies are configured with `HttpOnly`, `SameSite=Lax`, and `Secure` flags.
4. **HTTP Security Headers**: `.htaccess` injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `X-XSS-Protection`.
5. **No Cache for Dynamic Assets**: Strict no-cache headers for `sw.js` and `manifest.json` guarantee that mobile devices always receive the latest version updates.

---

## 📱 Mobile PWA Installation Guide

- **Android (Chrome)**: Open the site in Chrome over HTTPS, then tap **"Add to Home screen"** or the in-app install prompt.
- **iOS (Safari)**: Open the site in Safari, tap the **Share** button (box with upward arrow), and select **"Add to Home Screen"**.

---

## 📄 License

This software is developed for **Panorama Tour & Travel Operations**. Distributed under the [MIT License](LICENSE) (or proprietary commercial license as designated by the organization).

---

*Copyright &copy; 2026 Panorama Tour Indonesia. All rights reserved.*