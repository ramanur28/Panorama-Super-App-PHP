<?php
/**
 * Panorama Super App - Itinerary Templates & Stops API
 * CRUD Management for Itinerary Templates (Admin Only for Write/Update/Delete)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

$templateId = $_GET['id'] ?? '';
$action = $_GET['action'] ?? '';

// Helper function to fetch single template with its stops
function parse_stop_row(array $s): array {
    $desc = $s['activity_description'] ?? '';
    $extra = [];
    if (!empty($desc) && ($desc[0] === '{' || $desc[0] === '[')) {
        $json = json_decode($desc, true);
        if (is_array($json)) $extra = $json;
    }
    return [
        'id' => $s['id'],
        'day' => (int)($extra['day'] ?? 1),
        'dayTitle' => $extra['dayTitle'] ?? ('Hari ' . ($extra['day'] ?? 1)),
        'time' => $s['time_estimate'],
        'title' => $s['title'],
        'location' => $extra['location'] ?? 'Spot Wisata Bromo',
        'operationalDesc' => $extra['operationalDesc'] ?? '',
        'operationalCost' => (float)$s['operational_fee'],
        'ticketCost' => (float)($extra['ticketCost'] ?? 0),
        'hotelCost' => (float)($extra['hotelCost'] ?? 0),
        'notes' => $extra['notes'] ?? (!empty($extra) ? '' : $desc),
        'description' => $desc
    ];
}

function get_full_template(string $id): ?array {
    $t = db_query_one("SELECT * FROM itinerary_templates WHERE id = ?", [$id]);
    if (!$t) return null;
    $stops = db_query("SELECT * FROM itinerary_stops WHERE template_id = ? ORDER BY order_index ASC", [$id]);
    $items = array_map('parse_stop_row', $stops);

    return [
        'id' => $t['id'],
        'name' => $t['name'],
        'category' => $t['category'],
        'duration' => $t['duration'],
        'description' => $t['description'] ?? '',
        'defaultPrice' => (float)$t['default_price'],
        'items' => $items
    ];
}

// 1. GET: Fetch list of templates or single template
if ($method === 'GET') {
    if (!empty($templateId)) {
        $tpl = get_full_template($templateId);
        if (!$tpl) {
            json_response(['success' => false, 'message' => 'Template itinerary tidak ditemukan.'], 404);
        }
        json_response(['success' => true, 'template' => $tpl]);
    }

    $templates = db_query("SELECT * FROM itinerary_templates ORDER BY category ASC, name ASC");
    $stops = db_query("SELECT * FROM itinerary_stops ORDER BY template_id ASC, order_index ASC");

    $stopsByTemplate = [];
    foreach ($stops as $s) {
        $tId = $s['template_id'];
        if (!isset($stopsByTemplate[$tId])) $stopsByTemplate[$tId] = [];
        $stopsByTemplate[$tId][] = parse_stop_row($s);
    }

    $result = array_map(function($t) use ($stopsByTemplate) {
        return [
            'id' => $t['id'],
            'name' => $t['name'],
            'category' => $t['category'],
            'duration' => $t['duration'],
            'description' => $t['description'] ?? '',
            'defaultPrice' => (float)$t['default_price'],
            'items' => $stopsByTemplate[$t['id']] ?? []
        ];
    }, $templates);

    json_response($result);
}

// Write/Update/Delete operations require Admin authority
$currentUser = require_admin();

// 2. POST (Create)
if ($method === 'POST' && empty($action) && empty($templateId)) {
    $body = get_json_input();
    $name = trim($body['name'] ?? '');
    if (!$name) {
        json_response(['success' => false, 'message' => 'Nama template itinerary wajib diisi.'], 400);
    }

    $validCategories = ['bromo_sunrise', 'milky_way', 'custom_trip', 'open_trip'];
    $category = in_array($body['category'] ?? '', $validCategories) ? $body['category'] : 'bromo_sunrise';
    $duration = trim($body['duration'] ?? '12 Jam');
    $description = trim($body['description'] ?? '');
    $defaultPrice = (float)($body['defaultPrice'] ?? $body['default_price'] ?? 0);
    $items = is_array($body['items'] ?? null) ? $body['items'] : [];

    $newId = 'tpl-' . time() . '-' . mt_rand(100, 999);

    $pdo = get_db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO itinerary_templates (id, name, category, duration, description, default_price)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$newId, $name, $category, $duration, $description, $defaultPrice]);

        if (!empty($items)) {
            $stopStmt = $pdo->prepare("
                INSERT INTO itinerary_stops (id, template_id, order_index, title, time_estimate, activity_description, operational_fee)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $order = 1;
            foreach ($items as $item) {
                $stopTitle = trim($item['title'] ?? '');
                if (!$stopTitle) continue;
                $stopTime = trim($item['time'] ?? $item['time_estimate'] ?? '');
                $extraData = [
                    'day' => (int)($item['day'] ?? 1),
                    'dayTitle' => trim($item['dayTitle'] ?? ('Hari ' . ($item['day'] ?? 1))),
                    'operationalDesc' => trim($item['operationalDesc'] ?? ''),
                    'ticketCost' => (float)($item['ticketCost'] ?? 0),
                    'hotelCost' => (float)($item['hotelCost'] ?? 0),
                    'notes' => trim($item['notes'] ?? $item['description'] ?? '')
                ];
                $stopDesc = json_encode($extraData, JSON_UNESCAPED_UNICODE);
                $stopCost = (float)($item['operationalCost'] ?? $item['operational_fee'] ?? 0);
                $stopId = 'stop-' . $newId . '-' . $order;

                $stopStmt->execute([$stopId, $newId, $order, $stopTitle, $stopTime, $stopDesc, $stopCost]);
                $order++;
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_response(['success' => false, 'message' => 'Gagal menyimpan template: ' . $e->getMessage()], 500);
    }

    $created = get_full_template($newId);
    json_response(['success' => true, 'template' => $created], 201);
}

// 3. PUT or POST action=update (Update)
if ($method === 'PUT' || ($method === 'POST' && $action === 'update')) {
    $id = $templateId ?: ($_GET['id'] ?? null);
    $body = get_json_input();
    if (!$id && isset($body['id'])) $id = $body['id'];

    if (!$id) {
        json_response(['success' => false, 'message' => 'ID Template wajib disertakan.'], 400);
    }

    $existing = db_query_one("SELECT * FROM itinerary_templates WHERE id = ?", [$id]);
    if (!$existing) {
        json_response(['success' => false, 'message' => 'Template itinerary tidak ditemukan.'], 404);
    }

    $validCategories = ['bromo_sunrise', 'milky_way', 'custom_trip', 'open_trip'];
    $name = isset($body['name']) ? trim($body['name']) : $existing['name'];
    $category = (isset($body['category']) && in_array($body['category'], $validCategories)) ? $body['category'] : $existing['category'];
    $duration = isset($body['duration']) ? trim($body['duration']) : $existing['duration'];
    $description = isset($body['description']) ? trim($body['description']) : $existing['description'];
    $defaultPrice = isset($body['defaultPrice']) ? (float)$body['defaultPrice'] : (isset($body['default_price']) ? (float)$body['default_price'] : (float)$existing['default_price']);

    $pdo = get_db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            UPDATE itinerary_templates 
            SET name = ?, category = ?, duration = ?, description = ?, default_price = ?
            WHERE id = ?
        ");
        $stmt->execute([$name, $category, $duration, $description, $defaultPrice, $id]);

        // If items are provided, replace stops
        if (isset($body['items']) && is_array($body['items'])) {
            $delStmt = $pdo->prepare("DELETE FROM itinerary_stops WHERE template_id = ?");
            $delStmt->execute([$id]);

            $stopStmt = $pdo->prepare("
                INSERT INTO itinerary_stops (id, template_id, order_index, title, time_estimate, activity_description, operational_fee)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $order = 1;
            foreach ($body['items'] as $item) {
                $stopTitle = trim($item['title'] ?? '');
                if (!$stopTitle) continue;
                $stopTime = trim($item['time'] ?? $item['time_estimate'] ?? '');
                $extraData = [
                    'day' => (int)($item['day'] ?? 1),
                    'dayTitle' => trim($item['dayTitle'] ?? ('Hari ' . ($item['day'] ?? 1))),
                    'operationalDesc' => trim($item['operationalDesc'] ?? ''),
                    'ticketCost' => (float)($item['ticketCost'] ?? 0),
                    'hotelCost' => (float)($item['hotelCost'] ?? 0),
                    'notes' => trim($item['notes'] ?? $item['description'] ?? '')
                ];
                $stopDesc = json_encode($extraData, JSON_UNESCAPED_UNICODE);
                $stopCost = (float)($item['operationalCost'] ?? $item['operational_fee'] ?? 0);
                $stopId = 'stop-' . $id . '-' . $order . '-' . mt_rand(10, 99);

                $stopStmt->execute([$stopId, $id, $order, $stopTitle, $stopTime, $stopDesc, $stopCost]);
                $order++;
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_response(['success' => false, 'message' => 'Gagal memperbarui template: ' . $e->getMessage()], 500);
    }

    $updated = get_full_template($id);
    json_response(['success' => true, 'template' => $updated]);
}

// 4. DELETE or POST action=delete (Delete)
if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $id = $templateId ?: ($_GET['id'] ?? null);
    if (!$id) {
        $body = get_json_input();
        $id = $body['id'] ?? null;
    }

    if (!$id) {
        json_response(['success' => false, 'message' => 'ID Template wajib disertakan.'], 400);
    }

    $existing = db_query_one("SELECT * FROM itinerary_templates WHERE id = ?", [$id]);
    if (!$existing) {
        json_response(['success' => false, 'message' => 'Template tidak ditemukan.'], 404);
    }

    // Safely decouple any trips pointing to this template
    db_execute("UPDATE trips SET itinerary_template_id = NULL WHERE itinerary_template_id = ?", [$id]);

    // Delete template (CASCADE will delete itinerary_stops automatically)
    db_execute("DELETE FROM itinerary_templates WHERE id = ?", [$id]);

    json_response(['success' => true, 'message' => 'Template itinerary berhasil dihapus.']);
}

json_response(['error' => 'Method not allowed'], 405);