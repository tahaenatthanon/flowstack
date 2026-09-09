## 1. Payload: ส่ง direct mode แทน weekly-plan mode

- [x] 1.1 ใน `BatchGenerateDialog.handleConfirmStart()` เพิ่ม `generation_mode: 'direct'` เข้า body ของ `POST generate-plan`
- [x] 1.2 ลบ `days: daysNum` และ `week_start: startDate` ออกจาก body เดียวกัน
- [x] 1.3 ลบ state `days`/`setDays` และตัวแปร `daysNum` ที่ไม่ใช้แล้วทั้งหมด (รวมใน `handleReset()`)

## 2. ตั้ง scheduled_date ต่อหัวข้อ

- [x] 2.1 เพิ่มฟังก์ชัน helper คำนวณวันที่: หัวข้อลำดับที่ `topicIndex` (0-based) → `scheduled_date = startDate + topicIndex วัน` (format `YYYY-MM-DD`)
- [x] 2.2 หลัง `generate-plan` สำเร็จและได้ `item.id` (ก่อนเรียก `runResearch`) เรียก `PUT action=plan-item-date` ด้วย `{ item_id: item.id, scheduled_date }`
- [x] 2.3 wrap การเรียกนี้ด้วย try/catch แยกจาก research — ถ้า fail ไม่ throw ต่อ ไม่ทำให้ topic ถูกนับเป็น `failed`, เก็บ error ไว้ใน array แยกสำหรับสรุปตอนจบ (ไม่ใช่ `errors[]` เดิมที่ทำให้ topic ล้มเหลวทั้งก้อน)
- [x] 2.4 ถ้ามีหัวข้อที่ตั้งวันที่ไม่สำเร็จอย่างน้อย 1 หัวข้อ ให้ toast สรุปท้ายสุดระบุจำนวนหัวข้อที่ตั้งวันที่ไม่สำเร็จ (แยกจาก toast ผลสำเร็จ/ล้มเหลวของการสร้างเนื้อหา)

## 3. ตัด UI "จำนวนวัน" ออก

- [x] 3.1 ลบ Select "จำนวนวัน" ออกจากส่วน "กำหนดการสร้าง" ในฟอร์ม (คงเหลือแค่ "เริ่มวันที่")
- [x] 3.2 ปรับ label/help text ของ "เริ่มวันที่" ให้สื่อว่าเป็นวันเริ่มของหัวข้อแรก และหัวข้อถัดไปเลื่อนทีละ 1 วัน
- [x] 3.3 เอาแถว "จำนวนวัน: X วัน" ออกจาก summary panel ในหน้าฟอร์ม (ก่อนกด "เริ่มสร้างคอนเทนต์")
- [x] 3.4 เอาแถว "จำนวนวัน: X วัน" ออกจาก summary panel ใน confirm dialog (ก่อนกด "ยืนยันและเริ่มสร้าง")
- [x] 3.5 (ถ้าเวลาเอื้อ) แสดงวันที่จริงที่แต่ละหัวข้อจะได้รับในรายการหัวข้อของ confirm dialog เช่น "หัวข้อที่ 2 → 16 ก.ย. 2569"

## 4. Test

- [x] 4.1 อัปเดต mock ใน `BatchGenerateDialog.test.tsx` ให้ handle `action=plan-item-date` (PUT) และเก็บ body ไว้ตรวจเหมือน endpoint อื่น
- [x] 4.2 เพิ่ม assertion ในเคสที่มีอยู่แล้วว่า body ของ `generate-plan` มี `generation_mode: 'direct'` และไม่มี `days`/`week_start`
- [x] 4.3 เพิ่มเคสใหม่: กรอก 3 หัวข้อพร้อมเริ่มวันที่ที่กำหนด → ตรวจว่า `plan-item-date` ถูกเรียก 3 ครั้งด้วย `scheduled_date` เรียงห่างกันวันละ 1 วันตรงกับลำดับหัวข้อ
- [x] 4.4 เพิ่มเคสใหม่: mock ให้ `action=plan-item-date` ของหัวข้อหนึ่งโยน error → ตรวจว่าหัวข้อนั้นยังถูกสร้าง/research ต่อ (ไม่ถูกนับเป็น `failed`) และมี toast/สถานะแจ้งเตือนแยกตามข้อ 2.4
- [x] 4.5 ลบ/ปรับเคสเดิมที่ยังอ้างอิงพฤติกรรม "จำนวนวัน" แบบเก่า (ถ้ามี) — ไม่มีเคสเดิมที่อ้างอิง ไม่ต้องแก้

## 5. Verification

- [x] 5.1 `pnpm lint` ผ่านไม่มี error
- [x] 5.2 `pnpm test src/__tests__/content` ผ่านทั้งหมด (รวม QuickCreateDialog เดิมที่ต้องไม่กระทบ)
- [x] 5.3 `pnpm build` ผ่าน
- [x] 5.4 Manual: เปิด Batch generation กรอก 3 หัวข้อ (คนละ content type/tone/script style/platform) กด "เริ่มสร้างคอนเทนต์" — ยืนยันผ่าน Network tab + query DB ตรง: `generate-plan` แต่ละครั้งได้ `items` กลับมาแค่ 1 รายการ (รวม 3 ชิ้นจาก 3 หัวข้อ ไม่ใช่ 21), `plan-item-date` เรียกครบ 3 ครั้งด้วย `scheduled_date` เรียงวันละ 1 วัน (2026-09-09/10/11) ตรงตาม tone/script_style/duration/platform ที่ตั้งไว้ต่อหัวข้อ
