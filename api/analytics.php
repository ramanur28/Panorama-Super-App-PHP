<?php
/**
 * Panorama Super App - Analytics API (Profit & Loss and Crew Payroll)
 * Strictly Admin Authority
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

$type = $_GET['type'] ?? 'pnl';
$action = $_GET['action'] ?? '';

// Mark Payroll as Paid
if ($action === 'mark_paid' && $method === 'POST') {
    $body = get_json_input();
    $tripId = $body['tripId'] ?? '';
    $role = $body['role'] ?? '';

    if (!$tripId || !$role) {
        json_response(['success' => false, 'message' => 'Trip ID dan Role wajib diisi.'], 400);
    }

    if ($role === 'driver_jeep') {
        db_execute("UPDATE trips SET jeep_payroll_status = 'paid' WHERE id = ?", [$tripId]);
    } elseif ($role === 'driver_lapangan') {
        db_execute("UPDATE trips SET field_payroll_status = 'paid' WHERE id = ?", [$tripId]);
    } elseif ($role === 'photographer') {
        db_execute("UPDATE trips SET photographer_payroll_status = 'paid' WHERE id = ?", [$tripId]);
    } elseif ($role === 'guide') {
        db_execute("UPDATE trips SET guide_payroll_status = 'paid' WHERE id = ?", [$tripId]);
    }

    log_audit($tripId, null, 'MARK_PAYROLL_PAID', ['role' => $role]);
    json_response(['success' => true, 'message' => 'Status honor kru berhasil diperbarui menjadi LUNAS.']);
}

// 1. PROFIT & LOSS (PnL)
if ($type === 'pnl') {
    $activeTrips = db_query("SELECT * FROM trips WHERE trip_status != 'cancelled'");
    $cancelledTrips = db_query("SELECT * FROM trips WHERE trip_status = 'cancelled'");

    $grossRevenue = 0.0;
    $cashCollected = 0.0;
    $outstandingReceivables = 0.0;
    $jeepCosts = ['internal' => 0.0, 'external' => 0.0, 'total' => 0.0];
    $fieldDriverCosts = ['internal' => 0.0, 'external' => 0.0, 'total' => 0.0];
    $photographerCosts = ['internal' => 0.0, 'external' => 0.0, 'total' => 0.0];
    $guideCosts = ['total' => 0.0];
    $operationalCosts = 0.0;

    foreach ($activeTrips as $t) {
        $price = (float)$t['package_price'];
        $grossRevenue += $price;

        $pStatus = $t['agency_payment_status'] ?? 'unpaid';
        $dep = (float)($t['deposit_amount'] ?? 0);
        if ($pStatus === 'paid') {
            $cash = $price;
            $rem = 0.0;
        } elseif ($pStatus === 'deposit') {
            $cash = min($price, max(0.0, $dep));
            $rem = max(0.0, $price - $cash);
        } else {
            $cash = 0.0;
            $rem = $price;
        }
        $cashCollected += $cash;
        $outstandingReceivables += $rem;

        $jFee = (float)$t['jeep_fee'];
        if ($t['jeep_status'] === 'external') {
            $jeepCosts['external'] += $jFee;
        } else {
            $jeepCosts['internal'] += $jFee;
        }
        $jeepCosts['total'] += $jFee;

        $fFee = (float)$t['field_driver_fee'];
        if ($t['field_driver_status'] === 'external') {
            $fieldDriverCosts['external'] += $fFee;
        } else {
            $fieldDriverCosts['internal'] += $fFee;
        }
        $fieldDriverCosts['total'] += $fFee;

        $pFee = (float)$t['photographer_fee'];
        if ($t['photographer_status'] === 'external') {
            $photographerCosts['external'] += $pFee;
        } else {
            $photographerCosts['internal'] += $pFee;
        }
        $photographerCosts['total'] += $pFee;

        $gFee = (float)($t['guide_fee'] ?? 0);
        $guideCosts['total'] += $gFee;

        $operationalCosts += (float)$t['operational_cost'];
    }

    $totalExpenses = $jeepCosts['total'] + $fieldDriverCosts['total'] + $photographerCosts['total'] + $guideCosts['total'] + $operationalCosts;
    $netProfit = $grossRevenue - $totalExpenses;
    $realizedNetCash = $cashCollected - $totalExpenses;
    $profitMarginPercent = $grossRevenue > 0 ? round(($netProfit / $grossRevenue) * 100, 1) : 0.0;

    json_response([
        'totalTrips' => count($activeTrips),
        'cancelledTripsCount' => count($cancelledTrips),
        'grossRevenue' => $grossRevenue,
        'cashCollected' => $cashCollected,
        'outstandingReceivables' => $outstandingReceivables,
        'realizedNetCash' => $realizedNetCash,
        'jeepCosts' => $jeepCosts,
        'fieldDriverCosts' => $fieldDriverCosts,
        'photographerCosts' => $photographerCosts,
        'guideCosts' => $guideCosts,
        'operationalCosts' => $operationalCosts,
        'totalExpenses' => $totalExpenses,
        'netProfit' => $netProfit,
        'profitMarginPercent' => $profitMarginPercent
    ]);
}

// 2. CREW PAYROLL SUMMARIES
if ($type === 'payroll') {
    $workers = db_query("SELECT * FROM users WHERE role != 'admin' ORDER BY name ASC");
    $activeTrips = db_query("SELECT * FROM trips WHERE trip_status != 'cancelled' ORDER BY date DESC");

    $summaries = [];
    foreach ($workers as $w) {
        $workerId = $w['id'];
        $role = $w['role'];

        $workerTrips = [];
        $totalEarnings = 0.0;
        $paidEarnings = 0.0;
        $pendingEarnings = 0.0;
        $datesWorked = [];

        foreach ($activeTrips as $t) {
            $matched = false;
            $fee = 0.0;
            $pStatus = 'unpaid';

            if ($role === 'driver_jeep' && $t['jeep_driver_id'] === $workerId) {
                $matched = true;
                $fee = (float)$t['jeep_fee'];
                $pStatus = $t['jeep_payroll_status'];
            } elseif ($role === 'driver_lapangan' && $t['field_driver_id'] === $workerId) {
                $matched = true;
                $fee = (float)$t['field_driver_fee'];
                $pStatus = $t['field_payroll_status'];
            } elseif ($role === 'photographer' && $t['photographer_id'] === $workerId) {
                $matched = true;
                $fee = (float)$t['photographer_fee'];
                $pStatus = $t['photographer_payroll_status'];
            } elseif ($role === 'guide' && !empty($t['guide_name']) && (strcasecmp(trim($t['guide_name']), trim($w['name'])) === 0 || stripos($t['guide_name'], $w['name']) !== false)) {
                $matched = true;
                $fee = (float)($t['guide_fee'] ?? 0);
                $pStatus = $t['guide_payroll_status'] ?? 'unpaid';
            }

            if ($matched) {
                $workerTrips[] = map_trip_row($t, $role, $workerId);
                $totalEarnings += $fee;
                if ($pStatus === 'paid') {
                    $paidEarnings += $fee;
                } else {
                    $pendingEarnings += $fee;
                }
                $datesWorked[$t['date']] = true;
            }
        }

        $summaries[] = [
            'worker' => map_user_row($w),
            'totalDaysWorked' => count($datesWorked),
            'totalTripsCount' => count($workerTrips),
            'totalEarnings' => $totalEarnings,
            'paidEarnings' => $paidEarnings,
            'pendingEarnings' => $pendingEarnings,
            'trips' => $workerTrips
        ];
    }

    json_response($summaries);
}

json_response(['error' => 'Unknown analytics type'], 400);
