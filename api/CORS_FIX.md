# 🔧 การแก้ไขปัญหา CORS Error

## ปัญหาที่เกิด

```
คำขอ Cross-Origin ถูกปิดกั้น: นโยบาย Same Origin ไม่อนุญาตให้อ่านทรัพยากรระยะไกล
ที่ http://localhost/flowstack/api/auth/signup.php 
(เหตุผล: เฮดเดอร์ CORS 'Access-Control-Allow-Origin' ขาดหายไป)
```

**สาเหตุ:**
- Frontend (Vite) รันบน `http://localhost:8080` หรือ `8081`
- Backend (PHP) รันบน `http://localhost/flowstack/api/`
- เป็นคนละ origin → ต้องมี CORS headers

---

## การแก้ไข

### ✅ ไฟล์ที่แก้: `api/config.php`

#### 1. เพิ่ม Output Buffering
```php
// Start output buffering to prevent premature output
ob_start();
```

**เหตุผล:** ป้องกันการส่ง output ก่อนที่จะตั้งค่า headers

---

#### 2. ปรับปรุง CORS Headers
```php
// รองรับหลาย ports
$allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: http://localhost:8080');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');
```

**เหตุผล:**
- ตั้งค่า `Access-Control-Allow-Origin` ให้ตรงกับ origin ที่เรียกมา
- รองรับทั้ง port 8080 และ 8081 (Vite อาจเปลี่ยน port)
- เพิ่ม `X-Requested-With` header
- เปิด credentials สำหรับ cookie/token

---

#### 3. จัดการ Preflight Requests
```php
// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    ob_end_clean();
    exit;
}
```

**เหตุผล:** Browser ส่ง OPTIONS request ก่อน (preflight) เพื่อตรวจสอบ CORS

---

#### 4. แก้ไข Response Functions
```php
function jsonResponse($data, int $statusCode = 200): void {
    ob_end_clean(); // เพิ่มบรรทัดนี้
    http_response_code($statusCode);
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $statusCode = 400): void {
    ob_end_clean(); // เพิ่มบรรทัดนี้
    http_response_code($statusCode);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
```

**เหตุผล:** ล้าง output buffer ก่อนส่ง response

---

## วิธีทดสอบ

1. **ตรวจสอบ Dev Server**
   ```bash
   pnpm dev
   ```
   ดูว่ารันที่ port อะไร (8080 หรือ 8081)

2. **รีโหลดหน้าเพจ**
   - กด `Ctrl + Shift + R` (hard refresh)
   - เคลียร์ cache

3. **ทดสอบ Login/Signup**
   - เปิด Developer Tools → Network tab
   - ลอง signup หรือ login
   - ตรวจสอบ headers ของ response

4. **ตรวจสอบ CORS Headers**
   ```
   Response Headers ควรมี:
   ✅ Access-Control-Allow-Origin: http://localhost:8080
   ✅ Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   ✅ Access-Control-Allow-Headers: Content-Type, Authorization...
   ✅ Content-Type: application/json; charset=utf-8
   ```

---

## Troubleshooting

### ยังเจอ CORS Error อยู่

**วิธีแก้:**

1. **ตรวจสอบ Apache Log**
   ```
   C:\xampp\apache\logs\error.log
   ```

2. **ตรวจสอบ PHP Error**
   - เปิด `php.ini`
   - ตั้งค่า: `display_errors = On`
   - Restart Apache

3. **ตรวจสอบ .htaccess**
   ถ้ามีไฟล์ `.htaccess` ใน `api/` อาจต้องเพิ่ม:
   ```apache
   Header set Access-Control-Allow-Origin "*"
   Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
   ```

4. **ตรวจสอบ Path**
   - Frontend เรียก: `http://localhost/flowstack/api/auth/signup.php`
   - ต้องเข้าถึงไฟล์: `C:\xampp\htdocs\flowstack\api\auth\signup.php`

5. **ตรวจสอบ Port**
   - Dev server รันที่ port อะไร?
   - ต้องมีใน `$allowedOrigins` array

---

## การ Debug

### ดู Request/Response Headers

**Chrome DevTools:**
1. F12 → Network tab
2. เลือก request (signup.php)
3. ดู Headers tab:
   - **Request Headers:** `Origin: http://localhost:8080`
   - **Response Headers:** `Access-Control-Allow-Origin: ...`

### ทดสอบด้วย cURL

```bash
# ทดสอบโดยตรง
curl -X POST http://localhost/flowstack/api/auth/signup.php \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d '{"email":"test@test.com","password":"123456","display_name":"Test"}' \
  -v

# ดู Response Headers
# ควรเห็น: Access-Control-Allow-Origin: http://localhost:8080
```

---

## สรุป

✅ แก้ไข `api/config.php` เพิ่ม:
- Output buffering (`ob_start()`)
- CORS headers รองรับหลาย origins
- Preflight handling
- Clean buffer ก่อน response

✅ ใช้งานได้:
- Frontend (port 8080/8081) ↔️ Backend (localhost/flowstack/api)
- ส่ง requests แบบ cross-origin ได้
- Auth token ผ่าน headers ได้

---

## อ้างอิง

- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [PHP Headers](https://www.php.net/manual/en/function.header.php)
- [Output Buffering](https://www.php.net/manual/en/function.ob-start.php)
