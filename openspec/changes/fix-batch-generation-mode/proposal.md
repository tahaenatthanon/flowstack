## Why

Batch สร้างคอนเทนต์ (`BatchGenerateDialog`) ไม่ได้ส่ง `generation_mode=direct` เหมือน Quick Create — ทำให้แต่ละหัวข้อที่ผู้ใช้พิมพ์ถูกตีความเป็น legacy weekly-plan request และขยายเป็นสูงสุด 7 content items โดยไม่ตั้งใจ (จันทร์–อาทิตย์ จาก 1 หัวข้อ) แทนที่จะเป็น 1 หัวข้อ = 1 ชิ้นตรงๆ เหมือนที่ Quick Create ทำได้อยู่แล้ว ผลคือผู้ใช้ได้ content เกินจำนวนที่คาดหวังหลายเท่า และเนื้อหาบางส่วนอาจเป็นมุมที่ AI คิดเองรายวัน ไม่ตรงกับหัวข้อที่พิมพ์ นอกจากนี้ช่อง "จำนวนวัน"/"เริ่มวันที่" ที่มีอยู่ในฟอร์มก็เป็นซากตกค้างจาก UI แบบเก่า (ก่อน refactor เป็น multi-topic) ที่ dialog ไม่เคยอ่านค่ากลับมาใช้จริง

## What Changes

- Batch ส่ง `generation_mode: 'direct'` ต่อหัวข้อใน `generate-plan` (เหมือน Quick Create) → รับประกัน 1 หัวข้อ = 1 content item เสมอ
- ตัด `days` และ `week_start` ออกจาก payload ของ Batch (ไม่มีผลใน direct mode)
- เพิ่มการเรียก `PUT action=plan-item-date` หลัง `generate-plan` สำเร็จ (ก่อนเริ่ม Research) เพื่อกำหนด `scheduled_date` ให้แต่ละหัวข้อ — หัวข้อที่ N ได้วันที่ = "เริ่มวันที่" + (N-1) วัน เรียงต่อเนื่องกันไปตามจำนวนหัวข้อที่กรอกจริง ไม่ต้องเลือกจำนวนวันเอง
- ถ้าการตั้งวันที่ล้มเหลว (เช่น network error) ถือเป็น non-fatal — หัวข้อนั้นยังถูกสร้างและ research ต่อได้ตามปกติ เพียงแต่ยังไม่มีวันที่ (ผู้ใช้ปรับเองทีหลังในปฏิทินได้)
- ตัด UI ช่อง "จำนวนวัน" (Select ตัวเลือก 3/5/7/10/14/30) ออกจากฟอร์ม Batch ทั้งหมด เหลือแค่ "เริ่มวันที่"
- ปรับ summary panel ทั้งในหน้าฟอร์มและ confirm dialog ให้ตรงกับ field ที่เหลือ (เอาแถว "จำนวนวัน" ออก)
- อัปเดต/เพิ่ม test ใน `BatchGenerateDialog.test.tsx` ให้ยืนยัน `generation_mode='direct'`, ไม่มี `days`/`week_start` ใน payload, และ `plan-item-date` ถูกเรียกด้วยวันที่เรียงลำดับถูกต้องตามหัวข้อ

**นอกขอบเขต (แยกทำทีหลัง):** การแจ้งเตือนผู้ใช้เมื่อหัวข้อใน Batch ไม่ผ่าน SEO/AEO/Script quality gate (ปัจจุบัน Quick Create มี toast แจ้งเตือนกรณีนี้ แต่ Batch ยังไม่มี) — metadata SEO/AEO เองถูกสร้างและบันทึกอัตโนมัติอยู่แล้วโดย backend endpoint เดียวกัน ไม่ต้องแก้อะไรเพิ่มสำหรับส่วนนี้ในงานนี้

## Capabilities

### New Capabilities
- `batch-content-scheduling`: กำหนด `scheduled_date` ให้แต่ละหัวข้อใน Batch generation เรียงลำดับวันละ 1 วันต่อเนื่องกันจากวันที่เริ่มต้นที่ผู้ใช้ตั้งไว้ครั้งเดียว โดยไม่ต้องเลือกจำนวนวันแยกต่างหาก

### Modified Capabilities
- `content-generation-single-item`: ขยาย requirement "Direct content creation SHALL be isolated from weekly/day context" (ปัจจุบันเขียนไว้เฉพาะ Quick Create) ให้ครอบคลุม Batch generation ด้วย — Batch generation ก็ต้องส่ง `generation_mode=direct` และได้ 1 item ต่อหัวข้อเช่นเดียวกัน

## Impact

- **Frontend**: [src/components/content/dialogs/BatchGenerateDialog.tsx](../../../src/components/content/dialogs/BatchGenerateDialog.tsx) — payload ที่ส่งไป `generate-plan`, state `days`/`daysNum` ที่ถูกตัดออก, UI ฟอร์มและ summary panel, เพิ่ม logic เรียก `plan-item-date`
- **Test**: [src/__tests__/content/BatchGenerateDialog.test.tsx](../../../src/__tests__/content/BatchGenerateDialog.test.tsx)
- **Backend**: ไม่ต้องแก้โค้ด — ใช้ `action=generate-plan` (รองรับ `generation_mode=direct` อยู่แล้ว) และ `action=plan-item-date` (endpoint เดิมที่ใช้กับ drag/drop บนปฏิทิน) ตามที่มีอยู่แล้วใน `api/brand-content.php`
- **ไม่กระทบ**: `QuickCreateDialog.tsx` และ flow การสร้างคอนเทนต์เดี่ยว (ใช้ pattern เดียวกันอยู่แล้ว ไม่ต้องแก้)
