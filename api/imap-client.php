<?php
// Minimal IMAP4rev1 client over a raw TCP/SSL socket — ไม่ต้องพึ่ง PHP imap extension
// ใช้ openssl stream (เปิดใน XAMPP อยู่แล้ว) + iconv/mbstring สำหรับถอดรหัสหัวข้อ

class SocketImapClient {
    private $sock;
    private int $seq = 0;

    public function __construct(string $host, int $port, string $enc) {
        $transport = ($enc === 'ssl') ? 'ssl' : 'tcp';
        $ctx = stream_context_create(['ssl' => [
            'verify_peer'      => false,
            'verify_peer_name' => false,
        ]]);
        $remote = "$transport://$host:$port";
        $this->sock = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$this->sock) {
            throw new Exception($errstr ?: "เปิด socket ไป $host:$port ไม่ได้");
        }
        stream_set_timeout($this->sock, 15);
        $this->readLine(); // greeting (* OK ...)
        if ($enc === 'tls') {
            $this->command('STARTTLS');
            if (!stream_socket_enable_crypto($this->sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new Exception('เปิด STARTTLS ไม่สำเร็จ');
            }
        }
    }

    private function readLine(): string {
        $line = fgets($this->sock);
        if ($line === false) {
            $meta = stream_get_meta_data($this->sock);
            throw new Exception(!empty($meta['timed_out']) ? 'เซิร์ฟเวอร์ไม่ตอบสนอง (timeout)' : 'การเชื่อมต่อถูกปิด');
        }
        return $line;
    }

    // ส่งคำสั่ง + อ่านจนเจอ tagged response คืน array ของบรรทัดทั้งหมด
    private function command(string $cmd): array {
        $tag = 'A' . str_pad((string)(++$this->seq), 4, '0', STR_PAD_LEFT);
        fwrite($this->sock, "$tag $cmd\r\n");
        $verb = strtok($cmd, ' ');
        $lines = [];
        while (true) {
            $line = $this->readLine();
            $lines[] = $line;
            if (strpos($line, "$tag ") === 0) {
                if (!preg_match("/^$tag OK/i", $line)) {
                    throw new Exception("[$verb] " . trim(substr($line, strlen($tag) + 1)));
                }
                break;
            }
        }
        return $lines;
    }

    public function login(string $user, string $pass): void {
        $this->command('LOGIN ' . self::quote($user) . ' ' . self::quote($pass));
    }

    public function select(string $mailbox): void {
        $this->command('SELECT ' . self::quote($mailbox));
    }

    public function searchAll(): array {
        return $this->search('ALL');
    }

    // SEARCH ตามเงื่อนไข เช่น 'ALL' หรือ 'SINCE 01-Jan-2024' คืน array ของ message numbers
    public function search(string $criteria): array {
        $lines = $this->command('SEARCH ' . $criteria);
        $ids = [];
        foreach ($lines as $l) {
            if (preg_match('/^\*\s+SEARCH\s+(.*)$/i', trim($l), $m)) {
                foreach (preg_split('/\s+/', trim($m[1])) as $n) {
                    if ($n !== '' && ctype_digit($n)) $ids[] = (int)$n;
                }
            }
        }
        return $ids;
    }

    // อ่าน raw จำนวน $n byte (สำหรับ IMAP literal {N})
    private function readBytes(int $n): string {
        $buf = '';
        while (strlen($buf) < $n) {
            $chunk = fread($this->sock, $n - strlen($buf));
            if ($chunk === false || $chunk === '') {
                $meta = stream_get_meta_data($this->sock);
                if (!empty($meta['timed_out'])) throw new Exception('อ่านข้อมูลไม่ครบ (timeout)');
                break;
            }
            $buf .= $chunk;
        }
        return $buf;
    }

    // ส่ง FETCH section แล้วอ่านค่า literal ({N}) ตามจำนวน byte ที่ถูกต้อง
    private function fetchSection(int $num, string $section): string {
        $tag = 'A' . str_pad((string)(++$this->seq), 4, '0', STR_PAD_LEFT);
        fwrite($this->sock, "$tag FETCH $num (BODY.PEEK[$section])\r\n");
        $payload = '';
        while (true) {
            $line = $this->readLine();
            if (strpos($line, "$tag ") === 0) {
                if (!preg_match("/^$tag OK/i", $line)) {
                    throw new Exception('[FETCH] ' . trim(substr($line, strlen($tag) + 1)));
                }
                break;
            }
            // เจอ literal {N} → อ่าน N byte ดิบต่อจากบรรทัดนี้
            if (preg_match('/\{(\d+)\}\r?\n$/', $line, $m)) {
                $payload .= $this->readBytes((int)$m[1]);
                $this->readLine(); // ปิดวงเล็บ ")\r\n"
            }
        }
        return $payload;
    }

    public function fetchHeader(int $num): string {
        return $this->fetchSection($num, 'HEADER.FIELDS (FROM SUBJECT)');
    }

    // ดึงเนื้อหา body (text) แล้วถอดรหัสให้อ่านได้ — ใช้สกัดข้อมูลจากลายเซ็น
    public function fetchBody(int $num): string {
        $raw = $this->fetchSection($num, 'TEXT');
        return self::extractReadableText($raw);
    }

    public function logout(): void {
        try { $this->command('LOGOUT'); } catch (Exception $e) {}
        if (is_resource($this->sock)) fclose($this->sock);
    }

    private static function quote(string $s): string {
        return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"';
    }

    // คลี่ header แบบ folded (RFC822) แล้วแยกเป็น key=>value (lowercase key)
    public static function parseHeaders(string $raw): array {
        $raw = preg_replace("/\r?\n[ \t]+/", ' ', $raw); // unfold
        $out = [];
        foreach (preg_split("/\r?\n/", $raw) as $line) {
            if (strpos($line, ':') === false) continue;
            [$k, $v] = explode(':', $line, 2);
            $out[strtolower(trim($k))] = trim($v);
        }
        return $out;
    }

    // แยก "Name <a@b.com>" → [name, email]
    public static function parseAddress(string $raw): array {
        if (preg_match('/^(.*)<([^>]+)>\s*$/', $raw, $m)) {
            $name = trim($m[1], " \t\"'");
            return [self::decodeMime($name), trim($m[2])];
        }
        $email = trim($raw, " \t<>");
        return ['', $email];
    }

    // ถอดรหัส MIME encoded-word (=?utf-8?B?...?=) เป็น UTF-8
    public static function decodeMime(string $s): string {
        if ($s === '') return '';
        if (function_exists('iconv_mime_decode')) {
            $d = @iconv_mime_decode($s, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
            if ($d !== false) return $d;
        }
        if (function_exists('mb_decode_mimeheader')) return mb_decode_mimeheader($s);
        return $s;
    }

    // แปลง raw body (อาจเป็น multipart / base64 / quoted-printable / HTML) เป็น text อ่านได้
    public static function extractReadableText(string $raw): string {
        // ตัด header ของ MIME sub-part ออก เก็บไว้รู้ encoding/charset ของแต่ละ part
        $parts = preg_split("/\r?\n--[^\r\n]+\r?\n/", $raw);
        $text  = '';
        foreach ($parts as $part) {
            // แยก header ของ part กับ body (คั่นด้วยบรรทัดว่าง)
            $enc = ''; $charset = 'utf-8'; $isHtml = false; $body = $part;
            if (preg_match('/^(.*?)\r?\n\r?\n(.*)$/s', $part, $m) && stripos($m[1], 'content-') !== false) {
                $head = $m[1]; $body = $m[2];
                if (preg_match('/content-transfer-encoding:\s*(\S+)/i', $head, $e)) $enc = strtolower(trim($e[1]));
                if (preg_match('/charset="?([^"\s;]+)/i', $head, $c)) $charset = strtolower($c[1]);
                if (preg_match('/content-type:\s*text\/html/i', $head)) $isHtml = true;
            }
            if ($enc === 'base64')          $body = base64_decode(preg_replace('/\s+/', '', $body)) ?: $body;
            elseif ($enc === 'quoted-printable') $body = quoted_printable_decode($body);
            if ($charset && $charset !== 'utf-8' && function_exists('iconv')) {
                $conv = @iconv($charset, 'UTF-8//TRANSLIT', $body);
                if ($conv !== false) $body = $conv;
            }
            if ($isHtml) $body = self::htmlToText($body);
            $text .= $body . "\n";
        }
        // เก็บเฉพาะ text ก่อนเครื่องหมาย quote ของอีเมลตอบกลับ (ลด noise)
        $text = preg_replace('/^>.*$/m', '', $text);
        return trim(preg_replace("/\n{3,}/", "\n\n", $text));
    }

    private static function htmlToText(string $html): string {
        $html = preg_replace('#<(script|style)[^>]*>.*?</\1>#is', '', $html);
        $html = preg_replace('#<br\s*/?>#i', "\n", $html);
        $html = preg_replace('#</(p|div|tr|li|h[1-6])>#i', "\n", $html);
        return html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    }

    // สกัด ที่อยู่ / เบอร์โทร / เว็บไซต์ / ฝ่าย / notes จากเนื้อหา (ลายเซ็น) อีเมล
    // คืน ['phone','website','address','department','notes']
    public static function extractContactFields(string $text, string $senderEmail = ''): array {
        $out = ['phone' => '', 'website' => '', 'address' => '', 'department' => '', 'notes' => ''];
        if (trim($text) === '') return $out;

        // เบอร์โทร: จับรูปแบบหลังคำว่า โทร/Tel/Mobile หรือเลข 9-10 หลัก/มีขีด
        if (preg_match('/(?:โทร|tel|mobile|phone|มือถือ|เบอร์)[\s.:]*([+()\d\s\-]{8,20})/iu', $text, $m)) {
            $out['phone'] = self::cleanPhone($m[1]);
        } elseif (preg_match('/(?<!\d)((?:\+?66|0)[\s\-]?\d[\d\s\-]{7,12})(?!\d)/', $text, $m)) {
            $out['phone'] = self::cleanPhone($m[1]);
        }

        // เว็บไซต์: URL ตัวแรกในลายเซ็น (ข้ามลิงก์ social ทั่วไป) — ถ้าไม่มีใช้โดเมนผู้ส่ง
        if (preg_match_all('#(?:https?://|www\.)[^\s<>"\)]+#i', $text, $mm)) {
            foreach ($mm[0] as $u) {
                if (preg_match('#(facebook|line\.me|instagram|twitter|x\.com|linkedin|youtube|tiktok)#i', $u)) continue;
                $out['website'] = rtrim($u, '.,);'); break;
            }
        }
        // fallback: ใช้โดเมนของผู้ส่ง (มักเป็นเว็บบริษัท) ถ้าไม่ใช่ free mail
        if ($out['website'] === '' && $senderEmail && strpos($senderEmail, '@') !== false) {
            $domain = strtolower(substr(strrchr($senderEmail, '@'), 1));
            $free = ['gmail.com','hotmail.com','outlook.com','yahoo.com','live.com','icloud.com','hotmail.co.th','yahoo.co.th'];
            if ($domain && !in_array($domain, $free)) $out['website'] = 'www.' . $domain;
        }

        // ฝ่าย/แผนก
        if (preg_match('/(?:ฝ่าย|แผนก|department|dept\.?|กอง|ส่วน)[\s:.\-]*([^\r\n,|]{2,40})/iu', $text, $m)) {
            $out['department'] = trim($m[1], " \t.-:");
        }

        // ที่อยู่: ถ้ามี label "ที่อยู่/address" เก็บตั้งแต่ตรงนั้นถึงรหัสไปรษณีย์ 5 หลัก
        // ถ้าไม่มี label ใช้ keyword ที่อยู่ (เลขที่/ถนน/แขวง...) เป็นจุดเริ่ม
        if (preg_match('/(?:ที่อยู่|address)[\s:.\-]*(.{5,200}?\d{5})/isu', $text, $m)) {
            $out['address'] = trim(preg_replace('/\s+/u', ' ', $m[1]));
        } elseif (preg_match('/((?:\d+[\/\-]?\d*\s*)?(?:เลขที่|บ้านเลขที่|หมู่|ซอย|ถนน|ตำบล|แขวง|อำเภอ|เขต|จังหวัด|no\.).{0,200}?\d{5})/isu', $text, $m)) {
            $out['address'] = trim(preg_replace('/\s+/u', ' ', $m[1]));
        }

        // notes: เก็บลายเซ็นย่อ (สูงสุด ~400 ตัวอักษร) เป็นข้อมูลอ้างอิง
        $sig = trim(preg_replace('/\s+/u', ' ', $text));
        $out['notes'] = function_exists('mb_substr') ? mb_substr($sig, 0, 400) : substr($sig, 0, 400);

        return $out;
    }

    private static function cleanPhone(string $p): string {
        $p = trim(preg_replace('/[^\d+]/', '', $p));
        return $p;
    }

    // ── คัดกรองอีเมลที่ "ไม่ใช่ลูกค้า" ออก ────────────────────────────────────────
    // คืน true ถ้าอีเมลนี้น่าจะเป็นระบบอัตโนมัติ / แจ้งเตือนแพลตฟอร์ม / จดหมายข่าว
    // ไม่ใช่ผู้ติดต่อจริงที่ควรเก็บเป็น lead
    public static function isNonCustomerEmail(string $email): bool {
        $email = strtolower(trim($email));
        if ($email === '' || strpos($email, '@') === false) return true;

        [$local, $domain] = explode('@', $email, 2);

        // local-part ที่บ่งบอกว่าเป็นกล่องอัตโนมัติ ไม่มีคนตอบ
        $localPatterns = [
            'no-reply', 'noreply', 'no.reply', 'donotreply', 'do-not-reply', 'do.not.reply',
            'mailer-daemon', 'mailerdaemon', 'postmaster', 'bounce', 'bounces', 'bounce-',
            'notification', 'notifications', 'notify', 'alert', 'alerts',
            'newsletter', 'news-', 'mailer', 'automated', 'auto-', 'auto_',
            'noreply-', 'system', 'daemon', 'webmaster', 'abuse', 'feedback',
            'unsubscribe', 'reply+', 'noreply.', 'mail-noreply',
        ];
        foreach ($localPatterns as $p) {
            if (strpos($local, $p) !== false) return true;
        }

        // โดเมนของแพลตฟอร์ม/บริการที่ส่งเมลแจ้งเตือนอัตโนมัติ (ไม่ใช่ลูกค้า)
        $blockedDomains = [
            'facebookmail.com', 'facebook.com', 'mail.instagram.com', 'instagram.com',
            'linkedin.com', 'e.linkedin.com', 'bounce.linkedin.com',
            'google.com', 'accounts.google.com', 'mail.google.com', 'youtube.com',
            'twitter.com', 'x.com', 'tiktok.com', 'mail.tiktok.com',
            'github.com', 'notifications.github.com', 'noreply.github.com',
            'slack.com', 'shopee.co.th', 'lazada.co.th', 'line.me',
            'paypal.com', 'amazonaws.com', 'sendgrid.net', 'mailchimp.com',
            'mailchimpapp.net', 'sendinblue.com', 'mandrillapp.com', 'mcsv.net',
            'intuit.com', 'docusign.net', 'atlassian.net', 'trello.com',
            'zoom.us', 'microsoft.com', 'office365.com', 'sharepointonline.com',
        ];
        if (in_array($domain, $blockedDomains, true)) return true;
        // โดเมนย่อยของ platform เหล่านั้น เช่น xxx.facebookmail.com
        foreach ($blockedDomains as $bd) {
            if (substr($domain, -(strlen($bd) + 1)) === '.' . $bd) return true;
        }

        return false;
    }
}
