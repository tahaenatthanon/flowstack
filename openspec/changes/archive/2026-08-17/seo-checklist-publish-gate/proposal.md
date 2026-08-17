## Why

เฟส 0 ทำให้ระบบบันทึกผลเผยแพร่ได้จริงแล้ว แต่ยัง**ไม่มี gate ตรวจคุณภาพ SEO ก่อนปล่อย** — ผู้ใช้สามารถเผยแพร่คอนเทนต์ที่ `seo_title` ว่าง, `meta_description` เกิน/สั้น, slug ไม่ถูกต้อง, หรือไม่มี `h2` เลยก็ได้ ทำให้โครงสร้าง publish ที่เพิ่งซ่อมไปถูกใช้กับคอนเทนต์ที่ไม่มีโอกาสติดอันดับ SEO เลย จำเป็นต้องมี checklist กลาง (pure PHP ไม่พึ่งบริการภายนอก) ที่ประเมินฟิลด์ SEO ที่มีอยู่แล้วบน `content_items` และมีเกตเลือกเปิดได้เพื่อบล็อกการเผยแพร่เมื่อคะแนน/กฎไม่ผ่าน

## What Changes

- เพิ่ม `api/lib/seo-checklist.php` — ฟังก์ชันบริสุทธิ์ `seo_evaluate(array $item): array` คืน `['score' => int, 'rules' => [['key','level'=>'pass|warn|fail|skip','message']]]`
- กฎ SEO: `seo_title` 1–60, `meta_description` 120–160, slug ตัวพิมพ์เล็ก-ขีดคั่น, มี `h2` ≥1, ไม่มี `h1` ในเนื้อหา, คำ ≥500, คีย์เวิร์ดหลักอยู่ใน title+ย่อหน้าแรก+หัวข้อ, `structured_data` parse ได้มี `@context`/`@type`, ตั้ง `og_image`, ลิงก์ภายใน ≥1
- Migration เพิ่ม `seo_gate_enabled TINYINT(1) DEFAULT 0`, `seo_gate_min_score TINYINT UNSIGNED DEFAULT 0` ใน `content_global_settings` (**ปิด default** — ไม่ให้ flow เดิมพัง)
- เพิ่ม endpoint `?action=seo-checklist&item_id=` (GET) ใน `api/brand-content.php` สำหรับ UI สด
- เรียก `seo_evaluate()` ตัวเดียวกันใน `?action=publish`, `send_now`, และ `publish-scheduler.php` เพื่อบล็อกเมื่อ `seo_gate_enabled=1` และมีกฎ `fail` (หรือคะแนนต่ำกว่า `seo_gate_min_score`)
- UI: แผง checklist ใน `ArticleEditor.tsx` (ใช้ซ้ำ collapsible `seoOpen`) + ข้อความบล็อกใน `ContentApprovalTab.tsx` — ข้อความผู้ใช้ทั้งหมดเป็น**ภาษาไทย**

## Capabilities

### New Capabilities

- `content-seo-checklist`: การประเมิน SEO ของคอนเทนต์ก่อนเผยแพร่ — ฟังก์ชัน `seo_evaluate()` ที่คืนคะแนน + กฎตรวจ, การตั้งค่าเกตใน `content_global_settings`, endpoint `seo-checklist`, และเกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน

### Modified Capabilities

<!-- none -->

## Impact

- `api/lib/seo-checklist.php` — ไฟล์ใหม่ (ฟังก์ชันบริสุทธิ์)
- `api/brand-content.php` — เพิ่ม `?action=seo-checklist` (GET) + เรียกเกตใน `?action=publish` / `?action=cron-publish`
- `api/content-publish.php` — เรียกเกตใน `send_now`
- `api/cron/publish-scheduler.php` — เรียกเกตก่อน dispatch
- `database/migrations/` — migration ใหม่ 1 ไฟล์ (เพิ่ม 2 คอลัมน์ใน `content_global_settings`)
- `src/components/content/ArticleEditor.tsx` — แผง checklist (ใช้ `seoOpen`)
- `src/components/content/tabs/ContentApprovalTab.tsx` — ข้อความบล็อกการอนุมัติ/เผยแพร่
- ไม่พึ่งบริการภายนอก (pure PHP) ไม่แตะ schema ของ `content_items`
