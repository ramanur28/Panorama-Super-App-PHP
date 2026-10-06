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
-- SEED DATA: USERS (Karyawan Tetap & Mitra Lepas)
-- =========================================================================
INSERT INTO users (id, username, email, phone, pin, name, role, type, vehicle_unit, avatar, base_rate_per_trip, is_available)
VALUES
('w-admin-1', 'admin', 'admin@panoramatour.com', '0811-0011-2233', '123456', 'Admin Panorama Operasional', 'admin', 'internal', NULL, NULL, 0.00, 1),
('w-jeep-1', 'budi', 'budi@panoramatour.com', '0812-3344-5561', '123456', 'Budi Santoso', 'driver_jeep', 'internal', 'Jeep 01 (Hardtop N 1045 AB)', NULL, 250000.00, 1),
('w-jeep-2', 'slamet', 'slamet@panoramatour.com', '0813-2211-9988', '123456', 'Pak Slamet Riyadi', 'driver_jeep', 'internal', 'Jeep 04 (Hardtop N 7182 XY)', NULL, 250000.00, 1),
('w-jeep-3', 'joko', 'joko@panoramatour.com', '0857-4433-2211', '123456', 'Joko Waluyo (Mitra Luar)', 'driver_jeep', 'external', 'Jeep 12 (Hardtop N 9921 KL)', NULL, 300000.00, 1),
('w-field-1', 'rian', 'rian@panoramatour.com', '0821-6677-8899', '123456', 'Rian Hidayat', 'driver_lapangan', 'internal', 'HiAce Shuttle 02 (N 7788 OP)', NULL, 175000.00, 1),
('w-field-2', 'agus', 'agus@panoramatour.com', '0819-3344-1122', '123456', 'Agus Setiawan (Sewa)', 'driver_lapangan', 'external', 'Innova Reborn (N 1122 TR)', NULL, 200000.00, 1),
('w-photo-1', 'dimas', 'dimas@panoramatour.com', '0812-9988-7766', '123456', 'Dimas Anggara', 'photographer', 'internal', 'Sony A7 IV + Lens Kit', NULL, 200000.00, 1),
('w-photo-2', 'fajar', 'fajar@panoramatour.com', '0878-5544-3322', '123456', 'Fajar Snap (Freelance)', 'photographer', 'external', 'Canon R6 + Drone Mini 4', NULL, 250000.00, 1),
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
-- SEED DATA: AGENCIES (Mitra Agen B2B)
-- =========================================================================
INSERT INTO agencies (id, name, code, contact_person, phone, email, address)
VALUES
('ag-direct', 'Tamu Mandiri (Direct / Walk-In)', 'DIRECT', 'Front Desk', '0812-0000-1111', 'booking@panoramatour.com', 'Kantor Operasional Sukapura'),
('ag-1', 'Nusantara Tour & Travel', 'AG-01', 'Ibu Rina', '0812-3322-1100', 'rina@nusantaratour.com', 'Jl. Ijen No. 45, Malang'),
('ag-2', 'Bromo Explorer Agency', 'AG-02', 'Bpk. Doni', '0821-4455-6677', 'ops@bromoexplorer.id', 'Jl. Basuki Rahmat 12, Surabaya'),
('ag-3', 'Java Heritage Trip', 'AG-03', 'Mbak Citra', '0856-7788-9900', 'hello@javatrip.com', 'Jl. Malioboro No. 10, Yogyakarta')
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
('stop-1-2', 'tpl-1', 2, 'Transit Pos Jeep Sukapura', '01:30 - 02:00 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Pindah ke Armada Jeep 4x4", "ticketCost": 0, "hotelCost": 0, "notes": "Transit di pos istirahat Sukapura"}', 50000.00),
('stop-1-3', 'tpl-1', 3, 'Golden Sunrise Penanjakan 1', '03:30 - 06:00 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "bromo_sunrise", "hotelName": "", "operationalDesc": "Sewa Jeep Hardtop 4x4", "ticketCost": 54000, "hotelCost": 0, "notes": "Menikmati golden sunrise kaldera Bromo & Semeru"}', 120000.00),
('stop-1-4', 'tpl-1', 4, 'Kawah Bromo & Pura Luhur Poten', '06:30 - 08:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "spot_wisata", "hotelName": "", "operationalDesc": "Guide lokal / tiket kawasan", "ticketCost": 0, "hotelCost": 0, "notes": "Trekking lautan pasir dan tangga kawah Bromo"}', 30000.00),
('stop-1-5', 'tpl-1', 5, 'Pasir Berbisik & Savana Teletubbies', '09:00 - 10:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "spot_wisata", "hotelName": "", "operationalDesc": "Dokumentasi spot foto", "ticketCost": 0, "hotelCost": 0, "notes": "Sesi foto dokumentasi dan santai"}', 50000.00),
('stop-1-6', 'tpl-1', 6, 'Perjalanan Pulang ke Hotel Tamu', '11:00 - 12:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Eksplorasi Bromo", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Shuttle drop off / BBM", "ticketCost": 0, "hotelCost": 0, "notes": "Drop off tamu di Malang / Batu"}', 0.00),
('stop-2-1', 'tpl-2', 1, 'Penjemputan Malam di Hotel', '20:30 - 21:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Hunting Milky Way", "activityType": "shuttle_transfer", "hotelName": "", "operationalDesc": "Armada malam / BBM", "ticketCost": 0, "hotelCost": 0, "notes": "Persiapan gear fotografi & drone malam"}', 0.00),
('stop-2-2', 'tpl-2', 2, 'Hunting Milky Way Kingkong Hill', '23:00 - 03:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Hunting Milky Way", "activityType": "milky_way", "hotelName": "", "operationalDesc": "Jeep 4x4 & astro lighting", "ticketCost": 54000, "hotelCost": 0, "notes": "Sesi foto bintang galaksi dengan lampu khusus"}', 150000.00),
('stop-2-3', 'tpl-2', 3, 'Golden Hour Sunrise & Kawah Bromo', '04:30 - 08:30 WIB', '{"day": 1, "dayTitle": "Hari 1 - Hunting Milky Way", "activityType": "bromo_sunrise", "hotelName": "", "operationalDesc": "Jeep 4x4 sunrise session", "ticketCost": 0, "hotelCost": 0, "notes": "Sunrise spektakuler dan pemotretan kaldera"}', 150000.00)
ON DUPLICATE KEY UPDATE
  title = VALUES(title), time_estimate = VALUES(time_estimate), activity_description = VALUES(activity_description), operational_fee = VALUES(operational_fee);

-- =========================================================================
-- SEED DATA: TRIPS (9 Realistis Trip)
-- =========================================================================
INSERT INTO trips (
  id, code, date, time_slot, guest_name, guest_count, guest_phone, pickup_point, notes,
  package_price, tour_package, agency_id, agency_name, agency_payment_status, deposit_amount,
  jeep_driver_id, jeep_driver_name, jeep_unit, jeep_fee, jeep_status, jeep_payroll_status,
  field_driver_id, field_driver_name, field_driver_unit, field_driver_fee, field_driver_status, field_payroll_status,
  photographer_id, photographer_name, photographer_fee, photographer_status, photographer_payroll_status, photo_album_url,
  operational_cost, itinerary_template_id, trip_status, raw_itinerary
) VALUES
('trip-1', 'PNR-260917-01', '2026-09-17', '02:00 WIB (Sunrise)', 'Bpk. Hendra & Keluarga (Jakarta)', 4, '0812-9988-7711', 'Lobby Hotel Tugu Malang', 'Bawa selimut ekstra & jaket tebal',
 1750000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-1', 'Nusantara Tour & Travel', 'paid', 1750000.00,
 'w-jeep-1', 'Budi Santoso', 'Jeep 01 (Hardtop N 1045 AB)', 250000.00, 'completed', 'paid',
 'w-field-1', 'Rian Hidayat', 'HiAce Shuttle 02 (N 7788 OP)', 175000.00, 'completed', 'paid',
 'w-photo-1', 'Dimas Anggara', 200000.00, 'uploaded', 'paid', 'https://drive.google.com/drive/folders/demo-album-bromo-01',
 250000.00, 'tpl-1', 'completed',
 '[{"id":"it-1","time":"02:00 WIB","title":"Penjemputan Hotel","location":"Malang","operationalCost":0},{"id":"it-2","time":"04:00 WIB","title":"Sunrise Penanjakan 1","location":"Penanjakan","operationalCost":120000},{"id":"it-3","time":"06:30 WIB","title":"Kawah Bromo","location":"Lautan Pasir","operationalCost":30000},{"id":"it-4","time":"08:30 WIB","title":"Savana Teletubbies","location":"Savana Bromo","operationalCost":50000}]'),

('trip-2', 'PNR-260917-02', '2026-09-17', '21:00 WIB (Milky Way)', 'Ms. Sarah Jenkins (Australia)', 2, '0813-7766-5544', 'Grand Mercure Malang Mirama', 'Tripod profesional & lensa wide siap',
 2400000.00, 'Bromo Milky Way Photography Night', 'ag-2', 'Bromo Explorer Agency', 'unpaid', 0.00,
 'w-jeep-2', 'Pak Slamet Riyadi', 'Jeep 04 (Hardtop N 7182 XY)', 250000.00, 'en_route', 'unpaid',
 'w-field-2', 'Agus Setiawan (Sewa)', 'Innova Reborn (N 1122 TR)', 200000.00, 'picked_up', 'unpaid',
 'w-photo-2', 'Fajar Snap (Freelance)', 250000.00, 'shooting', 'unpaid', NULL,
 300000.00, 'tpl-2', 'in_progress',
 '[{"id":"it-1","time":"21:00 WIB","title":"Penjemputan Tamu","location":"Grand Mercure","operationalCost":0},{"id":"it-2","time":"23:30 WIB","title":"Milky Way Session","location":"Kingkong Hill","operationalCost":150000},{"id":"it-3","time":"04:30 WIB","title":"Golden Sunrise","location":"Penanjakan 1","operationalCost":150000}]'),

('trip-3', 'PNR-260917-03', '2026-09-17', '02:00 WIB (Sunrise)', 'Rombongan PT Caesar Mulia (Surabaya)', 6, '0857-1122-3344', 'Hotel Santika Premiere Malang', 'Butuh driver jeep berpengalaman spot curam',
 2100000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-3', 'Java Heritage Trip', 'deposit', 1000000.00,
 'w-jeep-3', 'Joko Waluyo (Mitra Luar)', 'Jeep 12 (Hardtop N 9921 KL)', 300000.00, 'standby', 'unpaid',
 'w-field-1', 'Rian Hidayat', 'HiAce Shuttle 02 (N 7788 OP)', 175000.00, 'standby', 'unpaid',
 'w-photo-1', 'Dimas Anggara', 200000.00, 'assigned', 'unpaid', NULL,
 280000.00, 'tpl-1', 'scheduled',
 '[{"id":"it-1","time":"02:00 WIB","title":"Penjemputan Tamu","location":"Hotel Santika","operationalCost":0},{"id":"it-2","time":"04:30 WIB","title":"Sunrise Penanjakan 1","location":"Penanjakan 1","operationalCost":150000},{"id":"it-3","time":"07:00 WIB","title":"Kawah Bromo & Savana","location":"Bromo","operationalCost":80000}]'),

('trip-4', 'PNR-260918-01', '2026-09-18', '02:00 WIB (Sunrise)', 'Bpk. Andre Wijaya (Bandung)', 3, '0812-4455-6677', 'Lobby Ijen Suites Resort Malang', 'Tamu minta foto keluarga di pasir berbisik',
 1850000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-direct', 'Tamu Mandiri (Direct / Walk-In)', 'paid', 1850000.00,
 'w-jeep-1', 'Budi Santoso', 'Jeep 01 (Hardtop N 1045 AB)', 250000.00, 'standby', 'unpaid',
 'w-field-1', 'Rian Hidayat', 'HiAce Shuttle 02 (N 7788 OP)', 175000.00, 'standby', 'unpaid',
 'w-photo-1', 'Dimas Anggara', 200000.00, 'assigned', 'unpaid', NULL,
 220000.00, 'tpl-1', 'scheduled',
 '[{"id":"it-1","time":"02:00 WIB","title":"Penjemputan","location":"Ijen Suites","operationalCost":0},{"id":"it-2","time":"04:15 WIB","title":"Sunrise Penanjakan","location":"Penanjakan","operationalCost":110000}]'),

('trip-5', 'PNR-260918-02', '2026-09-18', '08:00 WIB (Pagi)', 'Keluarga Bpk. Hartono (Semarang)', 5, '0813-8899-0011', 'Basecamp Sukapura Bromo', 'Tamu langsung ketemu di basecamp Sukapura',
 1500000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-1', 'Nusantara Tour & Travel', 'unpaid', 0.00,
 'w-jeep-2', 'Pak Slamet Riyadi', 'Jeep 04 (Hardtop N 7182 XY)', 250000.00, 'standby', 'unpaid',
 NULL, NULL, NULL, 0.00, 'standby', 'unpaid',
 'w-photo-2', 'Fajar Snap (Freelance)', 250000.00, 'assigned', 'unpaid', NULL,
 180000.00, 'tpl-1', 'scheduled',
 '[{"id":"it-1","time":"08:00 WIB","title":"Kumpul Basecamp","location":"Sukapura","operationalCost":0},{"id":"it-2","time":"09:00 WIB","title":"Kawah Bromo & Lautan Pasir","location":"Lautan Pasir","operationalCost":100000}]'),

('trip-6', 'PNR-260918-03', '2026-09-18', '21:00 WIB (Milky Way)', 'Mr. Kenji Sato & Rekan (Jepang)', 2, '+81 90 1234 5678', 'The Shalimar Boutique Hotel Malang', 'Suka spot Bukit Cinta & Savana malam',
 2500000.00, 'Bromo Milky Way Photography Night', 'ag-2', 'Bromo Explorer Agency', 'paid', 2500000.00,
 'w-jeep-3', 'Joko Waluyo (Mitra Luar)', 'Jeep 12 (Hardtop N 9921 KL)', 300000.00, 'standby', 'unpaid',
 'w-field-2', 'Agus Setiawan (Sewa)', 'Innova Reborn (N 1122 TR)', 200000.00, 'standby', 'unpaid',
 'w-photo-1', 'Dimas Anggara', 200000.00, 'assigned', 'unpaid', NULL,
 350000.00, 'tpl-2', 'scheduled',
 '[{"id":"it-1","time":"21:00 WIB","title":"Penjemputan Tamu","location":"Shalimar Hotel","operationalCost":0},{"id":"it-2","time":"23:30 WIB","title":"Milky Way Session","location":"Bukit Cinta","operationalCost":170000}]'),

('trip-7', 'PNR-260919-01', '2026-09-19', '02:00 WIB (Sunrise)', 'Ibu Anita & Teman Kantor (Jakarta)', 4, '0812-7788-9900', 'Swiss-Belinn Malang', 'Minta sarapan box disiapkan di Jeep',
 1900000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-3', 'Java Heritage Trip', 'deposit', 500000.00,
 'w-jeep-1', 'Budi Santoso', 'Jeep 01 (Hardtop N 1045 AB)', 250000.00, 'standby', 'unpaid',
 'w-field-1', 'Rian Hidayat', 'HiAce Shuttle 02 (N 7788 OP)', 175000.00, 'standby', 'unpaid',
 'w-photo-2', 'Fajar Snap (Freelance)', 250000.00, 'assigned', 'unpaid', NULL,
 260000.00, 'tpl-1', 'scheduled',
 '[{"id":"it-1","time":"02:00 WIB","title":"Penjemputan","location":"Swiss-Belinn","operationalCost":0},{"id":"it-2","time":"04:30 WIB","title":"Sunrise Penanjakan","location":"Penanjakan","operationalCost":130000}]'),

('trip-8', 'PNR-260919-02', '2026-09-19', '02:00 WIB (Sunrise)', 'Keluarga Bpk. Rudi (Surabaya)', 4, '0811-3322-4455', 'Hotel Harris Malang', 'Tamu bawa balita, tempo santai',
 1800000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-direct', 'Tamu Mandiri (Direct / Walk-In)', 'paid', 1850000.00,
 'w-jeep-2', 'Pak Slamet Riyadi', 'Jeep 04 (Hardtop N 7182 XY)', 250000.00, 'standby', 'unpaid',
 'w-field-2', 'Agus Setiawan (Sewa)', 'Innova Reborn (N 1122 TR)', 200000.00, 'standby', 'unpaid',
 NULL, NULL, 0.00, 'assigned', 'unpaid', NULL,
 200000.00, 'tpl-1', 'scheduled',
 '[{"id":"it-1","time":"02:00 WIB","title":"Penjemputan","location":"Hotel Harris","operationalCost":0},{"id":"it-2","time":"04:30 WIB","title":"Sunrise Bromo","location":"Penanjakan","operationalCost":110000}]'),

('trip-9', 'PNR-260916-01', '2026-09-16', '02:00 WIB (Sunrise)', 'Ms. Claire Dupont (Perancis)', 2, '+33 6 12 34 56 78', 'Hotel Tugu Malang', 'Cuaca badai abu vulkanik lokal, trip dibatalkan sesuai SOP keselamatan TNBTS',
 1650000.00, 'Bromo Sunrise Classic 4 Spot', 'ag-1', 'Nusantara Tour & Travel', 'unpaid', 0.00,
 'w-jeep-1', 'Budi Santoso', 'Jeep 01 (Hardtop N 1045 AB)', 0.00, 'standby', 'unpaid',
 'w-field-1', 'Rian Hidayat', 'HiAce Shuttle 02 (N 7788 OP)', 0.00, 'standby', 'unpaid',
 'w-photo-1', 'Dimas Anggara', 0.00, 'assigned', 'unpaid', NULL,
 0.00, 'tpl-1', 'cancelled',
 '[]')
ON DUPLICATE KEY UPDATE
  guest_name = VALUES(guest_name), trip_status = VALUES(trip_status),
  package_price = VALUES(package_price), operational_cost = VALUES(operational_cost);
