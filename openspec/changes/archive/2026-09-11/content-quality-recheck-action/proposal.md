## Why

ผู้ใช้กด "ส่งเลย" ไป Facebook แล้วขึ้น toast "ไม่มีช่องทางที่ถูกส่ง" ซึ่งไม่บอกเหตุผลจริงเลย จากการตรวจสอบพบว่า `publish_via_central_flow()` คืนสถานะ `blocked` เมื่อ `content_items.article_content.quality_checked_at` เป็น NULL (คอนเทนต์ถูกแก้ไขหลัง approve โดยไม่ได้ตรวจ Quality ใหม่) แต่ `SchedulePublishDialog.tsx` รู้จักเฉพาะสถานะ `success`/`skipped`/`failed` — `blocked` จึงหล่นไปแสดง toast ทั่วไปที่บังเหตุผลจริงไว้ ทางแก้เดียวที่มีอยู่ตอนนี้คือกด "AI เขียนให้" ซึ่งเขียนบทความใหม่ทั้งชุด (มี LLM call หลายรอบ รวม repair loop ของ SEO/AEO) ทั้งที่สิ่งที่ต้องทำจริง ๆ คือแค่ยืนยันว่าตรวจ Quality บนเนื้อหาปัจจุบันแล้ว

## What Changes

- แก้ `SchedulePublishDialog.tsx` ให้จำแนกผลลัพธ์ `send_now` เป็น 4 กรณีแทน 3 กรณี — เพิ่ม `blocked` แยกจาก `failed`/`skipped` และแสดงเหตุผลจริงจาก `result.reason` แทน toast ทั่วไป "ไม่มีช่องทางที่ถูกส่ง"
- เพิ่ม endpoint ใหม่ `POST /api/content-publish.php?action=quality-recheck` (หรือเทียบเท่าใน `brand-content.php`) ที่ประเมิน SEO/AEO ด้วย `seo_evaluate()`/`aeo_evaluate()` เดิม แล้วเซ็ต `article_content.quality_checked_at = NOW()` และบันทึกกลับ โดย**ไม่เรียก AI ใหม่และไม่แก้เนื้อหาบทความ**
- เพิ่มปุ่ม "ตรวจ Quality" แยกจากปุ่ม "AI เขียนให้" ใน `ContentCardDialog.tsx` (หรือจุดที่เหมาะสมใกล้แผง SEO/AEO ใน `ArticleEditor.tsx`) ที่เรียก endpoint ใหม่นี้ แล้วรีเฟรชสถานะ Quality ให้ผู้ใช้เห็นทันทีว่าปลดล็อกแล้ว
- ปุ่มนี้ยังคงเคารพเงื่อนไขเดิมทั้งหมด — เนื้อหาต้องมีอยู่แล้ว (`content_items.id` ไม่ว่าง) และผลตรวจยังคงใช้ ruleset เดียวกับ `generate-article`/`?action=seo-checklist` ทุกประการ ไม่สร้างเกณฑ์คู่ขนาน

## Capabilities

### New Capabilities
- `content-quality-recheck`: การประเมิน SEO/AEO ซ้ำบนเนื้อหาที่บันทึกล่าสุดโดยไม่ generate ใหม่ พร้อมเซ็ต marker `quality_checked_at` ที่ publish gate ใช้ตรวจ และปุ่ม UI ที่เรียกใช้งานได้

### Modified Capabilities
- `publish-send-now-idempotency`: requirement "send_now รายงานผลรายช่องทางตามจริง" ต้องรองรับสถานะที่ 4 คือ `blocked` (ถูกเกตปฏิเสธก่อน dispatch เช่น approval/quality/SEO gate) แยกจาก `failed` (ยิงปลายทางแล้วล้มเหลว) และ UI ต้องแสดงเหตุผลจริงของ `blocked` แทนข้อความทั่วไป

## Impact

- `src/components/content/SchedulePublishDialog.tsx` — เพิ่มการจำแนกสถานะ `blocked` และ toast ที่แสดงเหตุผลจริง
- `api/content-publish.php` — เพิ่ม action `quality-recheck` ใหม่ (ไม่แก้ action เดิม)
- `src/components/content/ContentCardDialog.tsx` และ/หรือ `src/components/content/ArticleEditor.tsx` — เพิ่มปุ่ม "ตรวจ Quality" และ hook เรียก endpoint ใหม่
- ไม่แตะ `api/lib/publish-dispatch.php`, `api/lib/seo-checklist.php`, `api/lib/aeo-checklist.php` — ใช้ฟังก์ชันประเมินเดิมทั้งหมด ไม่เปลี่ยนเกณฑ์การให้คะแนนหรือ gate logic ที่มีอยู่
- ไม่มีการเปลี่ยน schema ฐานข้อมูล — `quality_checked_at` เป็น key ใน JSON ของคอลัมน์ `article_content` ที่มีอยู่แล้ว
