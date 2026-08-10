# คู่มือ API ใบเสนอราคา (Quotation API)

Base URL: `http://localhost:8080/api` (dev) · `https://yourdomain.com/api` (prod)  
Auth: ทุก endpoint ต้องส่ง `Authorization: Bearer <token>` ใน header  
Content-Type: `application/json`

---

## 1. เข้าสู่ระบบ / รับ Token

```bash
curl -s -X POST http://localhost:8080/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": { "id": "uuid", "email": "...", "tenant_id": "uuid", "is_admin": 1 }
  }
}
```

> เก็บ `data.token` ไว้ใช้ใน request ถัดไปทั้งหมด

---

## 2. ขอเลขที่ใบเสนอราคาถัดไป

```bash
curl -s http://localhost:8080/api/next-quotation-number.php \
  -H "Authorization: Bearer <TOKEN>"
```

**Response:**
```json
{
  "data": {
    "next_number": "QT-202606-0001",
    "period_key": "global",
    "sequence": 1,
    "format": "{PREFIX}{YYYY}{MM}-{NNNN}"
  }
}
```

> ⚠️ เลขนี้ไม่ถูก reserve — ต้อง POST สร้างใบเสนอราคาทันทีก่อนที่ request อื่นจะขอเลขเดิม

---

## 3. สร้างใบเสนอราคา (POST)

```bash
curl -s -X POST http://localhost:8080/api/quotations.php \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid-ของบริษัท",
    "quotation_number": "QT-202606-0001",
    "subject": "ใบเสนอราคาระบบ ERP สำหรับโรงงาน",
    "valid_until": "2026-07-31",
    "issue_date": "2026-06-19",
    "status": "draft",
    "total_amount": 150000,
    "discount": 0,
    "tax": 10500,
    "grand_total": 160500,
    "payment_terms": "มัดจำ 30% ชำระเมื่อส่งมอบ 70%",
    "notes": "ราคานี้มีผลภายใน 30 วัน",
    "opportunity_id": "uuid (optional)",
    "customer_id": "uuid (optional)",
    "items": [
      {
        "item_name": "พัฒนาระบบ Phase 1",
        "description": "วิเคราะห์ความต้องการและออกแบบระบบ",
        "quantity": 1,
        "unit": "งาน",
        "unit_price": 80000,
        "total_price": 80000
      },
      {
        "item_name": "พัฒนาระบบ Phase 2",
        "description": "พัฒนาและทดสอบระบบ",
        "quantity": 1,
        "unit": "งาน",
        "unit_price": 70000,
        "total_price": 70000
      }
    ]
  }'
```

**Fields ที่จำเป็น (required):**
| Field | Type | คำอธิบาย |
|-------|------|----------|
| `company_id` | UUID | บริษัทลูกค้า (ต้องมีในระบบ) |
| `quotation_number` | string | เลขที่ใบเสนอราคา (ห้ามซ้ำ) |
| `valid_until` | YYYY-MM-DD | วันหมดอายุ |
| `items` | array | รายการสินค้า/บริการ (อย่างน้อย 1 รายการ) |

**Fields เพิ่มเติม (optional):**
| Field | Type | Default | คำอธิบาย |
|-------|------|---------|----------|
| `subject` | string | `""` | หัวข้อ/เรื่อง |
| `issue_date` | YYYY-MM-DD | วันนี้ | วันที่ออก |
| `status` | enum | `draft` | draft / sent / approved / rejected / expired |
| `opportunity_id` | UUID | null | โอกาสการขายที่เชื่อมโยง |
| `customer_id` | UUID | null | ผู้ติดต่อ |
| `total_amount` | number | 0 | รวมก่อนหักส่วนลด |
| `discount` | number | 0 | ส่วนลด (บาท) |
| `tax` | number | 0 | VAT (บาท) |
| `grand_total` | number | 0 | ยอดสุทธิ |
| `payment_terms` | string | `""` | เงื่อนไขการชำระ |
| `notes` | string | `""` | หมายเหตุ |

**Response (HTTP 201):**
```json
{
  "data": {
    "quotation_id": "9680f035-2e2d-492d-bf0b-5f0751fe8bdc",
    "quotation_number": "QT-202606-0001",
    "subject": "ใบเสนอราคาระบบ ERP สำหรับโรงงาน",
    "status": "draft",
    "company_name": "ชื่อบริษัท",
    "total_amount": 150000,
    "grand_total": 160500,
    "item_count": 2,
    "items": [
      { "item_name": "พัฒนาระบบ Phase 1", "quantity": 1, "unit_price": 80000, "total_price": 80000 }
    ]
  }
}
```

---

## 4. ดูรายการใบเสนอราคา (GET list)

```bash
curl -s "http://localhost:8080/api/quotations.php" \
  -H "Authorization: Bearer <TOKEN>"

# กรองตาม company
curl -s "http://localhost:8080/api/quotations.php?company_id=<UUID>" \
  -H "Authorization: Bearer <TOKEN>"

# กรองตาม status
curl -s "http://localhost:8080/api/quotations.php?status=draft" \
  -H "Authorization: Bearer <TOKEN>"

# กรองตาม opportunity
curl -s "http://localhost:8080/api/quotations.php?opportunity_id=<UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**Query Parameters:**
| Parameter | คำอธิบาย |
|-----------|----------|
| `id` | UUID — ดึงรายการเดียวพร้อม items |
| `company_id` | UUID — filter ตามบริษัท |
| `opportunity_id` | UUID — filter ตาม opportunity |
| `status` | draft / sent / approved / rejected / expired |

---

## 5. ดูใบเสนอราคาเดียว พร้อมรายการสินค้า (GET single)

```bash
curl -s "http://localhost:8080/api/quotations.php?id=<QUOTATION_UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response:**
```json
{
  "data": {
    "quotation_id": "uuid",
    "quotation_number": "QT-202606-0001",
    "subject": "หัวข้อ",
    "issue_date": "2026-06-19",
    "valid_until": "2026-07-31",
    "status": "draft",
    "total_amount": 150000,
    "discount": 0,
    "tax": 10500,
    "grand_total": 160500,
    "payment_terms": "...",
    "notes": "...",
    "company_name": "ชื่อบริษัท",
    "customer_name": "ชื่อผู้ติดต่อ",
    "opportunity_name": "ชื่อโอกาสการขาย",
    "created_by_name": "ชื่อผู้สร้าง",
    "items": [
      {
        "id": "uuid",
        "item_name": "พัฒนาระบบ Phase 1",
        "description": "วิเคราะห์ความต้องการ",
        "quantity": 1,
        "unit": "งาน",
        "unit_price": 80000,
        "total_price": 80000,
        "sort_order": 0
      }
    ]
  }
}
```

---

## 6. แก้ไขใบเสนอราคา (PUT)

รองรับ partial update — ส่งเฉพาะ field ที่ต้องการเปลี่ยน

```bash
# เปลี่ยน status เป็น sent
curl -s -X PUT "http://localhost:8080/api/quotations.php?id=<UUID>" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "sent"}'

# แก้ไขราคาและรายการพร้อมกัน (items จะถูกแทนที่ทั้งหมด)
curl -s -X PUT "http://localhost:8080/api/quotations.php?id=<UUID>" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "หัวข้อใหม่",
    "discount": 5000,
    "grand_total": 155500,
    "status": "sent",
    "items": [
      { "item_name": "รายการใหม่", "quantity": 1, "unit": "งาน", "unit_price": 155500, "total_price": 155500 }
    ]
  }'
```

**Fields ที่แก้ไขได้:**
`subject`, `opportunity_id`, `company_id`, `customer_id`, `quotation_number`, `issue_date`, `valid_until`, `total_amount`, `discount`, `tax`, `grand_total`, `status`, `payment_terms`, `notes`, `items`

> ⚠️ ถ้าส่ง `items` — รายการเดิมทั้งหมดจะถูกลบและแทนที่ด้วยรายการใหม่

---

## 7. ลบใบเสนอราคา (DELETE)

```bash
curl -s -X DELETE "http://localhost:8080/api/quotations.php?id=<UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response:**
```json
{ "data": { "message": "ลบใบเสนอราคาสำเร็จ" } }
```

---

## 8. ให้ AI สร้างรายการอัตโนมัติ (ไม่ save)

```bash
curl -s -X POST "http://localhost:8080/api/quotations.php?action=ai-generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "uuid-ของ-template",
    "brief": "ระบบ ERP สำหรับโรงงานผลิต 200 user 6 เดือน รวมฝึกอบรม"
  }'
```

**Response:**
```json
{
  "data": {
    "items": [
      { "item_name": "License ระบบ ERP", "quantity": 200, "unit": "user", "unit_price": 500, "total_price": 100000 },
      { "item_name": "Implementation", "quantity": 1, "unit": "งาน", "unit_price": 200000, "total_price": 200000 }
    ],
    "discount": 0,
    "tax": 21000,
    "notes": "ราคารวมค่าติดตั้งและฝึกอบรม",
    "payment_terms": "มัดจำ 30% ชำระเมื่อส่งมอบ 70%"
  }
}
```

> ⚠️ ต้องตั้งค่า AI Provider ใน Admin → AI Settings ก่อน

---

## 9. ให้ AI สร้างรายการจาก Opportunity (ไม่ save)

```bash
curl -s -X POST "http://localhost:8080/api/quotations.php?action=ai-fill" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "opportunity_id": "uuid-ของ-opportunity",
    "template_id": "uuid (optional)"
  }'
```

**Response:**
```json
{
  "data": {
    "items": [
      { "item_name": "บริการออกแบบ", "quantity": 1, "unit": "งาน", "unit_price": 50000, "total_price": 50000 }
    ]
  }
}
```

---

## 10. รายการ Templates (สำหรับ AI)

```bash
curl -s http://localhost:8080/api/quotation-templates.php \
  -H "Authorization: Bearer <TOKEN>"
```

**Response:**
```json
{
  "data": [
    { "id": "uuid", "name": "Template IT Project", "source": "excel", "created_at": "2026-06-01" }
  ]
}
```

---

## ตัวอย่าง Workflow: สร้างใบเสนอราคาแบบ end-to-end

```bash
#!/bin/bash
BASE="http://localhost:8080/api"

# 1. Login
TOKEN=$(curl -s -X POST $BASE/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

H="-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'"

# 2. ขอเลขถัดไป
NEXT=$(curl -s $BASE/next-quotation-number.php \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['next_number'])")
echo "Next: $NEXT"

# 3. สร้างใบเสนอราคา
RESULT=$(curl -s -X POST $BASE/quotations.php \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"company_id\": \"YOUR_COMPANY_UUID\",
    \"quotation_number\": \"$NEXT\",
    \"subject\": \"ใบเสนอราคาทดสอบ\",
    \"valid_until\": \"2026-07-31\",
    \"items\": [{
      \"item_name\": \"บริการพัฒนาซอฟต์แวร์\",
      \"quantity\": 1,
      \"unit\": \"งาน\",
      \"unit_price\": 100000,
      \"total_price\": 100000
    }]
  }")

echo "$RESULT" | python3 -m json.tool
```

---

## Error Codes

| HTTP | ความหมาย |
|------|----------|
| 201 | สร้างสำเร็จ |
| 400 | ข้อมูลไม่ครบ (company_id / quotation_number / valid_until ขาด) |
| 401 | Token ไม่ถูกต้องหรือหมดอายุ |
| 404 | ไม่พบใบเสนอราคา |
| 500 | ข้อผิดพลาดฐานข้อมูล |

**ตัวอย่าง Error Response:**
```json
{ "error": "กรุณาระบุบริษัท" }
```
