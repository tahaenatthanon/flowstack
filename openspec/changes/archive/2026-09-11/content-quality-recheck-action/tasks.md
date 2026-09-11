## 1. Backend — endpoint quality-recheck

- [x] 1.1 เพิ่ม action `quality-recheck` (`POST`) ใน `api/brand-content.php` ต่อจากบล็อก `aeo-checklist` — โหลด `content_items` ด้วย `WHERE id=? AND tenant_id=?` เหมือน `seo-checklist`/`aeo-checklist`
- [x] 1.2 แนบ research brief แบบเดียวกับที่ `seo-checklist`/`aeo-checklist` ทำ (query `content_research_jobs` ล่าสุดที่ `status='done'`) ก่อนเรียก `seo_evaluate()`/`aeo_evaluate()`
- [x] 1.3 หลังประเมินเสร็จ decode `article_content` JSON ปัจจุบัน เซ็ต `quality_checked_at = dbNow($db)` แล้ว `UPDATE content_items SET article_content=?, updated_at=NOW() WHERE id=? AND tenant_id=?` — ไม่แก้ key อื่นใน JSON
- [x] 1.4 คืน response รวมผล SEO และ AEO ในก้อนเดียว: `{ seo: {score, rules, gate, seo_gate_enabled, seo_gate_min_score}, aeo: {score, rules, gate}, quality_checked_at }`
- [x] 1.5 คืน HTTP error ที่เหมาะสมเมื่อ `item_id` ว่างหรือไม่พบ/ไม่ใช่ของ tenant (ตามแพทเทิร์นเดิมของ `seo-checklist`)

## 2. Frontend — hook และปุ่ม "ตรวจ Quality"

- [x] 2.1 เพิ่ม `useQualityRecheck()` mutation hook ใน `src/hooks/useContent.ts` (โครงเดียวกับ `useScheduleContent`/`useSendNow`) เรียก `POST /brand-content.php?action=quality-recheck` และ invalidate query ของ content item นั้นเมื่อสำเร็จ
- [x] 2.2 เพิ่มปุ่ม "ตรวจ Quality" ใน footer ของ `ContentCardDialog.tsx` ข้างปุ่ม "AI เขียนให้" — ตั้งชื่อให้ต่างจาก "ตรวจใหม่" เดิมใน ArticleEditor ชัดเจน (ดู Open Question ใน design.md)
- [x] 2.3 ปุ่มนี้ SHALL disabled เมื่อยังไม่มี `existingItem?.id` (คอนเทนต์ที่ยังไม่บันทึก)
- [x] 2.4 เมื่อเรียกสำเร็จ แสดง toast สรุปผล gate จริง (ผ่าน/ไม่ผ่าน + จำนวนข้อที่ติด) ไม่ใช่แค่ "ตรวจเสร็จแล้ว" เฉย ๆ — อ้างอิงข้อมูล `seo.gate`/`aeo.gate` ที่ endpoint คืนมา
- [x] 2.5 แสดงเวลา "ตรวจล่าสุด" จาก `quality_checked_at` ที่คืนมาให้ผู้ใช้เห็นว่าตรวจแล้วเมื่อไหร่ ไม่ต้องกดซ้ำถ้ายังไม่ได้แก้ไข

## 3. Frontend — แก้ SchedulePublishDialog ให้รู้จักสถานะ blocked

- [x] 3.1 ใน `src/components/content/SchedulePublishDialog.tsx` เพิ่ม `const blocked = rows.filter(r => r.status === 'blocked')` คู่กับ `ok`/`skipped`/`failed` ที่มีอยู่
- [x] 3.2 เพิ่มเงื่อนไข `if (ok.length === 0 && blocked.length > 0)` ก่อนเงื่อนไข `else if (ok.length === 0)` เดิม — แสดง toast ชื่อ "ถูกบล็อกก่อนเผยแพร่" พร้อม `description: blocked[0].reason`
- [x] 3.3 ปรับผลผสม (บรรทัด `parts` ที่รวม สำเร็จ/ข้าม/ล้มเหลว) ให้นับ `blocked` แยกเป็นอีกหมวดเมื่อมีปนกับสถานะอื่น ไม่รวมเข้ากับ `failed`
- [x] 3.4 ตรวจว่า type `SendNowChannelResult` ใน `useContent.ts` มี `status: 'blocked'` อยู่ในสหภาพชนิดของ `status` แล้ว (backend คืนอยู่แล้ว แต่ type ฝั่ง frontend อาจไม่ครอบคลุม) — เพิ่มถ้าขาด (พร้อมแก้บั๊กเดิม `failed[0].error` ที่ backend ไม่เคยส่งคีย์ `error` มา ใช้ `reason` แทน)

## 4. Verification

- [x] 4.1 ทดสอบ manual: เปิดคอนเทนต์ที่ `quality_checked_at` เป็น NULL กด "ตรวจ Quality" → ยืนยันแล้วว่า endpoint เขียน `quality_checked_at` ลง DB จริงโดยไม่เรียก AI/ไม่แก้เนื้อหา (ทดสอบกับ item `66cbfec6...` ผ่าน UI จริง — toast ขึ้น "SEO: ไม่ผ่าน · AEO: ผ่าน · มี 1 ข้อไม่ผ่าน" และ DB มี `quality_checked_at` ตรงเวลาที่กด)
- [x] 4.2 ทดสอบ manual: คอนเทนต์ที่ `quality_checked_at` เป็น NULL → กด "ส่งเลย" (ทดสอบกับ item `81d6bfef...` เลือก Twitter/X ผ่าน UI จริง) → toast ขึ้น "ถูกบล็อกก่อนเผยแพร่" พร้อมข้อความ "Quality gate: ..." จริงจาก backend ไม่ใช่ "ไม่มีช่องทางที่ถูกส่ง" อีกต่อไป และยืนยันว่าไม่มีแถวถูกสร้างใน `content_publish_queue` สำหรับความพยายามที่ถูกบล็อก (gate ทำงานก่อน dispatch จริง)
- [ ] 4.3 ทดสอบ manual: คอนเทนต์ที่เลือก wordpress และเปิด `seo_gate_enabled` โดยคะแนน SEO ยังไม่ผ่าน → กด "ตรวจ Quality" → "ส่งเลย" ยังต้องถูกบล็อกด้วยเหตุผล SEO gate เดิม (ไม่ใช่ปลดล็อกทุกกรณี) — ยังไม่ได้ทดสอบผ่าน UI จริง (ต้องตั้งค่า `seo_gate_enabled=1` ในสภาพแวดล้อมทดสอบก่อน) แต่ยืนยันจากโค้ดแล้วว่า `final_publish_gate_check()` เส้นทาง web platform ไม่ได้ถูกแก้ไขเลยในการเปลี่ยนแปลงนี้ — เกต SEO/AEO เดิมยังทำงานอิสระจาก marker `quality_checked_at`
- [x] 4.4 เพิ่ม/อัปเดต test ที่เกี่ยวข้องใน `src/__tests__/content/` ให้ครอบคลุม `SchedulePublishDialog` เมื่อผลลัพธ์มีสถานะ `blocked` (เดี่ยวและปนกับสถานะอื่น)
- [x] 4.5 รัน `pnpm lint` และ `pnpm test` ให้ผ่านก่อนปิดงาน (0 errors / 48 warning เดิมที่มีอยู่ก่อนแล้ว, 242/242 tests ผ่าน รวม `tsc --noEmit` สะอาด)

## 5. Follow-up (พบระหว่างใช้งานจริงหลังปิดงาน)

- [x] 5.1 เพิ่ม native `title` tooltip ที่ปุ่ม "บันทึก" ใน `ContentCardDialog.tsx` เตือนว่าการบันทึกจะล้าง `quality_checked_at` ทิ้ง (เพราะ `api/content-items.php` ล้าง marker ทุกครั้งที่ body มีฟิลด์เนื้อหา ไม่เช็คว่าค่าเปลี่ยนจริงหรือไม่ — ผู้ใช้กด "บันทึก" เฉยๆ หลัง "AI เขียนให้" ก็ล้างได้โดยไม่รู้ตัว) — โชว์เฉพาะเมื่อมี `quality_checked_at` อยู่จริง (ไม่รบกวนเมื่อไม่มีอะไรจะเสีย) ใช้ตัวแปรร่วม `qualityCheckedAtValue` เดียวกับ hint "ตรวจ Quality ล่าสุด" — ยืนยันค่า title ผ่าน DOM จริงในเบราว์เซอร์แล้ว, `pnpm test` ผ่าน 242/242 เท่าเดิม
