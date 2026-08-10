<?php
/**
 * Email Tracking Utility Functions
 * These functions are used to generate tracking URLs for emails
 */

require_once __DIR__ . '/config.php';

/**
 * Get company settings for email templates
 */
function getCompanySettings(PDO $db, string $tenantId = '') {
    if ($tenantId) {
        $stmt = $db->prepare("SELECT * FROM company_settings WHERE tenant_id = ?");
        $stmt->execute([$tenantId]);
    } else {
        $stmt = $db->query("SELECT * FROM company_settings WHERE id = 1");
    }
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
}

/**
 * Generate a tracking pixel URL for an email
 */
function getTrackingPixelUrl($trackingId) {
    $baseUrl = getBaseUrl();
    return $baseUrl . '/api/track-open.php?tracking_id=' . $trackingId;
}

/**
 * Generate a tracking click URL
 */
function getTrackingClickUrl($trackingId, $originalUrl) {
    $baseUrl = getBaseUrl();
    return $baseUrl . '/api/track-click.php?tracking_id=' . $trackingId . '&url=' . urlencode($originalUrl);
}

/**
 * Process HTML content and conditionally add open-tracking pixel and click-tracking links.
 *
 * @param string $html              Raw HTML body
 * @param string $trackingId        UUID of the email_tracking record
 * @param string $baseUrl           App base URL
 * @param bool   $trackOpens        Inject 1x1 tracking pixel for open detection (default true)
 * @param bool   $trackClicks       Wrap <a href> URLs through click-tracking redirect (default true)
 */
function processEmailHtml($html, $trackingId, $baseUrl, bool $trackOpens = true, bool $trackClicks = true) {
    if ($trackOpens) {
        $trackingPixel = '<img src="' . $baseUrl . '/api/track-open.php?tracking_id=' . $trackingId . '" width="1" height="1" alt="" style="display:none;" />';
        // Insert before </body>; fall back to appending when no </body> tag
        if (stripos($html, '</body>') !== false) {
            $html = preg_replace('/<\/body>/i', $trackingPixel . '</body>', $html);
        } else {
            $html .= $trackingPixel;
        }
    }

    if ($trackClicks) {
        $html = preg_replace_callback(
            '/<a\s+([^>]*href=["\'])([^"\']+)(["\'][^>]*)>/i',
            function($matches) use ($trackingId, $baseUrl) {
                $originalUrl = $matches[2];
                // Skip mailto, tel, javascript and anchor links
                if (preg_match('/^(mailto:|tel:|javascript:|#)/i', $originalUrl)) {
                    return $matches[0];
                }
                $trackingUrl = getTrackingClickUrl($trackingId, $originalUrl);
                return '<a ' . $matches[1] . $trackingUrl . $matches[3] . '>';
            },
            $html
        );
    }

    return $html;
}

/**
 * Replace merge tags in email content
 */
function processMergeTags($content, $customer, $company = null, $companySettings = null) {
    // Get company settings from DB if not provided
    if ($companySettings === null && function_exists('getDB')) {
        try {
            $db = getDB();
            $companySettings = getCompanySettings($db);
        } catch (Exception $e) {
            $companySettings = [];
        }
    }
    
    // Customer merge tags
    $replacements = [
        '{{first_name}}' => $customer['first_name'] ?? '',
        '{{last_name}}' => $customer['last_name'] ?? '',
        '{{full_name}}' => trim(($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? '')),
        '{{email}}' => $customer['email'] ?? '',
        '{{phone}}' => $customer['phone'] ?? '',
        '{{position}}' => $customer['position'] ?? '',
        '{{company_name}}' => $company['name'] ?? ($companySettings['company_name'] ?? ''),
    ];
    
    // Company settings merge tags
    $companyReplacements = [
        '{{company_name}}' => $companySettings['company_name'] ?? '',
        '{{company_name_en}}' => $companySettings['company_name_en'] ?? '',
        '{{company_address}}' => $companySettings['address'] ?? '',
        '{{company_phone}}' => $companySettings['phone'] ?? '',
        '{{company_email}}' => $companySettings['email'] ?? '',
        '{{company_website}}' => $companySettings['website'] ?? '',
        '{{company_tax_id}}' => $companySettings['tax_id'] ?? '',
        '{{current_date}}' => date('d/m/Y'),
        '{{current_year}}' => date('Y'),
    ];
    
    $replacements = array_merge($replacements, $companyReplacements);
    
    foreach ($replacements as $tag => $value) {
        $content = str_replace($tag, $value, $content);
    }
    
    return $content;
}

/**
 * Get base URL (used for tracking pixel + click-wrap URLs in sent emails)
 * Priority:
 *  1. 'app_public_url' in settings table (set by Admin > SMTP/Mail settings) —
 *     primary key, also used by notification-utils. 'app_base_url' kept for back-compat.
 *  2. X-Forwarded-Host header (set by Vite proxy from VITE_APP_URL hostname)
 *  3. HTTP_HOST from server
 *
 * Note: keys 2 & 3 resolve to the internal/dev host at send time (CLI/cron), which a
 * recipient's mail client cannot reach — so the admin-configured URL (1) is required
 * for open/click tracking to register on sent emails.
 */
function getBaseUrl(): string {
    static $cached = null;
    if ($cached !== null) return $cached;

    // 1. Explicit DB setting (admin-configurable). Prefer 'app_public_url' (the key the
    //    admin UI writes); fall back to legacy 'app_base_url'.
    try {
        $db = getDB();
        $stmt = $db->query("SELECT value FROM settings WHERE `key` IN ('app_public_url', 'app_base_url') ORDER BY (`key` = 'app_public_url') DESC LIMIT 1");
        $row = $stmt->fetch();
        if ($row && !empty($row['value'])) {
            return $cached = rtrim($row['value'], '/');
        }
    } catch (\Throwable $e) { /* ignore */ }

    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';

    // 2. X-Forwarded-Host set by Vite proxy / reverse proxy
    $fwdHost = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '';
    if ($fwdHost) {
        return $cached = $scheme . '://' . strtok($fwdHost, ',');
    }

    // 3. Direct HTTP_HOST (works when PHP is called directly, not through Vite proxy)
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $cached = $scheme . '://' . $host;
}

/**
 * Wrap raw HTML body in a full, email-client-safe HTML document with inline styles.
 * Skips wrapping if the content is already a complete HTML document.
 */
function wrapEmailHtml(string $html, string $subject = '', array $companySettings = []): string {
    if (stripos($html, '<html') !== false) {
        return $html;
    }

    $safeTitle   = htmlspecialchars($subject ?: ($companySettings['company_name'] ?? 'Email'), ENT_QUOTES);
    $companyName = htmlspecialchars($companySettings['company_name'] ?? '', ENT_QUOTES);
    $headerHtml  = $companyName
        ? '<div style="padding:20px 32px 14px;border-bottom:1px solid #e4e4e7;">'
          . '<span style="font-size:18px;font-weight:700;color:#3b82f6;">' . $companyName . '</span></div>'
        : '';
    $footerHtml  = '<div style="padding:16px 32px;border-top:1px solid #e4e4e7;background:#fafafa;font-size:12px;color:#71717a;text-align:center;">'
        . ($companyName ? '<p style="margin:0 0 6px;">' . $companyName . '</p>' : '')
        . '<p style="margin:0;color:#a1a1aa;font-size:11px;">คุณได้รับอีเมลนี้เพราะสมัครรับข้อมูลจากเรา</p></div>';

    // Extract a leading hero <img> and render it full-bleed above the padded content block
    $heroHtml = '';
    $trimmed = ltrim($html);
    if (preg_match('/^(<img\s[^>]*>)/si', $trimmed, $m)) {
        // Rewrite style to full-bleed (remove any inline dimensions/border-radius that conflict)
        $tag = preg_replace('/\s*style="[^"]*"/i', '', $m[1]);
        $heroHtml = '<div>' . rtrim($tag, '/') . ' style="width:100%;max-width:100%;height:auto;display:block;"></div>';
        $html = ltrim(substr($trimmed, strlen($m[0])));
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="th" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{$safeTitle}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="width:100%;background-color:#f4f4f5;padding:24px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
      {$headerHtml}
      {$heroHtml}
      <div style="padding:32px;font-size:15px;line-height:1.75;color:#27272a;">
        <style>
          h1{font-size:22px;font-weight:700;color:#18181b;margin:0 0 16px;line-height:1.3}
          h2{font-size:18px;font-weight:600;color:#18181b;margin:24px 0 12px}
          h3{font-size:16px;font-weight:600;color:#18181b;margin:20px 0 8px}
          p{margin:0 0 16px}
          ul,ol{padding-left:24px;margin:0 0 16px}
          li{margin-bottom:4px}
          img{max-width:100%;height:auto;border-radius:6px;display:block;margin:16px auto}
          a{color:#3b82f6;text-decoration:underline}
          blockquote{border-left:4px solid #e4e4e7;padding:8px 16px;margin:16px 0;color:#71717a;font-style:italic}
          strong,b{font-weight:600}
          table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
          th{background:#f4f4f5;padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e4e4e7}
          td{padding:8px 12px;border-bottom:1px solid #e4e4e7}
          .lead{font-size:16px;color:#52525b;font-style:italic;margin-bottom:24px}
          /* Strip Tailwind/app classes that do nothing in email */
          .prose,.prose-sm,.prose-xs,.max-w-none,.dark\:prose-invert{all:unset}
          .text-muted-foreground{color:#71717a}
        </style>
        {$html}
      </div>
      {$footerHtml}
    </div>
  </div>
</body>
</html>
HTML;
}
