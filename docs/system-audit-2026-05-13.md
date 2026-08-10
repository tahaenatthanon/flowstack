# FlowStack System Audit – 2026-05-13

ผู้ตรวจ: Senior Full-stack Product Engineer
ขอบเขต: 8 ปัญหาฟีเจอร์ที่ผู้ใช้แจ้ง + best practice

> สมมติฐานหลัก (อ้าง CLAUDE.md Rule #5)
> - ตรวจจากไฟล์โค้ดจริงที่ commit อยู่ที่ `C:\xampp\htdocs\flowstack` ณ วันที่ 2026-05-13
> - DB schema อ้างจาก `database/schema.sql` (ที่ระบุว่าเป็น source of truth)
> - ตัวเลข/ข้อมูลที่ใช้อ้างอิงมาจาก seed data ใน schema.sql ที่มีอยู่ และไม่ได้ดึงจาก DB จริงในขณะ audit

> **Current-State Addendum (2026-06-09):**
> - เอกสารนี้เป็น historical audit ณ วันที่ 2026-05-13 — ปัญหาหลายข้อได้รับการแก้ไขแล้ว
> - `calendar_events` (`event_type='holiday'|'leave'`) คือ source-of-truth สำหรับวันหยุด/วันลา
> - ค่า `task_type='holiday'|'leave'` ใน `tasks` เป็น legacy fallback เท่านั้น
> - การคำนวณ estimated_hours สำหรับ multi-day tasks ใช้ `capacity.php` แทน JS helper
> - `progress_percentage` เปลี่ยนเป็น hours-weighted แล้ว
> - `uq_task_dedup` constraint ถูก drop แล้ว (ทำให้ PUT tasks.php crash)
> - Rollup ครอบด้วย DB transaction แล้ว
> - `company_settings.timezone` เพิ่มแล้ว (default `Asia/Bangkok`)
> - ดูสถานะล่าสุดที่ `docs/working-hours-flow.md`

---

## สรุปผู้บริหาร (TL;DR)

| # | หัวข้อ | สถานะปัจจุบัน | ปัญหาราก (root cause) | ความเร่งด่วน |
|---|---|---|---|---|
| 1 | Project Management + Base Calendar | ทำงาน แต่ข้อมูลค้างจำนวนมาก, ไม่มี Base Calendar | (a) Auto-mark `delayed` วิ่งบนข้อมูลเก่าที่ไม่เคยปิด (b) ไม่มี field/concept สำหรับ "ปฏิทินกลาง" | สูง |
| 2 | Survey scoring | คำนวณได้ แต่ผลรวมไม่ใช่ 100% และ multiple_choice ได้ 0 | (a) `max_score × weight` ไม่ได้บังคับให้ผลรวมเป็น 100 (b) seed templates ทุก `option` ไม่มี `score` (c) ไม่มี AI ช่วยกำหนดน้ำหนัก | สูง |
| 3 | AI Content (article + video) | สร้าง "สคริปต์" ได้ ไม่สร้างวิดีโอจริง, ไม่แยกโมเดล text/image/video ใน pipeline | (a) `generate-article` ใช้ provider เดียวกับ chat (b) ไม่มี `generate-video` action (c) คอลัมน์ `ai_content_text/image/video_model_id` มีใน DB แต่ pipeline ไม่ใช้ | สูง |
| 4 | Quotation AI + Template (Excel) | ใบเสนอราคามี CRUD ใช้งาน, ไม่มีฟีเจอร์สร้างด้วย AI หรือ upload Excel template | ยังไม่มี endpoint, schema และ UI | กลาง |
| 5 | Impact OS | คำนวณได้บางส่วน แต่ไม่ครบ + ผูก assignee เป็น display_name (เปราะ) | (a) ใช้ `assignee = display_name` แทน user_id (b) ขาด normalize ระหว่าง views (c) `calcCollabScore` default 50 บิดเบือนผล | สูง |
| 6 | Company picker (type-ahead) | ใช้ `<Select>` ของ shadcn ใน 7 dialog → ต้องเลื่อนหาเอง | ไม่มี Combobox wrapper ใช้งานร่วมกัน | กลาง |
| 7 | Helpdesk AI + auto task | Tickets ทำงานได้ แต่ AI ไม่เชื่อมและไม่สร้าง task/timesheet อัตโนมัติ | ไม่มี endpoint AI หรือ hook ตอน update status | สูง |
| 8 | Best practice ระบบรวม | มี idempotent auto-migration กระจัดกระจาย, mix of legacy data | ไม่มี migration discipline, ไม่มี soft-delete นโยบายเดียวกัน, no seed cleanup | กลาง |

---

## 1) Project Management + Base Calendar (ปฏิทินทีม)

> **คำจำกัดความที่ถูกต้อง (จาก user 2026-05-13):**
> Base Calendar คือ **ปฏิทินทีม** (team-shared calendar) — เป็นปฏิทินกลางที่ทั้งทีมเห็นและใช้ร่วมกันสำหรับ
> - **วันหยุด** ขององค์กร/ราชการ
> - **ประชุม** ระดับทีม
> - **งานวิจัย** ภายในที่ทำร่วมกัน
> - **ลาหยุด** ของสมาชิกทีม (ทุกคนเห็น)
> - **งานแทรก** (interruption) ที่กระทบหลายคน
> - **และอื่น ๆ ที่ไม่ใช่ project** ที่มี client/scope ชัดเจน
>
> Base Calendar เป็น **ระบบกลาง 1 ต่อ tenant ห้ามลบ** และต้องถูก "กันออก" จากการคำนวณ KPI โปรเจกต์ (เพราะไม่ใช่งานของลูกค้า) แต่ต้องถูก "นับรวม" ในการคำนวณ resource availability/workload (เพราะกินเวลาคนจริง)

### หลักฐานจากโค้ด

`api/projects.php:54-60` รัน `UPDATE projects SET status='delayed' WHERE end_date < CURDATE() AND status NOT IN ('completed','delayed')` ทุกครั้งที่ดึงรายการ → ทำให้ทุกโปรเจกต์เก่าที่ลืมปิด กลายเป็นสถานะ `delayed` ทันที

`database/schema.sql:5140-5200` มี seed projects ปี 2021–2024 จำนวนมาก (`status=delayed`, มี `start_date = end_date` ในวันเดียว) → ทำให้รายงาน "งานค้าง" บวมไปด้วย legacy data

`database/schema.sql:6712-6748` ตาราง `tasks` มี enum `task_type` = `('task','meeting','holiday','leave','onsite','ot')` แต่ `CLAUDE.md` ระบุว่าต้องมี `weekend_work` ด้วย → ไม่ตรงกันเอง

ไม่พบ field/keyword `Base Calendar`, `is_system`, `is_protected`, `kind` ใน `projects` table → ฟีเจอร์นี้ยังไม่มีเลย

### Proposed solution (ทำให้ Base Calendar เป็นปฏิทินทีมจริง)

**ข้อ 1.1** ลบฟังก์ชัน auto-mark delayed ใน list endpoint ออก ย้ายไปเป็น **virtual status คำนวณตอน read** (เหมือนที่ `src/lib/projectUtils.ts:107 deriveProjectStatus` ทำอยู่แล้วฝั่ง FE) เพื่อเลิก mutate DB ตอน read (NO MAGIC)

**ข้อ 1.2** Migration `database/migrations/2026_05_13_120000_add_project_kind.sql` ใส่คอลัมน์ที่จำเป็นต่อ "ปฏิทินทีม":
```sql
ALTER TABLE projects
  ADD COLUMN kind ENUM('project','base_calendar') NOT NULL DEFAULT 'project'
    COMMENT 'project = งานของลูกค้า, base_calendar = ปฏิทินทีมส่วนกลาง',
  ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'ห้ามลบ (เช่น Base Calendar)',
  ADD COLUMN archived_at DATETIME NULL DEFAULT NULL;

-- กัน duplicate: 1 Base Calendar ต่อ tenant
ALTER TABLE projects
  ADD UNIQUE KEY uniq_tenant_kind_base (tenant_id, kind);
-- หมายเหตุ: unique เฉพาะกรณี kind='base_calendar' จะใช้ functional index
-- หรือใช้ application-level check + transaction lock แทน
```
Seed (one-shot, อยู่ใน migration ตัวเดียวกัน): สร้าง 1 row ต่อ tenant
```sql
INSERT INTO projects (id, tenant_id, user_id, name, description, status, kind, is_protected, start_date, end_date)
SELECT UUID(), t.id, (SELECT id FROM users u WHERE u.id IN
       (SELECT user_id FROM tenant_users tu WHERE tu.tenant_id=t.id AND tu.is_admin=1 LIMIT 1)),
       'ปฏิทินทีม', 'ปฏิทินกลางของทีม: วันหยุด ประชุม ลา งานวิจัย งานแทรก', 'on-track',
       'base_calendar', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.tenant_id=t.id AND p.kind='base_calendar');
```

**ข้อ 1.3** กันการลบใน `api/projects.php` DELETE block:
```php
$check = $db->prepare('SELECT is_protected, kind FROM projects WHERE id=? AND tenant_id=?');
$check->execute([$id, $tenantId]);
$row = $check->fetch();
if ((int)($row['is_protected'] ?? 0) === 1)
    jsonError('ไม่สามารถลบ Base Calendar (ปฏิทินทีม) ได้', 403);
```

**ข้อ 1.4** ขยาย enum `task_type` ให้รองรับงานที่ Base Calendar เก็บ (โดย `holiday/leave` ใน tasks ใช้เพื่อ compatibility):
```sql
ALTER TABLE tasks MODIFY COLUMN task_type
  ENUM('task','meeting','holiday','leave','onsite','ot',
       'weekend_work','research','interrupt')
  NOT NULL DEFAULT 'task';
```
และใน `api/tasks.php` POST/PUT — ถ้า `project_id` ผูกกับ project ที่ `kind='base_calendar'` ต้องอนุญาตเฉพาะ type ที่ไม่ใช่ `'task'` (กัน user สร้างงานลูกค้าใน Base Calendar) — ทางกลับกันก็เช่นกัน

**ข้อ 1.5** **กฎสำคัญ: Base Calendar ต้องถูก "กัน" จาก KPI โปรเจกต์ แต่ "นับ" ในการคำนวณ resource**
- ใน `src/lib/projectUtils.ts` `calculateProjectReport`: เพิ่ม early-return ถ้า `project.kind === 'base_calendar'` → คืน report เปล่า (ไม่คำนวณ %, ไม่มี at-risk)
- ใน `api/views/resource-workload.php`: ต้อง JOIN tasks ของ Base Calendar เข้ามาคำนวณ "ชั่วโมงคนใช้ไป" (เพราะลา/ประชุมก็กินเวลา)
- ใน `api/impactos.php`: `WHERE p.kind = 'project'` เพื่อกัน Base Calendar ออกจาก Speed/Revenue/Collab score
- ใน `src/components/AppSidebar.tsx`: เพิ่มเมนู "ปฏิทินทีม" (icon CalendarDays) แยกจาก "โปรเจกต์"

**ข้อ 1.6** UI/UX สำหรับปฏิทินทีม
- หน้าใหม่ `src/pages/TeamCalendarPage.tsx` ใช้ `TaskCalendarView` ที่มีอยู่ + filter `project_id = base_calendar_id`
- View modes: เดือน (default) / สัปดาห์ / รายการ
- สิทธิ์: ทุกคนใน tenant **อ่าน** ได้, **เขียน** = admin หรือ manager (validate ใน `api/tasks.php`)
- หน้า ProjectDetail: ถ้า `kind='base_calendar'` ซ่อนปุ่ม Delete, ซ่อน progress%, ซ่อน "วันที่สิ้นสุด", ใส่ป้าย "ปฏิทินทีม — ระบบกลาง"
- หน้า CreateTaskDialog: เพิ่ม section "Base Calendar quick-add" ที่มี shortcut chips: 🏖️ ลาพักร้อน / 🤒 ลาป่วย / 📅 ประชุมทีม / 🔬 งานวิจัย / 🚨 งานแทรก

**ข้อ 1.7** สคริปต์ data hygiene (one-shot): `database/migrations/2026_05_13_120100_archive_stale_projects.sql`
```sql
-- โปรเจกต์เก่าที่ end_date < 2024-01-01 และไม่มี task เปิดอยู่: archive (ไม่ใช่ลบ)
-- ระวัง: ห้าม archive Base Calendar
UPDATE projects SET archived_at = NOW(), status = 'completed'
WHERE end_date < '2024-01-01'
  AND status != 'completed'
  AND kind = 'project'
  AND id NOT IN (
    SELECT DISTINCT project_id FROM tasks
    WHERE deleted_at IS NULL AND status != 'completed' AND project_id IS NOT NULL
  );
```
+ filter `WHERE archived_at IS NULL AND kind='project'` ใน list query หลัก

### ผลที่คาดหวัง
- หน้า Projects แสดงเฉพาะงานลูกค้า (kind='project'), ไม่มี legacy stale ปี 2021-2023
- มีเมนู **"ปฏิทินทีม"** แยกในเมนูฝั่งซ้าย, click แล้วเห็นปฏิทินรวมของทีม (วันหยุด/ประชุม/ลา/วิจัย/งานแทรก)
- KPI โปรเจกต์ไม่ได้ถูก dilute ด้วยวันลา/ประชุม (เพราะ Base Calendar กันออก)
- Resource workload สะท้อนความจริง (ลาก็คือเวลาที่ใช้ไป)
- ห้ามลบโปรเจกต์ "ปฏิทินทีม" แม้ admin (ระบบเด้ง 403)

---

## 2) Survey scoring (ผลรวมต้อง 100%, multiple_choice ต้องไม่ 0)

### หลักฐานจากโค้ด

`api/survey-scoring.php:65-93`
```php
$contribution = $numeric * (float)$q['weight'];          // base
$maxScore   += (float)$q['max_score'] * (float)$q['weight'];
$percentage = $maxScore > 0 ? min(100.0, ($total / $maxScore) * 100.0) : 0.0;
```
→ ผลรวมจะเป็น 100% ก็ต่อเมื่อ user ตอบเต็มทุกข้อ + bonus เต็ม (clamp ไว้ 100) แต่ **โครงสร้างน้ำหนักไม่ได้ถูกบังคับให้รวมเป็น 1.0** เพราะ template อนุญาตให้ใส่ weight 1.0–3.0 ได้อิสระ (ดู seed line 177-186)

`api/survey-scoring.php:21-34` multiple_choice อ่าน `$opt['score']` แต่ seed template ทั้งหมด (`surveys.php:182-184`) **ไม่มี key `score`** เลย → คะแนนเป็น 0 ทุกข้อ ตามที่ผู้ใช้รายงาน

ไม่มี field `weight_explanation` หรือ `ai_recommended_weight` → ผู้ตั้งคำถามไม่มีตัวช่วย

### Proposed solution

ข้อ 2.1 บังคับให้ผลรวม weight = 100% (ไม่ใช่ใส่ free-form)
- เปลี่ยนความหมาย `weight` จาก "ตัวคูณ" เป็น "เปอร์เซ็นต์น้ำหนัก" (0–100)
- ตอน insert/update template (`surveys.php:141 insertQuestions`): validate `array_sum(weights) BETWEEN 99.5 AND 100.5` → ถ้าไม่ใช่ ให้ normalize อัตโนมัติเป็น 100 (`w_i = w_i / Σw × 100`)
- UI ฟอร์มสร้าง template: แสดง progress bar รวม % real-time + ปุ่ม "Auto-balance" หาร 100/n

ข้อ 2.2 แก้สูตรคำนวณ
```php
// คำนวณคะแนนต่อข้อเป็น % (0–100) → คูณ weight%
// score_i = (numeric / max_score) * 100
// total% = Σ (score_i * weight_i / 100) → 0..100 อยู่แล้ว
$pct = $q['max_score'] > 0 ? ($numeric / $q['max_score']) * 100 : 0;
$contribution = $pct * ((float)$q['weight'] / 100);
```
ไม่ต้อง clamp 100 ภายหลัง (เพราะ math ปิดที่ 100 อยู่แล้ว) + bonus ค่อย add แยกเป็น `bonus_score` แสดงต่างหาก ไม่ผสมกับ base

ข้อ 2.3 fix multiple_choice เป็น 0
- migration เพิ่ม `score` ในทุก option ที่ขาด: default `score = max_score` ของ option ที่ "ดีที่สุด"
- update `seedBuiltinTemplates`: ทุก option ต้องมี `value`, `label`, `score`
- UI สร้างคำถาม: ตอนพิมพ์ options บังคับให้ระบุ score 0–max_score

ข้อ 2.4 AI ช่วยกำหนดน้ำหนัก
- เพิ่ม endpoint `POST /api/surveys.php?action=suggest-weights` ส่ง `template + questions` ให้ AI text model (ใช้ `ai_default_model_id`) prompt:
  ```
  คุณคือผู้เชี่ยวชาญด้าน Survey Design
  มีคำถาม N ข้อ ดังนี้ [...]
  ให้ตอบเป็น JSON: [{question_id, weight_pct, reason}]
  เงื่อนไข: Σweight_pct = 100, ข้อที่เป็น is_critical=1 ต้องน้ำหนัก ≥ 15
  ```
- ปุ่มในฟอร์มสร้าง template: "💡 ให้ AI แนะนำน้ำหนัก"

### ผลที่คาดหวัง
- ผลคะแนนรวมไม่เกิน 100% เป็นค่าธรรมชาติของสูตร
- multiple_choice คำนวณได้จริง (ไม่ใช่ 0 เสมอ)
- ผู้ใช้กดปุ่มเดียวให้ AI ช่วยลำดับความสำคัญน้ำหนักได้

---

## 3) AI Content (article + video) — แยกโมเดลตามชนิดสื่อ

### หลักฐานจากโค้ด

`api/ai-settings.php:14-22` มี 3 คอลัมน์ `ai_content_text_model_id`, `ai_content_image_model_id`, `ai_content_video_model_id` แต่ ...

`api/brand-content.php:1352` action `generate-article` เรียก `$aiCall($mainSys, ...)` ที่ใช้ provider/model **เริ่มต้น** (ไม่ใช่ `ai_content_text_model_id`)

`api/brand-content.php:788-907` action `generate-image` ใช้ `image_gen_provider` + `image_gen_model` (legacy column) → fallback ไป `ai_content_image_model_id` ผ่าน inline SQL ที่ line 808 ก็จริง แต่ pipeline หลักยังพึ่ง column เก่า ทำให้ admin งง

ไม่มี action `generate-video` ที่ไหนเลย (`grep -ri "generate-video" → no match`) → video ที่ปรากฏใน `ContentVideoView.tsx` เป็นเพียงสคริปต์ + cover image, **ไม่ได้เรนเดอร์วิดีโอจริง**

### Proposed solution

ข้อ 3.1 ปรับ `generate-article` ให้ใช้ `ai_content_text_model_id` (fallback `ai_default_model_id`):
```php
function resolveTextModelCreds(PDO $db): ?array {
    $row = $db->query("
      SELECT ap.api_base_url, ap.api_key_encrypted, COALESCE(am_t.model_id, am_d.model_id) AS model_id
      FROM company_settings cs
      LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id
      LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
      JOIN ai_providers ap ON ap.id = COALESCE(am_t.provider_id, am_d.provider_id)
      WHERE cs.id = 1
    ")->fetch();
    // ...
}
```
ส่งเข้าฟังก์ชัน `$aiCall` (text-only) → ผลคือสคริปต์ JSON ที่มี `scenes: [{shot, narration, visual_prompt, sfx, duration_sec}]`

ข้อ 3.2 action ใหม่ `generate-scene-images` (ต่อจาก generate-article)
- input: `item_id`
- โหลด `scenes[].visual_prompt` แล้ว loop เรียก `ai_content_image_model_id`
- บันทึก `scenes[].image_url` กลับเข้า `article_content` JSON

ข้อ 3.3 action ใหม่ `generate-video`
- ต้องสร้างคอลัมน์เก็บสถานะใหม่ + URL ผลลัพธ์
  ```sql
  ALTER TABLE content_items
    ADD COLUMN video_gen_status ENUM('none','generating','done','failed') NOT NULL DEFAULT 'none',
    ADD COLUMN video_url VARCHAR(1000) NULL DEFAULT NULL,
    ADD COLUMN video_job_id VARCHAR(255) NULL DEFAULT NULL;
  ```
- เรียกผู้ให้บริการตามที่ตั้งใน `ai_content_video_model_id` (provider เช่น Veo, Runway, Pika, Kling — ใส่ใน `ai_providers.kind='video'` ค่อย dispatch ตาม `provider.name`)
- เป็น async job — return `video_job_id` ทันที, มี polling endpoint `?action=video-status&item_id=`

ข้อ 3.4 หน้า AISettingsPanel
- เพิ่ม `<Select>` 3 ตัว: Text Model, Image Model, Video Model พร้อม description ว่าใช้สำหรับอะไร
- เพิ่ม badge แสดงว่า model นั้นรองรับ video/image (เพิ่ม `ai_models.capability` enum: `text, image, video, multimodal`)

ข้อ 3.5 หน้า ContentVideoView
- ถ้า `video_url` มี → แสดง `<video>` จริง
- ถ้า `video_gen_status='generating'` → spinner + ETA
- ปุ่ม "🎬 สร้างวิดีโอจริง" ที่เรียก `generate-video`

### ผลที่คาดหวัง
- บทความสร้างได้จริงและใช้ text model ที่ตั้งไว้
- วิดีโอสร้างได้จริงครบลูป: prompt → ภาพแต่ละ scene → composite video file
- ระบบไม่ confuse model — ภาพและวิดีโอ ใช้ model ตามตั้งค่า ไม่ใช่ chat model

---

## 4) Quotation: สร้างด้วย AI + upload Excel template + ใช้ใบเก่าเป็น template

### หลักฐานจากโค้ด

`api/quotations.php:174-194` มี comment "Normalize field names - AI might send different names" → แสดงว่ามีความตั้งใจเก่าแต่ไม่มี endpoint AI generate มา

ไม่มี table `quotation_templates` ใน `database/schema.sql`

`src/components/CreateQuotationDialog.tsx` ไม่มี upload file หรือ AI button

### Proposed solution

ข้อ 4.1 Schema ใหม่
```sql
CREATE TABLE quotation_templates (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  source ENUM('excel','existing_quotation','manual') NOT NULL,
  source_file_path VARCHAR(500) NULL,         -- เก็บไฟล์ต้นฉบับ (uploads/quotation-templates/)
  source_quotation_id CHAR(36) NULL,           -- ถ้ามาจากใบเดิม
  parsed_schema JSON NOT NULL,                 -- โครงสร้างคอลัมน์/ข้อความ/format ที่ AI ใช้
  example_items_json JSON NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id)
);
```

ข้อ 4.2 endpoint ใหม่
- `POST /api/quotation-templates.php` (multipart): รับไฟล์ .xlsx → ใช้ PHP `PhpOffice\PhpSpreadsheet` parse → สร้าง template
- `POST /api/quotation-templates.php?action=from-quotation` (`quotation_id`): clone จากใบเก่า
- `GET /api/quotation-templates.php`: list
- `POST /api/quotations.php?action=ai-generate`: body = `{template_id, brief, customer_id, company_id}` → AI text model สร้างรายการ + คำนวณ + คืน draft

ข้อ 4.3 prompt มาตรฐาน
```
คุณคือ Quotation Assistant
Template ใช้รูปแบบนี้: [parsed_schema]
ตัวอย่าง items จากใบเดิม: [example_items_json]
Brief จากลูกค้า: [brief]
ตอบเป็น JSON เท่านั้น: {"items":[{item_name,description,quantity,unit,unit_price,total_price}],"discount":,"tax":,"notes":}
```

ข้อ 4.4 UI
- หน้า Admin → tab "Quotation Templates" → upload .xlsx
- ปุ่มในหน้า CreateQuotationDialog: "✨ สร้างด้วย AI" → เลือก template + กรอก brief → preview → confirm
- ในใบเดิม: เมนู kebab → "Save as template"

### ผลที่คาดหวัง
- Sales กรอกข้อมูลครั้งเดียว → AI generate รายการ → ปรับเล็กน้อย → ส่งได้
- ใบที่ format มาแล้ว reuse ได้ทันที

---

## 5) Impact OS — ทำให้รายงานครบและถูกต้อง

### หลักฐานจากโค้ด

`api/impactos.php:43, 108, 124, 151, 173` ทุก query ผูก task ด้วย
```sql
WHERE assignee = (SELECT display_name FROM users WHERE id = ?)
```
→ ปัญหา: (a) display_name เปลี่ยนได้ → ข้อมูลเก่าหลุดทันที (b) assignee ใน seed มี capitalization ไม่สม่ำเสมอ (Weerawat vs weerawat) (c) ไม่ทันแก้เมื่อ user ถูกลบ

`calcCollabScore:118` คืน 50 เมื่อไม่มี data → ตัวเลขลอยขึ้นมาผิด

`calcAiScore` normalize 50 chats = 100 → arbitrary

### Proposed solution

ข้อ 5.1 Migration ทำ FK ที่ตาราง tasks
```sql
ALTER TABLE tasks ADD COLUMN assignee_user_id CHAR(36) NULL DEFAULT NULL AFTER assignee;
-- One-shot backfill (match by display_name CI):
UPDATE tasks t
JOIN users u ON LOWER(TRIM(u.display_name)) = LOWER(TRIM(t.assignee))
SET t.assignee_user_id = u.id
WHERE t.assignee_user_id IS NULL;
```
ในแอป: เปลี่ยน input UI assignee เป็น dropdown user_id (ดู `AppSidebar.tsx` มี users list อยู่แล้ว) – `assignee` (display_name) เป็นแค่ snapshot text สำหรับ legacy

ข้อ 5.2 รีไรท์ทุก query ใน `impactos.php` ใช้ `assignee_user_id = ?` (fallback ไป display_name match ถ้า assignee_user_id IS NULL)

ข้อ 5.3 ทำให้ score คำนวณบน data ที่มีจริง:
- `calcCollabScore`: ถ้า total = 0 → คืน `null` (FE แสดง "ไม่มีข้อมูล") ไม่ใช่ 50
- `calcAiScore`: ทำ benchmark per tenant (median chat ต่อเดือน) แทน hard-code 50

ข้อ 5.4 เพิ่ม view ที่ขาด:
- `view=quality`: defect_rate (rework) = #tasks ที่ถูก `paused_at` then resumed / total
- `view=customer`: NPS, ticket SLA hit rate, repeat business rate

ข้อ 5.5 หน้า ImpactOSPage แสดง "ที่มาของข้อมูล" ใต้ตัวเลขทุกตัว (tooltip click → modal explain formula) — รองรับ NO MAGIC rule

### ผลที่คาดหวัง
- คะแนนผูกผู้ใช้แบบเสถียร (user_id)
- คะแนน 0 vs "ไม่มีข้อมูล" ต่างกันชัดเจน
- รายงาน 5 มิติ (Speed, Impact, AI, Collab, Customer/Quality)

---

## 6) Company picker เป็น type-ahead

### หลักฐานจากโค้ด

มี `<Select>` แสดงรายการบริษัทแบบ static ใน 7 ไฟล์:
- `CreateCustomerDialog.tsx`
- `CreateProjectDialog.tsx`
- `CreateOpportunityDialog.tsx`
- `CreateQuotationDialog.tsx`
- `EditProjectDialog.tsx`
- `SendSurveyDialog.tsx`
- `SurveyResponseDetailDialog.tsx`

มีอยู่แล้ว: `src/components/ui/command.tsx` (cmdk) — เครื่องมือพร้อม ขาดแต่ wrapper

### Proposed solution

ข้อ 6.1 สร้างคอมโพเนนต์รวม `src/components/CompanyCombobox.tsx`
```tsx
type Props = {
  value: string;
  onChange: (id: string, company?: Company) => void;
  placeholder?: string;
  disabled?: boolean;
};
```
- ใช้ `Popover` + `Command` (cmdk filter)
- query: `useCompanies()` แล้ว `companies.sort((a,b)=> a.name.localeCompare(b.name,'th'))`
- พิมพ์ → filter (case-insensitive, accent-insensitive)
- ปุ่ม "+ สร้างบริษัทใหม่" ปรากฏท้ายผลค้นหาเมื่อไม่มี match → เปิด CreateCompanyDialog inline

ข้อ 6.2 Refactor 7 dialog ให้ใช้ `<CompanyCombobox>` แทน `<Select>` — เป็น drop-in (เก็บ register/setValue เหมือนเดิม)

### ผลที่คาดหวัง
- พิมพ์ 1-2 ตัวอักษรเจอบริษัท
- จัดเรียง A→Z (th-locale) สม่ำเสมอ
- ลด UX friction ในทุก dialog ที่เกี่ยวข้อง

---

## 7) Helpdesk AI + auto task

### หลักฐานจากโค้ด

`api/support-tickets.php` ไม่มี keyword `ai`, `assist`, `suggest` → ไม่มี AI hook
`api/ai-insights.php:41-48` อ่าน ticket แต่แค่นับจำนวน
ไม่มี logic สร้าง task/timesheet entry อัตโนมัติเมื่อ ticket เปลี่ยนสถานะ

### Proposed solution

ข้อ 7.1 endpoint ใหม่ `POST /api/support-tickets.php?action=ai-suggest`
- ส่ง `ticket.title`, `description`, `category`, `customer_id` → AI text model
- prompt:
  ```
  คุณคือ Helpdesk Engineer
  มีตั๋ว: [...]
  ตอบ JSON: {
    "category_suggested": "...",
    "priority_suggested": "low|medium|high|critical",
    "first_response_th": "...",
    "checklist": ["...","..."],
    "estimated_hours": 0.5
  }
  ```
- UI: ปุ่ม "🤖 AI ช่วยจัดการ" ในหน้า TicketDetail

ข้อ 7.2 Auto-link ticket → task เมื่อ status เปลี่ยนเป็น `in-progress`:
- hook ใน PUT `support-tickets.php`
  ```php
  if ($oldStatus !== 'in-progress' && $newStatus === 'in-progress') {
      $taskId = generateUUID();
      $db->prepare("INSERT INTO tasks
        (id, tenant_id, project_id, user_id, title, description, status, priority,
         assignee_user_id, start_date, end_date, estimated_hours, task_type)
        VALUES (?, ?, ?, ?, ?, ?, 'in-progress', ?, ?, CURDATE(), CURDATE(), ?, 'task')")
        ->execute([$taskId, $tenantId,
          getBaseCalendarProjectId($db, $tenantId),  // หรือ project ที่ผูก contract
          $userId, "Support: " . $ticket['title'],
          $ticket['description'], $ticket['priority'], $ticket['assigned_to'],
          $ticket['ai_estimated_hours'] ?? 1]);
      // เก็บ link
      $db->prepare("UPDATE support_tickets SET task_id=? WHERE id=?")
        ->execute([$taskId, $ticketId]);
  }
  ```
- ตอนปิด ticket: คำนวณ `actual_hours` จาก `(closed_at - created_at)` หรือจาก timesheet entry ที่ user log ใต้ task นั้น

ข้อ 7.3 Schema เพิ่ม
```sql
ALTER TABLE support_tickets
  ADD COLUMN task_id CHAR(36) NULL DEFAULT NULL,
  ADD COLUMN ai_suggested_json JSON NULL DEFAULT NULL,
  ADD FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
```

ข้อ 7.4 หน้า ticket แสดง section "งานที่ผูก" + "Timesheet entries ที่ log แล้ว" + ปุ่ม "Quick log 30/60 min"

### ผลที่คาดหวัง
- ทีม Support ไม่ต้องสร้าง task/timesheet เอง ระบบทำให้
- AI ช่วยเขียน first response + ประเมิน priority/effort
- รายงาน Impact OS ของทีม Support คำนวณได้ครบ (เพราะ timesheet ลงถูก)

---

## 8) Best practice ระบบรวม

ที่พบในระหว่าง audit (ขัดกับ "NO MAGIC"):

ข้อ 8.1 มี idempotent `ALTER TABLE` หลายไฟล์ (`content-items.php:12-14`, `ai-settings.php:23-25`, `brand-content.php:81-82`) — ทำงานทุกครั้งที่ endpoint โดน hit
- **แก้:** ย้ายไปไฟล์ `database/migrations/*.sql` ตามที่ CLAUDE.md บังคับ + เลิกใส่ ALTER ใน runtime
- เพิ่ม CLI runner: `php database/migrate.php` (track ที่ตาราง `_migrations`)

ข้อ 8.2 ตอน read endpoint บางที่ mutate DB (`projects.php:54-60` UPDATE … delayed) → ผิดหลัก idempotent GET
- **แก้:** ย้าย logic ไป cron job หรือ derive ตอน read โดย return เป็น field คำนวณไม่ persist

ข้อ 8.3 ทดสอบ (ไม่มี / น้อยมาก)
- `pnpm test` ไม่เห็น test file ใน `src/`
- **แก้:** เพิ่มอย่างน้อย:
  - `src/lib/projectUtils.test.ts` — unit test `calculateProjectReport`, `deriveProjectStatus`, `calculateImpactSimulation`
  - `api/tests/SurveyScoringTest.php` — phpunit สำหรับ `calculateScore` (มี case multiple_choice, yes_no, scale_1_5, critical bonus, normalize-100)
  - integration test สำหรับ `quotations` AI generate

ข้อ 8.4 ลด N+1 ใน `impactos.php:163-187` (loop ต่อ project แล้ว query 3 ครั้ง) → JOIN เดียว

ข้อ 8.5 Logging มาตรฐาน: ทุก API ต้องเขียน `user_activity_logs` แบบเดียวกัน (มีบางที่ขาด เช่น `ai-settings.php` ไม่ log การเปลี่ยน provider)

ข้อ 8.6 Secret management: `JWT_SECRET` ใช้เป็น key เข้ารหัส `api_key_encrypted` (`impactos.php:207`) — ถ้า JWT_SECRET หมุน เครื่องมือ AI ใช้ไม่ได้ทันที
- **แก้:** แยก `ENCRYPTION_KEY` ออกจาก `JWT_SECRET` ใน `api/config.php`

ข้อ 8.7 Soft delete ไม่สม่ำเสมอ
- `tasks.deleted_at` มี, `projects.deleted_at` มี, แต่ `companies`, `customers`, `quotations` ไม่มี → ลบจริง

---

## ลำดับความสำคัญแนะนำ (sprint plan)

**Sprint 1 (ทำได้เร็ว ผลกระทบสูง)**
1. Issue #2 fix survey scoring formula + seed scores (1 วัน)
2. Issue #6 CompanyCombobox + refactor 7 dialogs (1 วัน)
3. Issue #1.1, #1.2, #1.3 Base Calendar + ลบ auto-mark delayed (2 วัน)

**Sprint 2**
4. Issue #5 impactos refactor ใช้ user_id (2 วัน)
5. Issue #1.5 data hygiene migration (0.5 วัน)
6. Issue #2.4 AI suggest weights (1 วัน)

**Sprint 3**
7. Issue #7 Helpdesk AI + auto task (3 วัน)
8. Issue #4 Quotation AI + Excel template (3 วัน)

**Sprint 4**
9. Issue #3 AI Content video pipeline (5 วัน — ต้องเชื่อม external API)

**Sprint 5 — ทำความสะอาด**
10. Issue #8 migrations + tests + security (3 วัน)

---

## คำเตือน (DISSENT — CLAUDE.md Rule #3)

ก) การ "ทำให้ทำงานได้จริง" สำหรับ AI video (#3) ต้องเชื่อม API ภายนอก (Veo/Runway/Pika/Kling) ทุกราย มีค่าใช้จ่ายต่อวิดีโอ + อาจมี waitlist/quota — แนะนำเริ่มจาก provider เดียวก่อน (เช่น Replicate ที่ support หลาย model) ไม่ใช่ implement ทุกผู้ให้บริการพร้อมกัน

ข) data hygiene ใน #1.5 จะ archive โปรเจกต์เก่าจำนวนมาก — ก่อนรัน production ขอให้ user (admin) export Excel backup ของรายการที่จะถูก archive ไว้ก่อน (มี `api/export.php` อยู่แล้ว) เพื่อเลี่ยงสูญหาย

ค) ขอ confirm 1 ข้อ: weight ใน survey ที่เปลี่ยน semantics จาก "multiplier" เป็น "percentage" จะกระทบ template เก่าทุกตัว — มี migration script auto-normalize ให้ แต่ค่าคะแนนของ response เก่าจะคำนวณใหม่ → ถ้าต้องการให้คะแนนเดิมไม่เปลี่ยน ต้อง freeze (เก็บ `final_score` snapshot ไว้ที่ตาราง `survey_responses` ตอน submit)
