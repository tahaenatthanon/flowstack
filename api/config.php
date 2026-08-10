<?php
// ============================================
// Flowstack API - Configuration
// Database connection, CORS, helpers
// ============================================

// Start output buffering to prevent premature output
ob_start();

// --- CORS Headers ---
// Handled by Apache mod_headers in /api/.htaccess
// (do NOT add PHP-level CORS here — would create duplicate headers)
header('Content-Type: application/json; charset=utf-8');

// --- Load Environment Variables ---
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) continue; // Skip comments
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Remove quotes if present
        if (preg_match('/^["\'](.*)["\']\s*$/', $value, $matches)) {
            $value = $matches[1];
        }
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

// --- Database Configuration ---
define('DB_HOST', getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? 'localhost'));
define('DB_NAME', getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? 'flowstack'));
define('DB_USER', getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? 'root'));
define('DB_PASS', getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? ''));
define('DB_CHARSET', 'utf8mb4');

// --- JWT Configuration ---
$_jwtSecret = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? '');
if (empty($_jwtSecret)) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['error' => 'Server misconfiguration: JWT_SECRET is not set. Add JWT_SECRET to your .env file.']);
    exit;
}
define('JWT_SECRET', $_jwtSecret);
unset($_jwtSecret);
define('JWT_EXPIRY', 86400 * 7); // 7 days

// --- Kilo AI Configuration ---
define('KILO_API_TOKEN', getenv('KILO_API_TOKEN') ?: ($_ENV['KILO_API_TOKEN'] ?? ''));
define('KILO_API_BASE_URL', getenv('KILO_API_BASE_URL') ?: ($_ENV['KILO_API_BASE_URL'] ?? ''));

// SSL peer verification for outbound AI API calls.
// Set APP_ENV=production in .env to enable strict verification.
// On XAMPP (local dev) this is false so curl can reach external HTTPS endpoints without CA-bundle issues.
define('AI_SSL_VERIFY', (getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? 'development')) === 'production');

// --- AI API Key Encryption Helpers (AES-256-CBC) ---
// Prefers company_settings.encryption_key; falls back to JWT_SECRET.
if (!function_exists('_getEncryptionKey')) {
    function _getEncryptionKey(): string {
        static $cached = null;
        if ($cached !== null) return $cached;
        try {
            $db = getDB();
            $row = $db->query("SELECT encryption_key FROM company_settings WHERE id = 1 LIMIT 1")->fetch();
            if (!empty($row['encryption_key'])) {
                $cached = hash('sha256', base64_decode($row['encryption_key']), true);
                return $cached;
            }
        } catch (\Throwable $e) {}
        $cached = hash('sha256', JWT_SECRET, true);
        return $cached;
    }
}

if (!function_exists('encryptApiKey')) {
    function encryptApiKey(string $plainKey): string {
        $encKey = _getEncryptionKey();
        $iv = random_bytes(16);
        $encrypted = openssl_encrypt($plainKey, 'AES-256-CBC', $encKey, OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $encrypted);
    }
}

if (!function_exists('decryptApiKey')) {
    function decryptApiKey(string $encryptedKey): string {
        $encKey = _getEncryptionKey();
        $data = base64_decode($encryptedKey);
        if (strlen($data) <= 16) return '';
        $iv = substr($data, 0, 16);
        $ciphertext = substr($data, 16);
        $plain = openssl_decrypt($ciphertext, 'AES-256-CBC', $encKey, OPENSSL_RAW_DATA, $iv);
        return $plain !== false ? $plain : '';
    }
}

// --- Mail / SMTP Configuration ---
define('MAIL_HOST',         getenv('MAIL_HOST')         ?: ($_ENV['MAIL_HOST']         ?? 'smtp.gmail.com'));
define('MAIL_PORT',   (int)(getenv('MAIL_PORT')         ?: ($_ENV['MAIL_PORT']         ?? 587)));
define('MAIL_ENCRYPTION',   getenv('MAIL_ENCRYPTION')   ?: ($_ENV['MAIL_ENCRYPTION']   ?? 'tls'));
define('MAIL_USERNAME',     getenv('MAIL_USERNAME')     ?: ($_ENV['MAIL_USERNAME']     ?? ''));
define('MAIL_PASSWORD',     getenv('MAIL_PASSWORD')     ?: ($_ENV['MAIL_PASSWORD']     ?? ''));
define('MAIL_FROM_ADDRESS', getenv('MAIL_FROM_ADDRESS') ?: ($_ENV['MAIL_FROM_ADDRESS'] ?? ''));
define('MAIL_FROM_NAME',    getenv('MAIL_FROM_NAME')    ?: ($_ENV['MAIL_FROM_NAME']    ?? 'Flowstack'));

// --- Database Connection ---
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}

// --- UUID Generator (RFC 4122 v4, cryptographically secure) ---
function generateUUID(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40); // version 4
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80); // variant RFC 4122
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

// --- UUID Validator ---
function isValidUUID(string $uuid): bool {
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid) === 1;
}

// --- Cast known DECIMAL/numeric fields to proper PHP types so json_encode emits numbers not strings ---
// PDO with MariaDB returns DECIMAL columns as strings even with ATTR_EMULATE_PREPARES=false.
function castNumericFields(array $row, array $floatFields = [], array $intFields = []): array {
    foreach ($floatFields as $f) {
        if (array_key_exists($f, $row)) {
            $row[$f] = $row[$f] === null ? null : (float)$row[$f];
        }
    }
    foreach ($intFields as $f) {
        if (array_key_exists($f, $row)) {
            $row[$f] = $row[$f] === null ? null : (int)$row[$f];
        }
    }
    return $row;
}

function castNumericFieldsAll(array $rows, array $floatFields = [], array $intFields = []): array {
    return array_map(fn($row) => castNumericFields($row, $floatFields, $intFields), $rows);
}

// --- JSON Response Helpers ---
function jsonResponse($data, int $statusCode = 200): void {
    ob_end_clean();
    http_response_code($statusCode);
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonSuccess($data, int $statusCode = 200): void {
    ob_end_clean();
    http_response_code($statusCode);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $statusCode = 400): void {
    ob_end_clean();
    http_response_code($statusCode);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- JWT Token Validation ---
function validateToken(): ?array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (empty($authHeader)) return null;

    if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) return null;
    $token = $matches[1];

    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;

    // Verify signature
    $expectedSignature = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expectedSignature, $signature)) return null;

    // Decode payload
    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data) return null;

    // Check expiry
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data;
}

// Only define if not already defined (may be defined in auth.php)
if (!function_exists('base64UrlEncode')) {
    function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

// Only define if not already defined (may be defined in auth.php)
if (!function_exists('base64UrlDecode')) {
    function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

// --- Get JSON Request Body ---
function getRequestBody(): array {
    $body = file_get_contents('php://input');
    if (empty($body)) return [];
    $data = json_decode($body, true);
    if (!is_array($data)) {
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
            exit;
        }
        return [];
    }
    return $data;
}

// --- Get Request Method ---
function getMethod(): string {
    return $_SERVER['REQUEST_METHOD'];
}

// --- Input Validation Helpers ---
function validateEmail(string $email): bool {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validateUrl(string $url): bool {
    return filter_var($url, FILTER_VALIDATE_URL) !== false;
}

function validateStringLength(string $value, int $max, int $min = 0): bool {
    $len = mb_strlen(trim($value));
    return $len >= $min && $len <= $max;
}

// --- Inbox Notification Helper ---
// Creates a notification in inbox_messages for a specific user.
// Safe to call silently — failures are swallowed so they never break the main request.
function inboxNotify(
    PDO    $db,
    string $tenantId,
    string $recipientUserId,
    string $senderName,
    string $senderEmail,
    string $subject,
    string $preview    = '',
    string $type       = 'notification',
    string $priority   = 'medium',
    ?string $relatedId = null
): void {
    // Don't notify self
    if (empty($recipientUserId)) return;
    try {
        $db->prepare("
            INSERT INTO inbox_messages
              (id, tenant_id, user_id, sender_name, sender_email, subject, preview, type, priority, related_id, status)
            VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
        ")->execute([
            $tenantId,
            $recipientUserId,
            $senderName,
            $senderEmail,
            $subject,
            $preview,
            $type,
            $priority,
            $relatedId,
        ]);
    } catch (Throwable $e) {
        // Non-fatal — log silently and continue
        error_log('[inboxNotify] ' . $e->getMessage());
    }
}
