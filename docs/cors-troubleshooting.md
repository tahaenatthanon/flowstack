# 🔧 คู่มือการแก้ไขปัญหา CORS (Cross-Origin Resource Sharing)

## ❌ ปัญหาที่พบ (The Problem)

เมื่อ Frontend (React/Vite) พยายามเรียก API (PHP) ข้ามโดเมนหรือพอร์ต (เช่น localhost:8080 ไปยัง localhost:80) เบราว์เซอร์จะบล็อกคำขอเนื่องจากนโยบายความปลอดภัย (Same-Origin Policy) โดยมักจะแสดงข้อผิดพลาดดังนี้:

> "Access to fetch at '...' from origin '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."

## ✅ วิธีแก้ไข (The Solution)

ระบบ Flowstack แก้ไขปัญหานี้ที่ระดับ PHP (Server-side) โดยใช้ชุดคำสั่ง Header ต่อไปนี้ในไฟล์ `api/config.php` หรือไฟล์ที่เรียกใช้ API:

### 1. การตั้งค่า Header ใน PHP

```php
// อนุญาตให้ Origin ที่กำหนดเข้าถึงได้ (ในที่นี้คือ Vite Dev Server)
header("Access-Control-Allow-Origin: http://localhost:8080");

// อนุญาตให้ส่ง Credentials (Cookies, Auth Headers)
header("Access-Control-Allow-Credentials: true");

// อนุญาต Methods ที่จำเป็น
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// อนุญาต Headers ที่ Frontend ส่งมา
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// จัดการคำขอแบบ OPTIONS (Preflight Request)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}
```

### 2. การจัดการ Output Buffering
หากมีข้อความแจ้งเตือน (Warnings) หรือช่องว่าง (Whitespace) ก่อนการส่ง Header จะทำให้เกิดข้อผิดพลาด "Headers already sent" ควรใช้ `ob_start()` ที่จุดเริ่มต้นของสคริปต์:

```php
<?php
ob_start();
// ... rest of your code ...
```

## 🔍 การตรวจสอบ (Verification)

1. เปิด **Chrome DevTools** (F12)
2. ไปที่แท็บ **Network**
3. คลิกที่ API request ที่มีปัญหา
4. ตรวจสอบที่ **Headers** > **Response Headers**
5. ต้องพบ `Access-Control-Allow-Origin: http://localhost:8080`

---

## 📚 อ้างอิง (References)

- [MDN Web Docs: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [PHP: header - Manual](https://www.php.net/manual/en/function.header.php)
- [Vite Documentation: Server Options](https://vitejs.dev/config/server-options.html)

---
*บันทึกโดยทีมพัฒนา Flowstack*
