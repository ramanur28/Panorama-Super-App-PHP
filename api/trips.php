<?php
/**
 * Panorama Super App - Trips API with Strict Role Boundaries
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

$currentUser = get_auth_user();
$action = $_GET['action'] ?? '';
$tripId = $_GET['id'] ?? '';

// 1. GET: LIST TRIPS
if ($method === 'GET' && empty($action) && empty($tripId)) {
    $workerId = $_GET['workerId'] ?? $_GET['userId'] ?? ($currentUser['id'] ?? null);
    $role = $_GET['role'] ?? ($currentUser['role'] ?? null);
    $date = $_GET['date'] ?? null;
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $status = $_GET['status'] ?? null;
    $search = $_GET['search'] ?? null;

    $sql = "SELECT * FROM trips WHERE 1=1";
    $params = [];

    // Role-based boundary filtering
    if ($role === 'driver_jeep' && $workerId) {
        $sql .= " AND jeep_driver_id = ?";
        $params[] = $workerId;
    } elseif ($role === 'driver_lapangan' && $workerId) {
        $sql .= " AND field_driver_id = ?";
        $params[] = $workerId;
    } elseif ($role === 'photographer' && $workerId) {
        $sql .= " AND photographer_id = ?";
        $params[] = $workerId;
    }

    // Additional filters
    if ($date) {
        $sql .= " AND date = ?";
        $params[] = $date;
    } elseif ($startDate && $endDate) {
        $sql .= " AND date BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }

    if ($status && $status !== 'all') {
        $sql .= " AND trip_status = ?";
        $params[] = $status;
    }

    if ($search) {
        $sql .= " AND (code LIKE ? OR guest_name LIKE ? OR guest_phone LIKE ? OR tour_package LIKE ?)";
        $kw = '%' . $search . '%';
        $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw;
    }

    $sql .= " ORDER BY date DESC, time_slot ASC";
    $rows = db_query($sql, $params);

    $trips = array_map(function($r) use ($role, $workerId) {
        return map_trip_row($r, $role, $workerId);
    }, $rows);

    json_response($trips);
}

// 2. GET: SINGLE TRIP DETAIL
if ($method === 'GET' && $tripId) {
    $r = db_query_one("SELECT * FROM trips WHERE id = ?", [$tripId]);
    if (!$r) {
        json_response(['success' => false, 'message' => 'Trip tidak ditemukan'], 404);
    }
    $role = $_GET['role'] ?? ($currentUser['role'] ?? null);
    $workerId = $_GET['workerId'] ?? $_GET['userId'] ?? ($currentUser['id'] ?? null);
    json_response(['success' => true, 'trip' => map_trip_row($r, $role, $workerId)]);
}

// 3. POST: CREATE TRIP (Admin Only)
if ($method === 'POST' && empty($action)) {
    $body = get_json_input();
    
    $date = $body['date'] ?? date('Y-m-d');
    $timeSlot = $body['timeSlot'] ?? '02:00 WIB (Sunrise)';
    $dateCode = str_replace('-', '', substr($date, 2));
    $code = $body['code'] ?? ('PNR-' . $dateCode . '-' . mt_rand(10, 99));
    $newTripId = 'trip-' . time() . '-' . mt_rand(10, 99);

    // Validasi Kapasitas Serentak Kru (Max 2 Trip)
    if (($body['tripStatus'] ?? '') !== 'cancelled') {
        if (!empty($body['jeepDriverId'])) {
            $check = check_worker_capacity($body['jeepDriverId'], $body['jeepDriverName'] ?? 'Driver Jeep', $date, $timeSlot);
            if (!$check['ok']) {
                json_response(['success' => false, 'message' => $check['message']], 400);
            }
        }
        if (!empty($body['fieldDriverId'])) {
            $check = check_worker_capacity($body['fieldDriverId'], $body['fieldDriverName'] ?? 'Driver Lapangan', $date, $timeSlot);
            if (!$check['ok']) {
                json_response(['success' => false, 'message' => $check['message']], 400);
            }
        }
        if (!empty($body['photographerId'])) {
            $check = check_worker_capacity($body['photographerId'], $body['photographerName'] ?? 'Fotografer', $date, $timeSlot);
            if (!$check['ok']) {
                json_response(['success' => false, 'message' => $check['message']], 400);
            }
        }
    }

    $rawItinerary = !empty($body['itinerary']) ? json_encode($body['itinerary'], JSON_UNESCAPED_UNICODE) : null;

    $sql = "
        INSERT INTO trips (
          id, code, date, time_slot, guest_name, guest_count, guest_phone, pickup_point, notes,
          package_price, tour_package, agency_id, agency_name, agency_payment_status, deposit_amount,
          jeep_driver_id, jeep_driver_name, jeep_unit, jeep_fee, jeep_status, jeep_payroll_status,
          field_driver_id, field_driver_name, field_driver_unit, field_driver_fee, field_driver_status, field_payroll_status,
          photographer_id, photographer_name, photographer_fee, photographer_status, photographer_payroll_status, photo_album_url,
          operational_cost, itinerary_template_id, trip_status, raw_itinerary
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
    ";

    $params = [
        $newTripId,
        $code,
        $date,
        $timeSlot,
        $body['guestName'] ?? 'Tamu',
        (int)($body['guestCount'] ?? 1),
        $body['guestPhone'] ?? '',
        $body['pickupPoint'] ?? '',
        $body['notes'] ?? null,
        (float)($body['packagePrice'] ?? 0),
        $body['tourPackage'] ?? 'Bromo Sunrise Classic 4 Spot',
        $body['agencyId'] ?? null,
        $body['agencyName'] ?? null,
        $body['agencyPaymentStatus'] ?? 'unpaid',
        (($body['agencyPaymentStatus'] ?? 'unpaid') === 'paid') ? (float)($body['packagePrice'] ?? 0) : ((($body['agencyPaymentStatus'] ?? 'unpaid') === 'deposit') ? (float)($body['depositAmount'] ?? 0) : 0.0),
        $body['jeepDriverId'] ?? null,
        $body['jeepDriverName'] ?? null,
        $body['jeepUnit'] ?? null,
        (float)($body['jeepFee'] ?? 0),
        $body['jeepStatus'] ?? 'standby',
        $body['jeepPayrollStatus'] ?? 'unpaid',
        $body['fieldDriverId'] ?? null,
        $body['fieldDriverName'] ?? null,
        $body['fieldDriverUnit'] ?? null,
        (float)($body['fieldDriverFee'] ?? 0),
        $body['fieldDriverStatus'] ?? 'standby',
        $body['fieldPayrollStatus'] ?? 'unpaid',
        $body['photographerId'] ?? null,
        $body['photographerName'] ?? null,
        (float)($body['photographerFee'] ?? 0),
        $body['photographerStatus'] ?? 'assigned',
        $body['photographerPayrollStatus'] ?? 'unpaid',
        $body['photoAlbumUrl'] ?? null,
        (float)($body['operationalCost'] ?? 0),
        $body['itineraryTemplateId'] ?? null,
        $body['tripStatus'] ?? 'scheduled',
        $rawItinerary
    ];

    db_execute($sql, $params);
    log_audit($newTripId, $currentUser['id'] ?? null, 'CREATE_TRIP', ['code' => $code]);

    $created = db_query_one("SELECT * FROM trips WHERE id = ?", [$newTripId]);
    json_response(['success' => true, 'trip' => map_trip_row($created)], 201);
}

// 4. PUT: UPDATE TRIP
if ($method === 'PUT' || ($method === 'POST' && $action === 'update')) {
    $id = $tripId ?: ($_GET['id'] ?? null);
    $body = get_json_input();
    if (!$id && isset($body['id'])) $id = $body['id'];

    if (!$id) {
        json_response(['success' => false, 'message' => 'ID Trip wajib disertakan.'], 400);
    }

    $existing = db_query_one("SELECT * FROM trips WHERE id = ?", [$id]);
    if (!$existing) {
        json_response(['success' => false, 'message' => 'Trip tidak ditemukan.'], 404);
    }

    $targetDate = $body['date'] ?? $existing['date'];
    $targetSlot = $body['timeSlot'] ?? $existing['time_slot'];
    $willBeStatus = $body['tripStatus'] ?? $existing['trip_status'];

    if ($willBeStatus !== 'cancelled') {
        $targetJeep = array_key_exists('jeepDriverId', $body) ? $body['jeepDriverId'] : $existing['jeep_driver_id'];
        if ($targetJeep) {
            $check = check_worker_capacity($targetJeep, $body['jeepDriverName'] ?? $existing['jeep_driver_name'] ?? 'Driver Jeep', $targetDate, $targetSlot, $id);
            if (!$check['ok']) {
                json_response(['success' => false, 'message' => $check['message']], 400);
            }
        }
        $targetField = array_key_exists('fieldDriverId', $body) ? $body['fieldDriverId'] : $existing['field_driver_id'];
        if ($targetField) {
            $check = check_worker_capacity($targetField, $body['fieldDriverName'] ?? $existing['field_driver_name'] ?? 'Driver Lapangan', $targetDate, $targetSlot, $id);
            if (!$check['ok']) {
                json_response(['success' => false, 'message' => $check['message']], 400);
            }
        }
        $targetPhoto = array_key_exists('photographerId', $body) ? $body['photographerId'] : $existing['photographer_id'];
        if ($targetPhoto) {
            $check = check_worker_capacity($targetPhoto, $body['photographerName'] ?? $existing['photographer_name'] ?? 'Fotografer', $targetDate, $targetSlot, $id);
            if (!$check['ok']) {
                json_response(['success' => false, 'message' => $check['message']], 400);
            }
        }
    }

    $fieldMap = [
        'code' => 'code',
        'date' => 'date',
        'timeSlot' => 'time_slot',
        'guestName' => 'guest_name',
        'guestCount' => 'guest_count',
        'guestPhone' => 'guest_phone',
        'pickupPoint' => 'pickup_point',
        'notes' => 'notes',
        'packagePrice' => 'package_price',
        'tourPackage' => 'tour_package',
        'agencyId' => 'agency_id',
        'agencyName' => 'agency_name',
        'agencyPaymentStatus' => 'agency_payment_status',
        'depositAmount' => 'deposit_amount',
        'jeepDriverId' => 'jeep_driver_id',
        'jeepDriverName' => 'jeep_driver_name',
        'jeepUnit' => 'jeep_unit',
        'jeepFee' => 'jeep_fee',
        'jeepStatus' => 'jeep_status',
        'jeepPayrollStatus' => 'jeep_payroll_status',
        'fieldDriverId' => 'field_driver_id',
        'fieldDriverName' => 'field_driver_name',
        'fieldDriverUnit' => 'field_driver_unit',
        'fieldDriverFee' => 'field_driver_fee',
        'fieldDriverStatus' => 'field_driver_status',
        'fieldPayrollStatus' => 'field_payroll_status',
        'photographerId' => 'photographer_id',
        'photographerName' => 'photographer_name',
        'photographerFee' => 'photographer_fee',
        'photographerStatus' => 'photographer_status',
        'photographerPayrollStatus' => 'photographer_payroll_status',
        'photoAlbumUrl' => 'photo_album_url',
        'operationalCost' => 'operational_cost',
        'itineraryTemplateId' => 'itinerary_template_id',
        'tripStatus' => 'trip_status',
        'cancellationReason' => 'cancellation_reason'
    ];

    if (isset($body['agencyPaymentStatus'])) {
        $newStatus = $body['agencyPaymentStatus'];
        $curPrice = isset($body['packagePrice']) ? (float)$body['packagePrice'] : (float)$existing['package_price'];
        if ($newStatus === 'paid') {
            $body['depositAmount'] = $curPrice;
        } elseif ($newStatus === 'unpaid') {
            $body['depositAmount'] = 0.0;
        } elseif ($newStatus === 'deposit' && !isset($body['depositAmount'])) {
            $body['depositAmount'] = (float)($existing['deposit_amount'] ?? 0);
        }
    }

    $setClauses = [];
    $updateParams = [];

    foreach ($fieldMap as $jsKey => $col) {
        if (array_key_exists($jsKey, $body)) {
            $setClauses[] = "`{$col}` = ?";
            $updateParams[] = $body[$jsKey];
        }
    }

    if (array_key_exists('itinerary', $body)) {
        $setClauses[] = "`raw_itinerary` = ?";
        $updateParams[] = !empty($body['itinerary']) ? json_encode($body['itinerary'], JSON_UNESCAPED_UNICODE) : null;
    }

    if (!empty($setClauses)) {
        $updateParams[] = $id;
        db_execute("UPDATE trips SET " . implode(', ', $setClauses) . " WHERE id = ?", $updateParams);
        log_audit($id, $currentUser['id'] ?? null, 'UPDATE_TRIP', $body);
    }

    $updated = db_query_one("SELECT * FROM trips WHERE id = ?", [$id]);
    json_response(['success' => true, 'trip' => map_trip_row($updated)]);
}

// 5. POST: CANCEL TRIP
if ($action === 'cancel' && $method === 'POST') {
    $body = get_json_input();
    $id = $body['id'] ?? $tripId;
    $reason = $body['reason'] ?? 'Tamu reschedule / pembatalan pihak agen';

    db_execute(
        "UPDATE trips SET trip_status = 'cancelled', cancellation_reason = ? WHERE id = ?",
        [$reason, $id]
    );
    log_audit($id, $currentUser['id'] ?? null, 'CANCEL_TRIP', ['reason' => $reason]);

    $updated = db_query_one("SELECT * FROM trips WHERE id = ?", [$id]);
    json_response(['success' => true, 'trip' => map_trip_row($updated)]);
}

// 6. POST: UPDATE PHOTO URL
if ($action === 'photo' && $method === 'POST') {
    $body = get_json_input();
    $id = $body['id'] ?? $tripId;
    $photoUrl = $body['photoAlbumUrl'] ?? '';

    db_execute(
        "UPDATE trips SET photo_album_url = ?, photographer_status = 'uploaded' WHERE id = ?",
        [$photoUrl, $id]
    );
    log_audit($id, $currentUser['id'] ?? null, 'UPDATE_PHOTO_URL', ['photoAlbumUrl' => $photoUrl]);

    $updated = db_query_one("SELECT * FROM trips WHERE id = ?", [$id]);
    json_response(['success' => true, 'trip' => map_trip_row($updated)]);
}

// 7. DELETE: DELETE TRIP (Admin Only)
if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $id = $tripId ?: ($_GET['id'] ?? null);
    if (!$id) {
        $body = get_json_input();
        $id = $body['id'] ?? null;
    }
    if (!$id) {
        json_response(['success' => false, 'message' => 'ID Trip wajib disertakan.'], 400);
    }
    db_execute("DELETE FROM trips WHERE id = ?", [$id]);
    log_audit($id, $currentUser['id'] ?? null, 'DELETE_TRIP');
    json_response(['success' => true, 'message' => 'Trip berhasil dihapus.']);
}

json_response(['error' => 'Method not allowed'], 405);
