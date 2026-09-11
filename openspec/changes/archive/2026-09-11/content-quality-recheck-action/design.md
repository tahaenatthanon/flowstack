## Context

`final_publish_gate_check()` และ `content_quality_gate_check()` (`api/lib/publish-dispatch.php`) เช็ค `content_items.article_content.quality_checked_at` เป็นเงื่อนไขแรกสุดก่อนอนุญาตให้ approve/publish ไม่ว่าจะเลือกแพลตฟอร์มไหนก็ตาม มาร์กเกอร์นี้ถูกล้างทุกครั้งที่แก้ไขเนื้อหาหลัง approve (`api/content-items.php:164-166`, `api/brand-content.php:599-608,3738`) และปัจจุบันมีจุดเดียวที่เขียนมันกลับคืน คือ `generate-article` (`api/brand-content.php:2902-2903`) ซึ่งเป็นการ generate เนื้อหาใหม่ทั้งชุด (1 LLM call หลัก + repair loop ของ SEO/AEO อีกหลายรอบ) ทำให้ผู้ใช้ที่แค่ต้องการยืนยันว่า "ตรวจ Quality บนเนื้อหาปัจจุบันแล้ว" ต้องรอ pipeline ที่หนักเกินความจำเป็น

อีกจุดหนึ่งที่เกี่ยวเนื่องกัน: `publish_via_central_flow()` คืนสถานะได้ 4 แบบ (`success`/`skipped`/`failed`/`blocked`) แต่ `SchedulePublishDialog.tsx` และสเปก `publish-send-now-idempotency` ปัจจุบันรู้จักแค่ 3 แบบ ทำให้กรณี `blocked` (เช่น marker นี้เป็น NULL) หล่นไปแสดง toast ทั่วไปที่ไม่มีประโยชน์

## Goals / Non-Goals

**Goals:**
- ให้มีทางเขียน `quality_checked_at` กลับคืนได้โดยไม่ต้อง generate เนื้อหาใหม่
- ใช้ฟังก์ชันให้คะแนน SEO/AEO ชุดเดิม (`seo_evaluate()`, `aeo_evaluate()`) โดยไม่เปลี่ยนเกณฑ์/น้ำหนัก/gate logic ที่มีอยู่
- ทำให้ผู้ใช้เห็นเหตุผลจริงเมื่อ `send_now` ถูก gate บล็อก แทนข้อความทั่วไป

**Non-Goals:**
- ไม่ทำให้ "AI เขียนให้"/`generate-article` เร็วขึ้น (เป็นงานแยกต่างหาก)
- ไม่เปลี่ยนเกณฑ์คะแนน/น้ำหนัก/ค่า threshold ของ SEO หรือ AEO
- ไม่เปลี่ยนพฤติกรรม approval gate (`approved_at`) หรือ SEO gate ที่เปิดใช้งานสำหรับ web platform — เนื้อหาที่ยังไม่ผ่านเกณฑ์คะแนนจริงยังคงถูกบล็อกเหมือนเดิมสำหรับ wordpress/wix/custom
- ไม่เพิ่ม endpoint ใหม่ใน `api/lib/publish-dispatch.php` หรือแก้ไฟล์นั้น

## Decisions

### 1. Endpoint ใหม่อยู่ใน `api/brand-content.php` ไม่ใช่ `api/content-publish.php`
`quality_checked_at` มีผู้เขียนรายเดียวในปัจจุบันคือ `generate-article` ซึ่งอยู่ใน `brand-content.php` — ไฟล์เดียวกับ `seo-checklist`/`aeo-checklist` ที่อ่าน `content_items` มาคำนวณคะแนนอยู่แล้ว การเพิ่ม action `quality-recheck` (`POST`) ในไฟล์เดียวกันทำให้ผู้เขียน marker นี้อยู่ที่เดียว ลดความเสี่ยงที่ไฟล์สองไฟล์จะแก้ JSON key เดียวกันคนละจังหวะ
ทางเลือกที่พิจารณาแล้วไม่ใช้: วางไว้ใน `content-publish.php` — ไฟล์นั้นเป็นเจ้าของฝั่ง "บริโภค" gate (send_now/schedule) ไม่ใช่ฝั่ง "เขียน" เนื้อหา การผสมสองความรับผิดชอบเข้าไฟล์เดียวจะทำให้ผู้เขียน marker กระจายอยู่ 2 ที่

### 2. เซ็ต `quality_checked_at` โดยไม่ขึ้นกับผลผ่าน/ไม่ผ่าน
พฤติกรรมเดิมของ `generate-article` เซ็ต marker เมื่อ "การ generate สำเร็จ" ไม่ใช่เมื่อ "SEO/AEO ผ่านเกณฑ์" (`if ($generationStatus === 'success')`) — endpoint ใหม่จึงเซ็ต marker ทุกครั้งที่ประเมินเสร็จ ไม่ว่าคะแนนจะผ่านหรือไม่ เพื่อคงความหมายเดิม: marker บอกว่า "ประเมินแล้วบนเวอร์ชันนี้" ไม่ใช่ "ผ่านแล้ว" — เกณฑ์ผ่าน/ไม่ผ่านสำหรับ web platform ยังคงถูกตัดสินแยกโดย `seo_gate_check()`/`aeo_evaluate()` ที่ `final_publish_gate_check()` เรียกอยู่แล้ว ไม่เกี่ยวกับ marker นี้

### 3. Response shape เดียวกับ `seo-checklist`/`aeo-checklist`
คืนทั้งผล SEO และ AEO ในคำตอบเดียว (`{ seo: {score, rules, gate, ...}, aeo: {score, rules, gate}, quality_checked_at }`) เพื่อให้ frontend รีเฟรชทั้งสองแผงพร้อมกันด้วย request เดียว แทนที่จะยิง 3 requests (recheck + seo-checklist + aeo-checklist)

### 4. ปุ่ม "ตรวจ Quality" อยู่ใน `ContentCardDialog.tsx` footer ข้าง "AI เขียนให้"
เพราะ gate ที่บล็อกอยู่ (`final_publish_gate_check`) ผูกกับ "ขออนุมัติ"/"ส่งเลย" ที่อยู่ใน dialog เดียวกันนี้ ผู้ใช้จะเห็นทางแก้ตรงจุดที่ติดปัญหาทันที ไม่ต้องสลับไปหน้า ArticleEditor ที่มีปุ่ม "ตรวจใหม่" อยู่แล้ว (ซึ่งเป็นคนละกลไก อ่านอย่างเดียว ไม่เขียน DB — ดูสเปก `content-seo-checklist`) — ป้ายกำกับปุ่มใหม่ต้องสื่อชัดว่าต่างจาก "ตรวจใหม่" เดิม เพื่อไม่ให้ผู้ใช้สับสนสองปุ่มที่ชื่อคล้ายกัน

### 5. แก้ `SchedulePublishDialog.tsx` แบบ additive เพิ่มเคสที่ 4
เพิ่มเงื่อนไข `blocked = rows.filter(r => r.status === 'blocked')` ก่อนเงื่อนไข else เดิม แสดง toast แยกที่ดึง `result.reason` ของช่องทางแรกที่ถูกบล็อกมาแสดงตรงๆ (รูปแบบเดียวกับที่ทำกับ `failed`/`skipped` อยู่แล้วที่บรรทัด 110-123) ไม่แก้ backend เพราะ `results[]` มี `reason` อยู่แล้วทุกวันนี้ — เป็นบั๊กฝั่งการอ่านผลลัพธ์เท่านั้น

## Risks / Trade-offs

- **[Risk]** ผู้ใช้กด "ตรวจ Quality" ซ้ำโดยไม่ได้แก้เนื้อหาจริง เข้าใจผิดว่าต้องกดทุกครั้งก่อนส่ง → **Mitigation**: แสดงเวลาที่ตรวจล่าสุด (`quality_checked_at`) ใน UI ให้เห็นว่ายังไม่ถูกล้าง ไม่ต้องกดซ้ำถ้าไม่ได้แก้ไข
- **[Risk]** กด "ตรวจ Quality" แล้วยังส่งไม่ได้ (สำหรับ wordpress/wix/custom ที่เปิด `seo_gate_enabled` และคะแนนยังไม่ผ่าน) ผู้ใช้อาจคิดว่าปุ่มใช้ไม่ได้ → **Mitigation**: toast ต้องรายงานผล gate จริง (ผ่าน/ไม่ผ่าน + จำนวนข้อที่ติด) ไม่ใช่แค่ "ตรวจเสร็จแล้ว" เฉยๆ
- **[Risk]** แก้ `SchedulePublishDialog.tsx` กระทบพฤติกรรมเดิมของสเปก `publish-send-now-idempotency` (นับเฉพาะ 3 กรณี) → **Mitigation**: เพิ่ม scenario ใหม่แบบ additive ในสเปก ไม่ลบ/แก้ scenario เดิมที่ผ่านอยู่แล้ว

## Migration Plan

- ไม่มี DB migration — `quality_checked_at` เป็น key ใน JSON column `article_content` ที่มีอยู่แล้ว
- ลำดับ deploy: (1) เพิ่ม action `quality-recheck` ใหม่ใน backend ก่อน — additive ล้วนๆ ไม่แก้ endpoint เดิม (2) เพิ่ม hook + ปุ่มฝั่ง frontend (3) แก้ `SchedulePublishDialog.tsx` ให้รู้จักสถานะ `blocked`
- Rollback: ปิดปุ่มใหม่ที่ frontend ได้ทันทีโดยไม่กระทบ backend หรือ endpoint เดิมเลย เพราะเป็น action ใหม่แยกต่างหาก

## Open Questions

- ป้ายข้อความปุ่มใหม่ควรใช้คำว่าอะไรให้ต่างจาก "ตรวจใหม่" เดิมชัดเจน (เช่น "ยืนยัน Quality" หรือ "ตรวจ Quality (ไม่เขียนใหม่)") — ต้องตัดสินใจตอน implement
