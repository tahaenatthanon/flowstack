# Lead Generation — Design (เฟส 1)

วันที่: 2026-06-21
สถานะ: อนุมัติแล้ว (เริ่ม implement)

## เป้าหมาย

เพิ่มเมนูแยก "ค้นหาลูกค้าใหม่" (Lead Generation) — คลัง leads กลางที่รับ lead จากหลายช่องทาง
แล้วแปลงเป็น company / opportunity ใน CRM เดิมได้

## ขอบเขตการทำงานแบบเฟส

- **เฟส 1 (spec นี้):** ตาราง `leads` + หน้า `/lead-generation` + เมนู + permission +
  intake แบบ **กรอกเอง** และ **ค้นหาจากอินเทอร์เน็ต (AI)** + **Convert → company/opportunity**
- **เฟส 2 (spec ภายหลัง):** intake จาก **นามบัตร** (เชื่อม `business-card-scan.php`) และ **CSV import**
- **เฟส 3 (spec ภายหลัง):** intake จาก **กล่องอีเมล (IMAP/POP3)** — subsystem ใหญ่ ระบบปัจจุบันยังไม่มี inbound email

## สภาพปัจจุบันที่กระทบดีไซน์

- `companies.name` เป็น UNIQUE
- `sales_opportunities` ต้องมี `company_id`, `assigned_to`, `name` (NOT NULL) →
  การแปลง lead เป็น opportunity ต้องผ่านการสร้าง/เลือก company ก่อนเสมอ
- มี `api/company-enrich.php` ทำ AI web search อยู่แล้ว → reuse logic สำหรับ `ai_search`
- `sales_opportunities.lead_source` (VARCHAR) ถูกใช้โดย `marketing-attribution.php` →
  opportunity ที่ convert มาต้องเซ็ต `lead_source` = source ของ lead

## 1) Data model — ตาราง `leads`

```
leads
  id            CHAR(36) PK
  tenant_id     CHAR(36)
  name          VARCHAR(255)     -- ชื่อบริษัท/ผู้ติดต่อ
  contact_name  VARCHAR(255)
  email         VARCHAR(255)
  phone         VARCHAR(50)
  website       VARCHAR(255)
  company_desc  TEXT
  business_type VARCHAR(100)
  source        ENUM('manual','ai_search','business_card','csv','email')  -- เฟส1: manual, ai_search
  status        ENUM('new','contacted','qualified','converted','rejected') DEFAULT 'new'
  ai_confidence VARCHAR(20)
  source_note   TEXT
  notes         TEXT
  converted_company_id     CHAR(36) NULL
  converted_opportunity_id CHAR(36) NULL
  assigned_to   CHAR(36) NULL
  created_by    CHAR(36)
  created_at    DATETIME
  updated_at    DATETIME
```

+ migration file `database/migrations/YYYY_MM_DD_HHMMSS_create_leads_table.sql` (รันจริง + verify ด้วย `SHOW COLUMNS FROM leads`)

## 2) API — `api/leads.php`

ทุก endpoint: `requireAuth()` ก่อน, scope ด้วย `tenant_id`,
non-admin เห็นเฉพาะ lead ที่ `created_by` หรือ `assigned_to` เป็นตัวเอง (ownership pattern เดิม)

```
GET    /api/leads.php                  → list (filter: status, source, search)
GET    /api/leads.php?id=...           → รายตัว
POST   /api/leads.php                  → สร้าง lead (กรอกเอง)
PUT    /api/leads.php?id=...           → แก้ไข / เปลี่ยน status
DELETE /api/leads.php?id=...           → ลบ
POST   /api/leads.php?action=ai_search → รับ keyword/ชื่อ → AI web search (reuse company-enrich logic)
                                         → คืนผลให้ผู้ใช้ review ก่อนบันทึก (ยังไม่เขียน DB)
POST   /api/leads.php?action=convert   → body { id, target: 'company'|'opportunity' }
```

**Convert logic:**
- `target=company`: สร้าง record ใน `companies`. ถ้า `name` ซ้ำ → คืน `409` + รายการ company ที่ match
  ให้ผู้ใช้เลือก link ของเดิมแทน
- `target=opportunity`: สร้าง/เลือก company ก่อน แล้วสร้าง `sales_opportunities`
  (`stage='lead'`, `assigned_to`=ผู้ใช้ปัจจุบัน, `lead_source`=source ของ lead)
- อัปเดต `leads.status='converted'` + เก็บ `converted_company_id` / `converted_opportunity_id`
- convert lead ที่ converted แล้ว → block + แจ้งเตือน

## 3) Frontend

**Route & menu:**
- `src/pages/LeadGenerationPage.tsx` → route `/lead-generation` ครอบด้วย `<PermissionRoute menuKey="lead_generation">`
- เมนูใหม่ใน `AppSidebar.tsx` กลุ่ม "การขายและ CRM" (ใต้ "ไปป์ไลน์การขาย"):
  title `'ค้นหาลูกค้าใหม่'`, icon `UserSearch`, `menuKey: 'lead_generation'`
- เพิ่ม `'lead_generation'` ใน `ALL_MENU_KEYS` (`api/auth.php`)

**โครงหน้า (PageShell + PageBreadcrumb ตาม template เดิม):**
- ปุ่ม "เพิ่มเอง" (dialog ฟอร์ม) + "ค้นหาจากอินเทอร์เน็ต" (dialog: keyword → `?action=ai_search`
  → แสดงผล AI → "บันทึกเป็น lead")
- filter bar: status / source / search (mobile pattern `flex overflow-x-auto`)
- ตาราง/การ์ด leads: ชื่อ, ติดต่อ, source badge, status badge, เมนูจัดการ
  (แก้ไข, เปลี่ยน status, Convert → บริษัท / Opportunity, ลบ)
- empty state ชวนกด "ค้นหาจากอินเทอร์เน็ต"
- ข้อความ UI ภาษาไทยทั้งหมด, React Query + invalidate หลัง mutate

## 4) Error handling & Testing

**Error handling:**
- `ai_search` ไม่มี key/timeout → error ภาษาไทย + toast, ไม่บันทึก
- convert ชื่อบริษัทซ้ำ → `409` + รายการ match ให้เลือก link ของเดิม
- convert ซ้ำ → block

**Testing:**
- Backend: ทดสอบจริง (curl/มือ) — create, ai_search, convert→company, convert→opportunity, ownership
- Frontend: `pnpm lint` + `pnpm build` ผ่าน + ทดสอบ flow ในเบราว์เซอร์
- ตรวจ migration: `SHOW COLUMNS FROM leads`
