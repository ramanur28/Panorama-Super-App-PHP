<?php
/**
 * Panorama Super App - Centralized PDO Database Connection
 */
require_once __DIR__ . '/../config.php';

class Database {
    private static ?PDO $instance = null;
    private static bool $connectionFailed = false;
    private static ?string $lastError = null;

    public static function getInstance(): ?PDO {
        if (self::$instance === null && !self::$connectionFailed) {
            try {
                $dsn = sprintf(
                    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                    DB_HOST,
                    DB_PORT,
                    DB_NAME,
                    DB_CHARSET
                );
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'"
                ];
                self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
            } catch (PDOException $e) {
                self::$connectionFailed = true;
                self::$lastError = $e->getMessage();
                error_log('[Database Connection Error] ' . $e->getMessage());
                return null;
            }
        }
        return self::$instance;
    }

    public static function isConnected(): bool {
        return self::getInstance() !== null;
    }

    public static function getLastError(): ?string {
        return self::$lastError;
    }
}

function get_db(): ?PDO {
    return Database::getInstance();
}

function db_query(string $sql, array $params = []): array {
    $db = get_db();
    if (!$db) return [];
    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log('[db_query error] ' . $e->getMessage() . ' | SQL: ' . $sql);
        throw $e;
    }
}

function db_query_one(string $sql, array $params = []): ?array {
    $rows = db_query($sql, $params);
    return !empty($rows) ? $rows[0] : null;
}

function db_execute(string $sql, array $params = []): int {
    $db = get_db();
    if (!$db) return 0;
    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    } catch (PDOException $e) {
        error_log('[db_execute error] ' . $e->getMessage() . ' | SQL: ' . $sql);
        throw $e;
    }
}

function db_insert(string $sql, array $params = []): string {
    $db = get_db();
    if (!$db) return '0';
    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $db->lastInsertId();
    } catch (PDOException $e) {
        error_log('[db_insert error] ' . $e->getMessage() . ' | SQL: ' . $sql);
        throw $e;
    }
}
