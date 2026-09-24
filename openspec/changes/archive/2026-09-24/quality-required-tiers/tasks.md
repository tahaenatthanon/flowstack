## 1. Tier และเกณฑ์ใน checklist

- [x] 1.1 `api/lib/seo-checklist.php`: แก้ `SEO_WEIGHTS`
  - tier: required 8 ข้อ / recommended 7 ข้อ ตาม D1
  - เปลี่ยน `optional` → `recommended` และแก้คอมเมนต์ tier
- [x] 1.2 `api/lib/aeo-checklist.php`: แก้ `AEO_WEIGHTS`
  - required = `direct_answer`, `structured_data`
  - อีก 6 ข้อที่เหลือเป็น recommended
- [x] 1.3 เพิ่มค่าคงที่ `META_DESC_HARD_MAX = 160` และ `WORD_COUNT_HARD_MIN = 300` แล้วแก้ `seo_evaluate`
  - `meta_description`: 1–119 = `needs_improvement`, > 160 = `failed`
  - `content_length` (article): 300–499 = `needs_improvement`, < 300 = `failed`
  - `primary_keyword_placement`: 1 ถึง N−1 ตำแหน่ง = `needs_improvement`, 0 = `failed`
  - ข้อความ message ต้องระบุค่าจริงและเกณฑ์
- [x] 1.4 `seo_generation_requirements()`
  - `pass_condition` = เกณฑ์ Required
  - เพิ่มฟิลด์ `recommended` (ช่วงแนะนำ)
  - `seo_contract_hints()` ให้ prompt บอกทั้งเกณฑ์บังคับและช่วงแนะนำ

## 2. Gate status และ Quality Gate กลาง

- [x] 2.1 `seo_gate_status()` / `aeo_gate_status()` คืน `failed` เฉพาะเมื่อมี required `failed` กรณีอื่นคืน `passed`
  - ลบ `SEO_GATE_PASS_SCORE`/`SEO_GATE_WARN_SCORE`/`AEO_GATE_*`
  - ค้นหาทุกจุดที่อ้างค่าเหล่านี้ทั้ง repo แล้วแก้ให้หมด
- [x] 2.2 เพิ่ม `quality_required_status(array $seoEval, array $aeoEval): array` คืน `status` + `failed_required` (`quality`/`key`/`message`/`expected`)
- [x] 2.3 เพิ่ม `quality_required_gate($db, $tenantId, $content, $brief, $requireMarker = true)` ใน `api/lib/publish-dispatch.php` ตามลำดับใน D4
  1. ถ้าเป็น video → ข้าม
  2. ถ้า `seo_gate_enabled=0` → เช็คแค่ marker
  3. ถ้าไม่มี marker → บล็อก
  4. evaluate ใหม่แล้วตัดสินด้วย `quality_required_status`
- [x] 2.4 `content_quality_gate_check()` (ขออนุมัติ) เรียก gate กลาง โดยคงการจำกัดเฉพาะเมื่อเลือก platform เว็บ
- [x] 2.5 `final_publish_gate_check()` ใช้ gate กลางแทน `seo_gate_check` + `aeo_gate_status` สำหรับ platform เว็บ
- [x] 2.6 `api/cron/publish-scheduler.php:149` ใช้ gate กลางแทน `seo_gate_check`
- [x] 2.7 ค้นหาผู้เรียก `seo_gate_check()` ที่เหลือทั้งหมด แล้วลบ หรือเปลี่ยนเป็น wrapper ของ gate กลาง
  - ยืนยันว่าไม่มีจุดใดอ่าน `seo_gate_min_score` เพื่อตัดสินผลอีก
- [x] 2.8 (พบตอนทดสอบ UI) `api/content-items.php` PUT `status=pending_approval` — ปุ่ม "ขออนุมัติ" ของ dialog/ContentDetailView ใช้เส้นทางนี้ ไม่ผ่าน `approvals.php` → เรียก `content_quality_gate_check()` ด้วย (เดิมไม่มี gate เลย)

## 3. Generate: repair 1 รอบและยกเว้นวิดีโอ

- [x] 3.1 `api/brand-content.php`: แทนลูป SEO repair และ AEO repair เดิมด้วย repair รวม 1 รอบ (`QUALITY_REPAIR_MAX_ROUNDS = 1`)
  - feedback เฉพาะ required `failed` จากทั้ง SEO+AEO พร้อม `expected`/`actual`
  - คงการกรอง scripts ตาม `scriptPlatforms` และการ rebuild ฟิลด์บทความหลัง repair
- [x] 3.2 หลัง repair ให้ evaluate SEO+AEO ใหม่ แล้วตัดสินด้วย `quality_required_status`
  - ผ่าน: ตั้ง `quality_checked_at`
  - ไม่ผ่าน: `status='revision'` + `failed_required` และไม่ตั้ง marker
- [x] 3.3 วิดีโอ (`$isVideo`): evaluate เพื่อเก็บคะแนนเท่านั้น
  - ไม่ repair ไม่ตั้ง revision จาก SEO/AEO
  - `generation_status='success'` ด้าน quality
- [x] 3.4 `quality-recheck` และ `seo-checklist` endpoint คืน `gate` ตามกฎใหม่
  - เพิ่ม `failed_required` ใน `quality-recheck`
  - `seo-checklist` เลิกคืน/ใช้ `seo_gate_min_score` ในการตัดสิน

## 4. Frontend

- [x] 4.1 `src/components/content/types.ts`: `SeoRuleTier = 'required' | 'recommended' | 'informational' | 'optional'` (optional = legacy)
  - `SEO_TIER_LABEL`: ข้อบังคับ / ข้อแนะนำ
  - แก้ type ของผล recheck ใน `useContent.ts` (`failed_required`)
- [x] 4.2 สร้างคอมโพเนนต์รายการผลตรวจกลาง
  - แยกกลุ่ม "ข้อบังคับ (Required)" / "ข้อแนะนำ (Recommended)"
  - สถานะรายข้อ + ข้อความ
  - หัวแผง "ผ่าน" หรือ "ไม่ผ่าน (ติดข้อบังคับ N ข้อ)" + คะแนน xx/100 เป็นข้อมูลรอง
- [x] 4.3 `ArticleEditor.tsx`
  - ถอดปุ่ม "ตรวจ SEO" และการเรียก `seo-checklist` เอง
  - แผงรับผลตรวจจาก props แล้วแสดงด้วยคอมโพเนนต์กลาง
  - ถ้ายังไม่มีผลแสดง "ยังไม่ได้ตรวจ"
- [x] 4.4 `ContentCardDialog.tsx`: ปุ่ม footer "ตรวจ SEO/AEO ใหม่"
  - disable เมื่อ `isDirty` หรือยังไม่มี id พร้อมข้อความ "บันทึกบทความก่อนตรวจ SEO/AEO"
  - toast สรุปผ่าน/ไม่ผ่าน + จำนวนข้อบังคับที่ติด
  - ส่งผลลง ArticleEditor
- [x] 4.5 `ContentApprovalTab.tsx` แสดงผลด้วยคอมโพเนนต์กลาง ให้เห็นแยก Required/Recommended
- [x] 4.6 ค้นหาข้อความ UI ที่อ้างเกณฑ์ 80/70 หรือ "ตรวจ Quality" / "ตรวจ SEO" แล้วแก้ให้ตรงกฎใหม่

## 5. ทดสอบ

- [x] 5.1 PHP (pure)
  - tier catalog
  - เพดานแข็ง/ช่วงแนะนำทั้ง 4 ข้อ
  - `*_gate_status` (คะแนนต่ำแต่ไม่มี required failed = passed; recommended failed ไม่บล็อก)
  - `quality_required_status` (AEO required failed บล็อก)
- [x] 5.2 PHP (DB local) `quality_required_gate`
  - video ข้าม
  - `seo_gate_enabled=0`
  - ไม่มี marker บล็อก
  - มี marker แต่ประเมินใหม่ไม่ผ่านบล็อก
  - `min_score` ไม่มีผล
  - ขออนุมัติและเผยแพร่ได้ผลเดียวกัน
- [x] 5.3 ปรับเทสต์เดิมให้ตรงกฎใหม่: `seo-aeo-gate-test.php`, `publish-gate-test.php`, `seo-aeo-bugfix-A/B.test.php`
  - แยกให้ชัดว่าข้อไหนพังเพราะกฎเปลี่ยนตั้งใจ และข้อไหนพังอยู่ก่อนแล้ว
- [x] 5.4 Repair: ทดสอบด้วย `$aiCall` จำลอง
  - required failed → เรียก AI 1 ครั้งแล้วหยุด
  - มีแค่ recommended → ไม่เรียก
  - video → ไม่เรียก
- [x] 5.5 Vitest
  - ปุ่ม "ตรวจ SEO/AEO ใหม่" disable เมื่อ dirty และเปิดหลังบันทึก
  - ArticleEditor ไม่มีปุ่มตรวจ
  - รายการผลตรวจแยกกลุ่ม
  - `optional` แสดงเป็นข้อแนะนำ
- [x] 5.6 รัน `pnpm test` (ไฟล์ที่เกี่ยวข้อง), `pnpm lint` เฉพาะไฟล์ที่แก้ และ `pnpm build`
- [x] 5.7 ทดสอบจริงผ่าน UI
  1. generate บทความใหม่ 1 ชิ้นแล้วดูจำนวนครั้งที่เรียก AI ใน log
  2. บทความ `revision` เดิม → แก้ title ให้สั้นลง → บันทึก → ตรวจใหม่ → ขออนุมัติได้
  3. ยืนยันปุ่มปิดเมื่อยังไม่บันทึก
  - ผล: (2)(3) ผ่านครบบนบทความ e46d0838; (1) generate 51c94d9d สำเร็จ ติด Required 1 ข้อ (primary_keyword_placement) → repair 1 รอบ → revision ไม่ตั้ง marker ตามออกแบบ — ระบบไม่มี log จำนวนครั้งที่เรียก AI จึงยืนยันจำนวนรอบด้วยเทสต์ QC04 แทน
