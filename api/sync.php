<?php
/**
 * Panorama Super App - Batch Offline Sync API
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

$body = get_json_input();
$mutations = $body['mutations'] ?? [];
$processedIds = [];

foreach ($mutations as $item) {
    try {
        $entity = $item['entity'] ?? '';
        $action = $item['action'] ?? '';
        $payload = $item['payload'] ?? [];
        $itemId = $item['id'] ?? null;

        if ($entity === 'trips') {
            if ($action === 'create' || $action === 'update') {
                $tId = $payload['id'] ?? '';
                if ($tId) {
                    $exists = db_query_one("SELECT id FROM trips WHERE id = ?", [$tId]);
                    if ($exists) {
                        if (isset($payload['jeepStatus'])) {
                            db_execute("UPDATE trips SET jeep_status = ? WHERE id = ?", [$payload['jeepStatus'], $tId]);
                        }
                        if (isset($payload['fieldDriverStatus'])) {
                            db_execute("UPDATE trips SET field_driver_status = ? WHERE id = ?", [$payload['fieldDriverStatus'], $tId]);
                        }
                        if (isset($payload['photographerStatus'])) {
                            db_execute("UPDATE trips SET photographer_status = ? WHERE id = ?", [$payload['photographerStatus'], $tId]);
                        }
                        if (isset($payload['photoAlbumUrl'])) {
                            db_execute("UPDATE trips SET photo_album_url = ? WHERE id = ?", [$payload['photoAlbumUrl'], $tId]);
                        }
                        if (isset($payload['tripStatus'])) {
                            db_execute("UPDATE trips SET trip_status = ? WHERE id = ?", [$payload['tripStatus'], $tId]);
                        }
                    }
                }
            }
        }
        if ($itemId) {
            $processedIds[] = $itemId;
        }
    } catch (Exception $e) {
        error_log('[Sync Error] ' . $e->getMessage());
    }
}

json_response(['success' => true, 'processedIds' => $processedIds]);
