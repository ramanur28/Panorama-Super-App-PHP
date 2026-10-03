<?php
/**
 * Panorama Super App - Itinerary Templates & Stops API
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    json_response(['ok' => true]);
}

if ($method === 'GET') {
    $templates = db_query("SELECT * FROM itinerary_templates ORDER BY name ASC");
    $stops = db_query("SELECT * FROM itinerary_stops ORDER BY template_id ASC, order_index ASC");

    $stopsByTemplate = [];
    foreach ($stops as $s) {
        $tId = $s['template_id'];
        if (!isset($stopsByTemplate[$tId])) $stopsByTemplate[$tId] = [];
        $stopsByTemplate[$tId][] = [
            'id' => $s['id'],
            'time' => $s['time_estimate'],
            'title' => $s['title'],
            'location' => 'Spot Wisata Bromo',
            'description' => $s['activity_description'] ?? '',
            'operationalCost' => (float)$s['operational_fee']
        ];
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

json_response(['error' => 'Method not allowed'], 405);
