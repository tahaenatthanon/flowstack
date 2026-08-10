# Media Studio — kie.ai Image Generation (Phase 1)

**Date:** 2026-06-18
**Status:** Approved
**Phase:** 1 of 4 (Image only; Video, Audio, Music = future phases)

---

## Goal

สร้างหน้า `/media-studio` ใหม่สำหรับ generate ภาพผ่าน kie.ai API โดยมี 2 mode: พิมพ์ prompt อิสระ และ import scene descriptions จาก video script content card — ระบบจัดการ async job ผ่าน `media_jobs` table และ polling จาก frontend

---

## Route & Permission

| Item | Value |
|---|---|
| Route | `/media-studio` |
| Component | `src/pages/MediaStudioPage.tsx` |
| menuKey | `media_studio` |
| Sidebar group | `การตลาด` (เดียวกับ Content) |
| Sidebar label | `Media Studio` |
| Guard | `<PermissionRoute menuKey="media_studio">` |

**Files to update:**
- `src/App.tsx` — เพิ่ม route + lazy import
- `src/components/AppSidebar.tsx` — เพิ่ม item ใน group marketing
- `api/auth.php` — เพิ่ม `media_studio` ใน `ALL_MENU_KEYS`

---

## Database

### ตาราง `media_jobs` (ใหม่)

```sql
CREATE TABLE media_jobs (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  tenant_id       CHAR(36)     NOT NULL,
  created_by      CHAR(36)     NOT NULL,
  job_type        VARCHAR(20)  NOT NULL DEFAULT 'image',  -- image|video|audio|music
  provider        VARCHAR(50)  NOT NULL DEFAULT 'kieai',
  model           VARCHAR(100) NOT NULL,
  kie_task_id     VARCHAR(255) NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  prompt          TEXT         NULL,
  input_params    JSON         NULL,
  result_urls     JSON         NULL,
  error_message   TEXT         NULL,
  source_content_id CHAR(36)   NULL,  -- FK content_items (nullable)
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_created (tenant_id, created_at)
);
```

Migration: `database/migrations/YYYY_MM_DD_HHMMSS_create_media_jobs_table.sql`

---

## kie.ai Provider

เพิ่ม row ใน `ai_providers`:
- `id`: `provider-kieai`
- `name`: `kieai`
- `display_name`: `Kie.ai`
- `api_base_url`: `https://api.kie.ai/api/v1`
- `icon`: `🎨`

API Key เก็บผ่าน admin providers เดิม (`ai_provider_keys` table)

---

## API: `api/media-jobs.php`

### POST `?action=create`

Request body:
```json
{
  "model": "qwen2/text-to-image",
  "prompt": "...",
  "input_params": { "width": 1024, "height": 1024 },
  "source_content_id": null
}
```

Flow:
1. `requireAuth()` ดึง tenant_id
2. โหลด kie.ai API key จาก `ai_provider_keys` WHERE `provider_id = 'provider-kieai'`
3. POST `https://api.kie.ai/api/v1/jobs/createTask` พร้อม `{ model, input: { prompt, ...input_params } }`
4. บันทึก `media_jobs` row: `kie_task_id` จาก response, `status = 'pending'`
5. คืน `{ job_id, kie_task_id, status }`

### GET `?action=poll&id={job_id}`

Flow:
1. โหลด job จาก DB ตาม `id` + `tenant_id`
2. ถ้า `status = completed|failed` คืน DB record ทันที (ไม่ต้อง call kie.ai)
3. GET `https://api.kie.ai/api/v1/jobs/{kie_task_id}` พร้อม Bearer token
4. Map kie.ai status → `pending|processing|completed|failed`
5. ถ้า completed: update `result_urls` (JSON array of image URLs), `status = completed`
6. คืน `{ status, result_urls, error_message }`

### GET `?action=list`

คืน media_jobs ของ tenant เรียงตาม `created_at DESC` limit 50

---

## Models ที่รองรับใน Phase 1

| Model ID | ชื่อแสดง | หมายเหตุ |
|---|---|---|
| `qwen2/text-to-image` | Qwen2 Image | ราคาถูก เร็ว |
| `flux-kontext/generate` | Flux Kontext | คุณภาพสูง |
| `gpt/gpt-image-2` | GPT Image 2 | รายละเอียดสูง |

---

## UI: MediaStudioPage

### Layout

```
PageShell "Media Studio"
└── Tabs: [สร้างภาพ] [ประวัติ]

Tab: สร้างภาพ
├── Mode toggle: [✏️ พิมพ์ Prompt] [📄 จาก Video Script]
│
├── Mode A - Free Prompt
│   ├── Textarea: prompt (placeholder TH+EN)
│   ├── Select: model (Qwen2 / Flux Kontext / GPT Image 2)
│   ├── Select: ขนาด (1:1 · 16:9 · 9:16)
│   └── Button: 🎨 สร้างภาพ
│
├── Mode B - จาก Video Script
│   ├── Select: เลือก content card ประเภท video
│   ├── List: scenes (checkbox แต่ละ scene description)
│   └── Button: 🎨 สร้างภาพทุก scene ที่เลือก
│
└── ผลลัพธ์
    ├── [pending/processing] → spinner + "กำลังสร้าง..."
    └── [completed] → image grid (2 cols) + ปุ่ม Download แต่ละภาพ

Tab: ประวัติ
└── List jobs: thumbnail · model · status · created_at · ปุ่มดูภาพเต็ม
```

### Polling Logic (Frontend)

```
หลัง POST create:
  setJobId(job.job_id)
  เริ่ม interval ทุก 3 วินาที:
    GET ?action=poll&id={jobId}
    ถ้า status === 'completed' → แสดง gallery, หยุด interval
    ถ้า status === 'failed'    → แสดง error, หยุด interval
    timeout 5 นาที → หยุด interval + แสดง error
```

---

## Out of Scope (Phase 1)

- Video generation
- Audio / TTS
- Music generation (Suno)
- Image-to-image (ใส่รูปต้นแบบ)
- Webhook callback จาก kie.ai (ใช้ polling แทน)
- Share / publish media ไปยัง platform

---

## Success Criteria

1. Admin เพิ่ม kie.ai API key ผ่าน Admin › AI Providers ได้
2. หน้า `/media-studio` โหลดได้ มี 2 tab ครบ
3. Mode A: พิมพ์ prompt → กด สร้างภาพ → spinner → ภาพขึ้น gallery
4. Mode B: เลือก video script → เลือก scenes → สร้างภาพ → gallery
5. Tab ประวัติ: แสดง jobs เก่า + status + thumbnail
6. เมื่อปิด browser แล้วกลับมา ประวัติยังอยู่ (เก็บใน DB)
7. kie.ai task id ไม่ซ้ำกันข้าม tenant
