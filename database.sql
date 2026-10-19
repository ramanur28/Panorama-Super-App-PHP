-- =========================================================================
-- PANORAMA SUPER APP - PRODUCTION MYSQL RELATIONAL DATABASE SCHEMA
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+, cPanel phpMyAdmin
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =========================================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE,
  email VARCHAR(128) UNIQUE,
  phone VARCHAR(32) NOT NULL,
  pin VARCHAR(64) NOT NULL DEFAULT '123456',
  name VARCHAR(128) NOT NULL,
  role ENUM('admin', 'driver_jeep', 'driver_lapangan', 'photographer', 'guide') NOT NULL,
  type ENUM('internal', 'external') NOT NULL DEFAULT 'internal',
  vehicle_unit VARCHAR(128) DEFAULT NULL,
  avatar VARCHAR(512) DEFAULT NULL,
  base_rate_per_trip DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_phone (phone),
  INDEX idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agencies (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) UNIQUE NOT NULL,
  contact_person VARCHAR(128) DEFAULT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(128) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agencies_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS itinerary_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category ENUM('bromo_sunrise', 'milky_way', 'custom_trip', 'open_trip') NOT NULL DEFAULT 'bromo_sunrise',
  duration VARCHAR(64) NOT NULL DEFAULT '12 Jam',
  description TEXT DEFAULT NULL,
  default_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_templates_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS itinerary_stops (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  title VARCHAR(128) NOT NULL,
  time_estimate VARCHAR(64) NOT NULL,
  activity_description TEXT DEFAULT NULL,
  operational_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES itinerary_templates(id) ON DELETE CASCADE,
  INDEX idx_stops_template (template_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trips (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  date DATE NOT NULL,
  time_slot VARCHAR(64) NOT NULL,
  guest_name VARCHAR(128) NOT NULL,
  guest_count INT NOT NULL DEFAULT 1,
  guest_phone VARCHAR(32) NOT NULL,
  pickup_point VARCHAR(255) NOT NULL,
  notes TEXT DEFAULT NULL,
  package_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  tour_package VARCHAR(128) NOT NULL,
  
  -- Relasi Agen
  agency_id VARCHAR(64) DEFAULT NULL,
  agency_name VARCHAR(128) DEFAULT NULL,
  agency_payment_status ENUM('paid', 'unpaid', 'deposit') NOT NULL DEFAULT 'unpaid',
  deposit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  
  -- Penugasan Driver Jeep
  jeep_driver_id VARCHAR(64) DEFAULT NULL,
  jeep_driver_name VARCHAR(128) DEFAULT NULL,
  jeep_unit VARCHAR(128) DEFAULT NULL,
  jeep_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  jeep_status ENUM('standby', 'en_route', 'completed') NOT NULL DEFAULT 'standby',
  jeep_payroll_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  
  -- Penugasan Driver Shuttle / Lapangan
  field_driver_id VARCHAR(64) DEFAULT NULL,
  field_driver_name VARCHAR(128) DEFAULT NULL,
  field_driver_unit VARCHAR(128) DEFAULT NULL,
  field_driver_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  field_driver_status ENUM('standby', 'picked_up', 'completed') NOT NULL DEFAULT 'standby',
  field_payroll_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  
  -- Penugasan Fotografer
  photographer_id VARCHAR(64) DEFAULT NULL,
  photographer_name VARCHAR(128) DEFAULT NULL,
  photographer_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  photographer_status ENUM('assigned', 'shooting', 'uploaded') NOT NULL DEFAULT 'assigned',
  photographer_payroll_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  photo_album_url VARCHAR(512) DEFAULT NULL,
  
  -- Penugasan Guide (Opsional)
  guide_name VARCHAR(128) DEFAULT NULL,
  guide_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  guide_payroll_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  
  -- Rincian Biaya Operasional & Itinerary
  operational_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  itinerary_template_id VARCHAR(64) DEFAULT NULL,
  trip_status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  cancellation_reason TEXT DEFAULT NULL,
  raw_itinerary JSON DEFAULT NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_trips_date (date),
  INDEX idx_trips_status (trip_status),
  INDEX idx_trips_jeep (jeep_driver_id),
  INDEX idx_trips_field (field_driver_id),
  INDEX idx_trips_photo (photographer_id),
  INDEX idx_trips_agency (agency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  trip_id VARCHAR(64) DEFAULT NULL,
  user_id VARCHAR(64) DEFAULT NULL,
  action VARCHAR(64) NOT NULL,
  details JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_trip (trip_id),
  INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- =========================================================================
-- SEED DATA: USERS (Admin & Kru Operasional)
-- =========================================================================
INSERT INTO users (id, username, email, phone, pin, name, role, type, vehicle_unit, avatar, base_rate_per_trip, is_available)
VALUES
('w-admin-1', 'admin', 'admin@panoramatour.com', '0811-0011-2233', '123456', 'Admin Panorama Operasional', 'admin', 'internal', NULL, NULL, 0.00, 1),
('w-jeep-andi', 'andi', 'andi@panoramatour.com', '0823-7701-3001', '123456', 'Andi', 'driver_jeep', 'internal', 'Jeep Hardtop 4x4', NULL, 250000.00, 1),
('w-jeep-sait', 'sait', 'sait@panoramatour.com', '0823-7701-3002', '123456', 'Sait', 'driver_jeep', 'internal', 'Jeep Hardtop 4x4', NULL, 250000.00, 1),
('w-jeep-krisna', 'krisna', 'krisna@panoramatour.com', '0823-7701-3003', '123456', 'Krisna', 'driver_jeep', 'internal', 'Jeep Hardtop 4x4', NULL, 250000.00, 1),
('w-jeep-andri', 'andri_jeep', 'andri.jeep@panoramatour.com', '0823-7701-3004', '123456', 'Andri', 'driver_jeep', 'internal', 'Jeep Hardtop 4x4', NULL, 250000.00, 1),
('w-field-yoyok', 'yoyok', 'yoyok@panoramatour.com', '0821-5501-1001', '123456', 'Yoyok', 'driver_lapangan', 'internal', 'HiAce Shuttle / Innova', NULL, 175000.00, 1),
('w-field-didik', 'didik_driver', 'didik.driver@panoramatour.com', '0821-5501-1002', '123456', 'Didik Pranoto', 'driver_lapangan', 'internal', 'HiAce Shuttle / Innova', NULL, 175000.00, 1),
('w-field-andri', 'andri_driver', 'andri.driver@panoramatour.com', '0821-5501-1003', '123456', 'Andri', 'driver_lapangan', 'internal', 'HiAce Shuttle / Innova', NULL, 175000.00, 1),
('w-field-kurniatrans', 'kurniatrans', 'kurniatrans@panoramatour.com', '0821-5501-1004', '123456', 'Kurnia Trans', 'driver_lapangan', 'external', 'Armada Shuttle Kurnia Trans', NULL, 200000.00, 1),
('w-photo-annur', 'annur', 'annur@panoramatour.com', '0822-6601-2001', '123456', 'An-nur', 'photographer', 'internal', 'Camera Kit & Dokumentasi', NULL, 200000.00, 1),
('w-photo-ferdy', 'ferdy', 'ferdy@panoramatour.com', '0822-6601-2002', '123456', 'Ferdy', 'photographer', 'internal', 'Camera Kit & Dokumentasi', NULL, 200000.00, 1),
('w-photo-andy', 'andy', 'andy@panoramatour.com', '0822-6601-2003', '123456', 'Andy', 'photographer', 'internal', 'Camera Kit & Dokumentasi', NULL, 200000.00, 1),
('w-photo-andri', 'andri_photo', 'andri.photo@panoramatour.com', '0822-6601-2004', '123456', 'Andri', 'photographer', 'internal', 'Camera Kit & Dokumentasi', NULL, 200000.00, 1),
('w-photo-didik', 'didik_photo', 'didik.photo@panoramatour.com', '0822-6601-2005', '123456', 'Didik Pranoto', 'photographer', 'internal', 'Camera Kit & Dokumentasi', NULL, 200000.00, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), role = VALUES(role), phone = VALUES(phone),
  vehicle_unit = VALUES(vehicle_unit), base_rate_per_trip = VALUES(base_rate_per_trip);

-- =========================================================================
-- SEED DATA: AGENCIES (Default Mitra Direct / Non-Agen)
-- =========================================================================
INSERT INTO agencies (id, name, code, contact_person, phone, email, address)
VALUES
('ag-direct', 'Tamu Mandiri (Direct / Walk-In)', 'DIRECT', 'Front Desk', '0812-0000-1111', 'booking@panoramatour.com', 'Kantor Operasional Sukapura')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), code = VALUES(code), contact_person = VALUES(contact_person),
  phone = VALUES(phone);

-- =========================================================================
-- SEED DATA: ITINERARY TEMPLATES
-- =========================================================================
INSERT INTO itinerary_templates (id, name, category, duration, description, default_price)
VALUES
('tpl-1', 'Bromo Sunrise Classic 4 Spot', 'bromo_sunrise', '12 Jam (00:00 - 12:00)', 'Paket favorit: Penanjakan 1, Kawah Bromo, Pasir Berbisik, dan Bukit Teletubbies.', 1750000.00),
('tpl-2', 'Bromo Milky Way Photography Night', 'milky_way', '14 Jam (21:00 - 11:00)', 'Tur khusus fotografer bintang galaksi Bima Sakti dengan spot Kingkong Hill & Lautan Pasir.', 2400000.00)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), duration = VALUES(duration), description = VALUES(description), default_price = VALUES(default_price);

-- =========================================================================
-- SEED DATA: ITINERARY STOPS
-- =========================================================================
INSERT INTO itinerary_stops (id, template_id, order_index, title, time_estimate, activity_description, operational_fee)
VALUES
('stop-1-1', 'tpl-1', 1, 'Penjemputan Tamu di Hotel', '00:00 - 00:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Armada shuttle / BBM", "ticketCost": 0, "hotelCost": 0, "notes": "Briefing rute dan pengecekan jaket tebal"}', 0.00),
('stop-1-2', 'tpl-1', 2, 'Transit Pos Jeep Sukapura', '01:30 - 02:00 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Pindah ke Armada Jeep 4x4", "ticketCost": 0, "hotelCost": 0, "notes": "Transit di pos istirahat Sukapura"}', 0.00),
('stop-1-3', 'tpl-1', 3, 'Golden Sunrise Penanjakan 1', '03:30 - 06:00 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "bromo_sunrise", "hotelName": "", "operationalDesc": "Sewa Jeep Hardtop 4x4", "ticketCost": 0, "hotelCost": 0, "notes": "Menikmati golden sunrise kaldera Bromo & Semeru"}', 0.00),
('stop-1-4', 'tpl-1', 4, 'Kawah Bromo & Pura Luhur Poten', '06:30 - 08:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "spot_wisata", "hotelName": "", "operationalDesc": "Guide lokal / tiket kawasan", "ticketCost": 0, "hotelCost": 0, "notes": "Trekking lautan pasir dan tangga kawah Bromo"}', 0.00),
('stop-1-5', 'tpl-1', 5, 'Pasir Berbisik & Savana Teletubbies', '09:00 - 10:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "spot_wisata", "hotelName": "", "operationalDesc": "Dokumentasi spot foto", "ticketCost": 0, "hotelCost": 0, "notes": "Sesi foto dokumentasi dan santai"}', 0.00),
('stop-1-6', 'tpl-1', 6, 'Perjalanan Pulang ke Hotel Tamu', '11:00 - 12:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Shuttle drop off / BBM", "ticketCost": 0, "hotelCost": 0, "notes": "Drop off tamu di Malang / Batu"}', 0.00),
('stop-2-1', 'tpl-2', 1, 'Penjemputan Malam di Hotel', '20:30 - 21:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Hunting Milky Way", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Armada malam / BBM", "ticketCost": 0, "hotelCost": 0, "notes": "Persiapan gear fotografi & drone malam"}', 0.00),
('stop-2-2', 'tpl-2', 2, 'Hunting Milky Way Kingkong Hill', '23:00 - 03:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Hunting Milky Way", "activityType": "milky_way", "hotelName": "", "operationalDesc": "Jeep 4x4 & astro lighting", "ticketCost": 0, "hotelCost": 0, "notes": "Sesi foto bintang galaksi dengan lampu khusus"}', 0.00),
('stop-2-3', 'tpl-2', 3, 'Golden Hour Sunrise & Kawah Bromo', '04:30 - 08:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Hunting Milky Way", "activityType": "bromo_sunrise", "hotelName": "", "operationalDesc": "Jeep 4x4 sunrise session", "ticketCost": 0, "hotelCost": 0, "notes": "Sunrise spektakuler dan pemotretan kaldera"}', 0.00)
ON DUPLICATE KEY UPDATE
  title = VALUES(title), time_estimate = VALUES(time_estimate), activity_description = VALUES(activity_description), operational_fee = VALUES(operational_fee);

-- =========================================================================
