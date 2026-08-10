# Prospect Radar — Lead Discovery from IMAP Email

**Date:** 2026-06-18
**Status:** Approved
**Phase:** 1 (IMAP only; other sources = future phases)

---

## Goal

สแกนอีเมลจาก IMAP mailbox หลายแหล่ง → ดึง sender ที่น่าสนใจมาไว้ใน staging table → AI วิเคราะห์ + web search ข้อมูลบริษัท → user ตรวจสอบและ convert เป็น Company + Customer + Opportunity ใน sales pipeline

ใช้ข้อมูล Brand Setting (global_instruction + product_refs) เป็น context ให้ AI วัดความตรงกับสินค้า/บริการ

---

## Route & Permission

| Item | Value |
|---|---|
| Route | `/prospect-radar` |
| Component | `src/pages/ProspectRadarPage.tsx` |
| menuKey | `prospect_radar` |
| Sidebar group | `การขาย` |
| Sidebar label | `Prospect Radar` |
| Icon | `Radar` (lucide-react) |
| Guard | `<PermissionRoute menuKey="prospect_radar">` |

**Files to update:**
- `src/App.tsx` — เพิ่ม route + lazy import
- `src/components/AppSidebar.tsx` — เพิ่ม item ใน sales group
- `api/auth.php` — เพิ่ม `prospect_radar` ใน `ALL_MENU_KEYS`

---

## Database

### ตาราง `prospect_radar_sources` (ใหม่)

```sql
CREATE TABLE prospect_radar_sources (
  id                  CHAR(36)     NOT NULL PRIMARY KEY,
  tenant_id           CHAR(36)     NOT NULL,
  name                VARCHAR(100) NOT NULL,
  host                VARCHAR(255) NOT NULL,
  port                SMALLINT     NOT NULL DEFAULT 993,
  encryption          ENUM('ssl','tls','none') NOT NULL DEFAULT 'ssl',
  username            VARCHAR(255) NOT NULL,
  password_encrypted  TEXT         NOT NULL,
  folder              VARCHAR(100) NOT NULL DEFAULT 'INBOX',
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  last_scanned_at     DATETIME     NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
);
```

### ตาราง `prospect_radar_staging` (ใหม่)

```sql
CREATE TABLE prospect_radar_staging (
  id                      CHAR(36)     NOT NULL PRIMARY KEY,
  tenant_id               CHAR(36)     NOT NULL,
  source_id               CHAR(36)     NOT NULL,
  message_uid             VARCHAR(255) NOT NULL,
  sender_name             VARCHAR(255) NOT NULL DEFAULT '',
  sender_email            VARCHAR(255) NOT NULL,
  sender_domain           VARCHAR(255) NOT NULL DEFAULT '',
  subject                 VARCHAR(500) NOT NULL DEFAULT '',
  received_at             DATETIME     NULL,
  body_preview            TEXT         NULL,
  ai_score                TINYINT      NULL,
  ai_summary              TEXT         NULL,
  ai_match_reason         TEXT         NULL,
  ai_company_info         JSON         NULL,
  status                  ENUM('pending','approved','rejected','converted') NOT NULL DEFAULT 'pending',
  converted_company_id    CHAR(36)     NULL,
  converted_opportunity_id CHAR(36)   NULL,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_created (tenant_id, created_at),
  UNIQUE KEY uq_source_uid (source_id, message_uid)
);
```

Migration: `database/migrations/2026_06_18_HHMMSS_create_prospect_radar_tables.sql`

---

## API: `api/prospect-radar.php`

### Sources CRUD

| Method | Action | Description |
|---|---|---|
| GET | `?action=sources` | List all sources for tenant |
| POST | `?action=sources` | สร้าง source ใหม่ — encrypt password ก่อนบันทึก |
| PUT | `?action=sources&id=` | แก้ไข source |
| DELETE | `?action=sources&id=` | ลบ source |

**Password encryption:** ใช้ `openssl_encrypt` / `openssl_decrypt` พร้อม key จาก `company_settings` (หรือ hardcoded app key) — ไม่เก็บ plain text

### POST `?action=scan`

Body: `{ "source_id": "..." }` หรือ `{ "source_id": null }` (ทุก source)

Flow:
1. `requireAuth()` + ดึง tenant_id
2. โหลด source(s) ที่ `is_active = 1`
3. สำหรับแต่ละ source: เชื่อม IMAP ด้วย PHP `imap_open()` → ดึงอีเมลใหม่ 50 รายการล่าสุด (unseen ก่อน, หาก 0 ก็ดึง recent)
4. Parse: `sender_name`, `sender_email`, `sender_domain` (domain จาก email), `subject`, `received_at`, `body_preview` (300 chars)
5. Skip: sender_domain เป็น domain ตัวเอง, หรือ `message_uid` ซ้ำกับที่มีอยู่แล้ว (UNIQUE constraint)
6. Insert ลง `prospect_radar_staging` status=`pending`
7. Update `last_scanned_at` ของ source
8. คืน `{ scanned: N, new_prospects: M }`

### POST `?action=enrich`

Body: `{ "staging_id": "..." }`

Flow:
1. โหลด staging item
2. โหลด brand context จาก `content_global_settings` (global_instruction) + `content_global_settings.product_refs`
3. สร้าง prompt สำหรับ AI:
   - ข้อมูล: sender_email, sender_domain, subject, body_preview
   - บริษัทของเรา: global_instruction + product_refs (ชื่อสินค้า)
   - งาน: web search ข้อมูลบริษัทของ sender_domain → ให้ ai_score (0-100), ai_summary, ai_match_reason, ai_company_info
4. เรียก AI ผ่าน model ที่ตั้งค่าใน `ai_providers` (default model)
5. AI มี tool: `web_search(query)` — ค้นหาข้อมูลบริษัทจาก domain
6. Update staging row ด้วย ai_score, ai_summary, ai_match_reason, ai_company_info

**ai_company_info JSON shape:**
```json
{
  "company_name": "...",
  "industry": "...",
  "company_size": "...",
  "website": "...",
  "description": "..."
}
```

### POST `?action=approve` / `?action=reject`

Body: `{ "staging_id": "..." }`
- approve → status = `approved`
- reject → status = `rejected`

### POST `?action=convert`

Body:
```json
{
  "staging_id": "...",
  "company_name": "...",
  "company_email": "...",
  "company_website": "...",
  "contact_first_name": "...",
  "contact_last_name": "...",
  "contact_position": "...",
  "opportunity_name": "...",
  "opportunity_value": 0,
  "expected_close_date": "...",
  "assigned_to": "..."
}
```

Flow:
1. ตรวจ staging_id ต้องเป็น status `pending` หรือ `approved`
2. สร้าง/ค้นหา `companies` row (ถ้า company_email หรือ company_name ตรงกับที่มี ให้ใช้อันเดิม)
3. สร้าง `customers` row (contact) ผูกกับ company
4. สร้าง `sales_opportunities` row: stage=`lead`, lead_source=`email`
5. Update staging: status=`converted`, converted_company_id, converted_opportunity_id
6. คืน `{ company_id, opportunity_id }`

### GET `?action=staging`

Query params: `status`, `source_id`, `limit` (default 100)

คืน staging items เรียงตาม `created_at DESC`

---

## UI: ProspectRadarPage

### Layout

```
PageShell "Prospect Radar"
└── Tabs: [📧 อีเมลที่พบ] [⚙️ แหล่งอีเมล]

Tab: อีเมลที่พบ
├── Toolbar:
│   ├── Button "สแกนอีเมล" (with dropdown: เลือก source หรือ "ทั้งหมด")
│   ├── Filter tabs: ทั้งหมด | รอตรวจ | อนุมัติแล้ว | ปฏิเสธ | แปลงแล้ว
│   └── Badge count ของแต่ละ status
├── Table columns:
│   ├── ผู้ส่ง (sender_name + sender_email)
│   ├── โดเมน (sender_domain)
│   ├── หัวเรื่อง (subject truncated)
│   ├── วันที่ (received_at)
│   ├── คะแนน AI (ai_score badge: สีเขียว ≥70, เหลือง 40-69, แดง <40, เทา=ยังไม่วิเคราะห์)
│   ├── สถานะ (status badge)
│   └── Actions: [🔍 วิเคราะห์ AI] [✓] [✗] [→ Convert]
└── Empty state เมื่อไม่มีข้อมูล

Tab: แหล่งอีเมล
├── Button "เพิ่มแหล่งอีเมล"
└── Cards (grid): ชื่อ, host:port, username, status badge, สแกนล่าสุด, [แก้ไข] [ลบ]
```

### Components

| Component | File | Responsibility |
|---|---|---|
| ProspectRadarPage | `src/pages/ProspectRadarPage.tsx` | Shell + Tabs |
| StagingTable | `src/components/prospect/StagingTable.tsx` | Table + filter + scan button |
| ConvertDialog | `src/components/prospect/ConvertDialog.tsx` | Form ยืนยัน + convert |
| SourcesTab | `src/components/prospect/SourcesTab.tsx` | IMAP sources list + CRUD |
| SourceDialog | `src/components/prospect/SourceDialog.tsx` | Add/edit IMAP source form |

### ConvertDialog fields

- ชื่อบริษัท (pre-filled จาก ai_company_info.company_name หรือ sender_domain)
- อีเมลบริษัท (pre-filled จาก sender_email)
- เว็บไซต์ (pre-filled จาก ai_company_info.website)
- ชื่อ contact (pre-filled จาก sender_name split)
- นามสกุล contact
- ตำแหน่ง
- ชื่อ Opportunity (pre-filled: "ลูกค้าใหม่จาก {sender_domain}")
- มูลค่าโอกาส (บาท)
- วันปิดที่คาดการณ์
- ผู้รับผิดชอบ (select users)

---

## AI Enrichment Detail

**Model:** ใช้ AI provider ที่ตั้งค่า default ใน `ai_providers` (เดียวกับ chat)

**Web search:** เรียกผ่าน AI model ที่รองรับ tool use — query เช่น `"{domain} company industry size"`

**Prompt template:**
```
คุณคือผู้ช่วยวิเคราะห์ลีด บริษัทของเราขาย: {product_refs_names}
คำสั่งแบรนด์: {global_instruction}

วิเคราะห์ prospect นี้:
- ส่งจาก: {sender_email} ({sender_domain})
- หัวเรื่อง: {subject}
- เนื้อหาย่อ: {body_preview}

ค้นหาข้อมูลบริษัท {sender_domain} จาก web แล้วตอบ JSON:
{
  "ai_score": 0-100,
  "ai_summary": "สรุปว่า prospect นี้คือใคร",
  "ai_match_reason": "เหตุผลว่าทำไมตรง/ไม่ตรงกับสินค้าเรา",
  "ai_company_info": { "company_name", "industry", "company_size", "website", "description" }
}
```

---

## Out of Scope (Phase 1)

- OAuth / Gmail API / Microsoft Graph
- Webhook / auto-scan (schedule)
- Duplicate detection ข้าม prospect
- Email reply จากระบบ
- LinkedIn enrichment
- Import CSV

---

## Success Criteria

1. เพิ่ม IMAP source ได้หลายแหล่ง กด test connection ได้
2. กด "สแกนอีเมล" → ระบบดึงอีเมลใหม่ บันทึก staging
3. กด "วิเคราะห์ AI" → ai_score + ai_summary + company info ขึ้น
4. อนุมัติ → เปิด dialog pre-filled → confirm → สร้าง Opportunity stage=lead
5. Opportunity ปรากฏใน Sales pipeline ทันที
6. message_uid ซ้ำไม่สร้าง staging record ซ้ำ
