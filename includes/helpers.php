<?php
/**
 * Panorama Super App - Helper Utilities
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

function json_response($data, int $statusCode = 200): void {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        http_response_code($statusCode);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return $_POST ?: [];
}

function sanitize_string(?string $str): string {
    return htmlspecialchars(trim((string)$str), ENT_QUOTES, 'UTF-8');
}

function map_user_row(array $u): array {
    return [
        'id' => $u['id'],
        'name' => $u['name'],
        'role' => $u['role'],
        'type' => $u['type'],
        'phone' => $u['phone'],
        'username' => $u['username'],
        'email' => $u['email'],
        'vehicleUnit' => $u['vehicle_unit'],
        'avatar' => $u['avatar'] ?? null,
        'baseRatePerTrip' => (float)$u['base_rate_per_trip'],
        'isAvailable' => (bool)$u['is_available']
    ];
}

function check_worker_capacity(string $workerId, string $workerName, string $date, string $timeSlot, ?string $excludeTripId = null): array {
    $sql = "
        SELECT COUNT(*) as count FROM trips
        WHERE trip_status != 'cancelled'
          AND date = ?
          AND time_slot = ?
          AND (jeep_driver_id = ? OR field_driver_id = ? OR photographer_id = ?)
    ";
    $params = [$date, $timeSlot, $workerId, $workerId, $workerId];

    if ($excludeTripId) {
        $sql .= " AND id != ?";
        $params[] = $excludeTripId;
    }

    $res = db_query($sql, $params);
    $activeTripsCount = (int)($res[0]['count'] ?? 0);

    if ($activeTripsCount >= 2) {
        return [
            'ok' => false,
            'message' => "Kru {$workerName} sudah memiliki {$activeTripsCount} trip aktif pada {$date} ({$timeSlot}). Kapasitas maksimal adalah 2 trip bersamaan."
        ];
    }

    return ['ok' => true, 'count' => $activeTripsCount];
}

function map_trip_row(array $r, ?string $viewerRole = null, ?string $viewerId = null): array {
    $isDriverJeep = ($viewerRole === 'driver_jeep');
    $isDriverLapangan = ($viewerRole === 'driver_lapangan');
    $isPhotographer = ($viewerRole === 'photographer');
    $isGuide = ($viewerRole === 'guide');
    $isFieldRole = ($isDriverJeep || $isDriverLapangan || $isPhotographer || $isGuide);

    $parsedItinerary = [];
    if (!empty($r['raw_itinerary'])) {
        $decoded = is_string($r['raw_itinerary']) ? json_decode($r['raw_itinerary'], true) : $r['raw_itinerary'];
        $parsedItinerary = is_array($decoded) ? $decoded : [];
    }

    if ($isFieldRole) {
        $sanitizedItinerary = array_map(function($item) {
            return [
                'id' => $item['id'] ?? '',
                'day' => (int)($item['day'] ?? 1),
                'dayTitle' => $item['dayTitle'] ?? ('Hari ' . ($item['day'] ?? 1)),
                'activityType' => $item['activityType'] ?? 'spot_wisata',
                'hotelName' => $item['hotelName'] ?? '',
                'time' => $item['time'] ?? '',
                'title' => $item['title'] ?? '',
                'location' => $item['location'] ?? 'Spot Wisata Bromo',
                'description' => $item['description'] ?? '',
                'notes' => $item['notes'] ?? '',
                'operationalDesc' => $item['operationalDesc'] ?? '',
                'dayFieldDriverId' => $item['dayFieldDriverId'] ?? null,
                'dayFieldDriverName' => $item['dayFieldDriverName'] ?? null,
                'dayFieldDriverUnit' => $item['dayFieldDriverUnit'] ?? null,
                'jeepDriverId' => $item['jeepDriverId'] ?? null,
                'jeepDriverName' => $item['jeepDriverName'] ?? null,
                'jeepUnit' => $item['jeepUnit'] ?? null
            ];
        }, $parsedItinerary);
    } else {
        $sanitizedItinerary = $parsedItinerary;
    }

    $trip = [
        'id' => $r['id'],
        'code' => $r['code'],
        'date' => $r['date'],
        'timeSlot' => $r['time_slot'],
        'guestName' => $r['guest_name'],
        'guestCount' => (int)$r['guest_count'],
        'guestPhone' => $r['guest_phone'],
        'pickupPoint' => $r['pickup_point'],
        'notes' => $r['notes'] ?? '',
        'tourPackage' => $r['tour_package'],
        'tripStatus' => $r['trip_status'],
        'cancellationReason' => $r['cancellation_reason'],
        'itineraryTemplateId' => $r['itinerary_template_id'],
        'itinerary' => $sanitizedItinerary,
        'updatedAt' => $r['updated_at'] ?? $r['created_at'],

        // Kru Jeep
        'jeepDriverId' => $r['jeep_driver_id'],
        'jeepDriverName' => $r['jeep_driver_name'] ?? '',
        'jeepUnit' => $r['jeep_unit'] ?? '',
        'jeepStatus' => $r['jeep_status'] ?? 'internal',

        // Kru Lapangan
        'fieldDriverId' => $r['field_driver_id'],
        'fieldDriverName' => $r['field_driver_name'] ?? '',
        'fieldDriverUnit' => $r['field_driver_unit'] ?? '',
        'fieldDriverStatus' => $r['field_driver_status'] ?? 'internal',

        // Fotografer
        'photographerId' => $r['photographer_id'],
        'photographerName' => $r['photographer_name'] ?? '',
        'photographerStatus' => $r['photographer_status'] ?? 'internal',
        'photoAlbumUrl' => $r['photo_album_url'] ?? '',
        'guideName' => $r['guide_name'] ?? '',
    ];

    if (!$isFieldRole) {
        $trip['packagePrice'] = (float)$r['package_price'];
        $trip['agencyId'] = $r['agency_id'];
        $trip['agencyName'] = $r['agency_name'];
        $status = $r['agency_payment_status'] ?? 'unpaid';
        $trip['agencyPaymentStatus'] = $status;

        $pkgPrice = (float)$r['package_price'];
        $dep = (float)($r['deposit_amount'] ?? 0);
        if ($status === 'paid') {
            $dep = $pkgPrice;
            $rem = 0.0;
        } elseif ($status === 'deposit') {
            $rem = max(0.0, $pkgPrice - $dep);
        } else {
            $dep = 0.0;
            $rem = $pkgPrice;
        }
        $trip['depositAmount'] = $dep;
        $trip['remainingBalance'] = $rem;
        $trip['operationalCost'] = (float)$r['operational_cost'];

        $trip['jeepFee'] = (float)$r['jeep_fee'];
        $trip['jeepPayrollStatus'] = $r['jeep_payroll_status'];

        $trip['fieldDriverFee'] = (float)$r['field_driver_fee'];
        $trip['fieldPayrollStatus'] = $r['field_payroll_status'];

        $trip['photographerFee'] = (float)$r['photographer_fee'];
        $trip['photographerPayrollStatus'] = $r['photographer_payroll_status'];
        $trip['guideFee'] = (float)($r['guide_fee'] ?? 0);
        $trip['guidePayrollStatus'] = $r['guide_payroll_status'] ?? 'unpaid';
    } else {
        if ($isDriverJeep) {
            $trip['jeepFee'] = (float)$r['jeep_fee'];
            $trip['jeepPayrollStatus'] = $r['jeep_payroll_status'];
        }
        if ($isDriverLapangan) {
            $trip['fieldDriverFee'] = (float)$r['field_driver_fee'];
            $trip['fieldPayrollStatus'] = $r['field_payroll_status'];
        }
        if ($isPhotographer) {
            $trip['photographerFee'] = (float)$r['photographer_fee'];
            $trip['photographerPayrollStatus'] = $r['photographer_payroll_status'];
        }
        if ($isGuide) {
            $trip['guideFee'] = (float)($r['guide_fee'] ?? 0);
            $trip['guidePayrollStatus'] = $r['guide_payroll_status'] ?? 'unpaid';
        }
    }

    return $trip;
}

function log_audit(?string $tripId, ?string $userId, string $action, $details = null): void {
    try {
        $id = 'aud-' . time() . '-' . mt_rand(100, 999);
        $json = $details !== null ? json_encode($details, JSON_UNESCAPED_UNICODE) : null;
        db_execute(
            "INSERT INTO audit_logs (id, trip_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)",
            [$id, $tripId, $userId, $action, $json]
        );
    } catch (Exception $e) {
        error_log('[log_audit error] ' . $e->getMessage());
    }
}
