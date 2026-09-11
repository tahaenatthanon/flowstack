## 1. Backend — helper และ guard

- [x] 1.1 เพิ่มฟังก์ชัน `assert_scheduled_date_editable(PDO $db, string $tenantId, string $contentId): void` ใน `api/lib/publish-dispatch.php` ที่เรียก `get_published_content_platforms()` แล้ว `jsonError('...', 409)` เมื่อผลลัพธ์ไม่ว่าง (ข้อความภาษาไทยระบุว่าเผยแพร่ไปแล้วบางแพลตฟอร์ม)
- [x] 1.2 เรียก `assert_scheduled_date_editable()` ใน `action=plan-item-date` (PUT) ใน `api/brand-content.php` ก่อนบรรทัดที่ทำ `UPDATE content_items SET scheduled_date=...`
- [x] 1.3 เรียก `assert_scheduled_date_editable()` ใน `action=plans` (PUT) ใน `api/brand-content.php` เฉพาะเมื่อ request body มี `scheduled_date` ส่งมาด้วย (ไม่กระทบการแก้ field อื่นของ item เดียวกัน)

## 2. Backend — hydrate สถานะล็อกในผลลัพธ์รายการ

- [x] 2.1 เพิ่ม subquery `has_published_platform` (ตาม design.md หัวข้อ Decision 2) ใน SELECT ที่ `action=plans&id=<id>` ใช้คืนรายการ `plan-items` (~บรรทัด 514)
- [x] 2.2 เพิ่ม subquery เดียวกันใน SELECT ที่คืนผลหลัง `action=generate-plan` (~บรรทัด 523/1043)
- [x] 2.3 ตรวจว่า field คืนเป็น boolean จริง (ไม่ใช่ `0`/`1` แบบ string) ในทุก response path ที่แก้ — เพิ่ม `normalize_plan_item_row()` cast เป็น bool ก่อน `jsonResponse` ทั้ง 3 จุด

## 3. Frontend — types และ data flow

- [x] 3.1 เพิ่ม `has_published_platform?: boolean` ใน `PlanItem` (`src/components/content/types.ts`)

## 4. Frontend — ปฏิทิน

- [x] 4.1 ใน `ContentPlannerCalendar.tsx` (`renderItemChip`) ตั้ง `draggable={!item.has_published_platform}`
- [x] 4.2 เพิ่มสัญลักษณ์/สไตล์แสดงว่า chip ถูกล็อก (เช่น ไอคอนล็อก, cursor `not-allowed`, opacity ลดลง) เมื่อ `has_published_platform` เป็น `true`
- [x] 4.3 ตรวจสอบว่า chip อื่นในวันเดียวกันที่ไม่ถูกล็อกยังคง `draggable` ตามปกติ (ไม่มี logic ระดับ day cell มาบล็อกร่วม) — ยืนยันแล้วโดยโค้ด: `locked` คำนวณต่อ item ใน `renderItemChip` เท่านั้น ไม่มี state ระดับ day cell

## 5. Frontend — ฟอร์มแก้ไขการ์ด

- [x] 5.1 ใน `ContentCardDialog.tsx` disable `<Input type="date">` (บรรทัดที่ผูกกับ `scheduledDate`) เมื่อ `existingItem?.has_published_platform` เป็น `true`
- [x] 5.2 แสดงข้อความอธิบายใต้ช่องวันที่เมื่อถูก disable ด้วยเหตุผลนี้ (ใช้โทนข้อความเดียวกับ `SchedulePublishDialog.tsx`)
- [x] 5.3 ตรวจสอบว่า `handleSave`/`handleSaveCard` ไม่ส่ง `scheduled_date` ที่เปลี่ยนไปเมื่อช่องถูก disable — พบว่า dialog ส่ง `scheduled_date` ทุกครั้งที่ save (ไม่ใช่เฉพาะตอนแก้วันที่จริง) จึงปรับ backend guard ใน `action=plans` (task 1.3) ให้เช็ค**ค่าที่เปลี่ยนจริง**เทียบกับ `content_items.scheduled_date` ปัจจุบัน แทนการเช็คแค่ key มีอยู่ในbody — กัน false-positive ที่จะบล็อกการแก้ caption/topic ของ item ที่ล็อกไปด้วย

## 6. Frontend — มุมมองรายการ

- [x] 6.1 ใน `ContentItemList.tsx` ตั้ง `draggable={!item.has_published_platform}` ที่แถวรายการ

## 7. Error handling

- [x] 7.1 ใน `ContentPlannerPage.tsx` (`handleDateDrop`) จับ error 409 จาก `updateItemDateMut` แล้วแสดง toast ข้อความจาก backend แทนข้อความ "ย้ายรายการแล้ว" (defense-in-depth เผื่อ state ฝั่ง client ไม่ทันอัปเดต) — ย้าย toast สำเร็จไปที่ `onSuccess` แทนการยิงทันทีแบบ optimistic (แก้บั๊กเดิมที่ toast ขึ้นว่าสำเร็จแม้ mutation จะพังไปด้วย)

## 8. Verification

- [x] 8.1 `pnpm lint` — 0 errors, 47 warning ที่มีอยู่ก่อนแล้วทั้งหมด ไม่มีของใหม่จากไฟล์ที่แก้ในรอบนี้
- [x] 8.2 `pnpm test` — เพิ่ม 4 test ใหม่ใน `ContentPlannerCalendar.test.tsx` (draggable=false เมื่อล็อก, draggable=true เมื่อไม่ล็อก/ไม่มี field, และ item ข้างเคียงในวันเดียวกันไม่ได้รับผลกระทบ) ผลรวม 205/205 ผ่านทั้งหมด (30 ไฟล์)
- [x] 8.3 `pnpm build` — สำเร็จ ไม่มี error (คำเตือน chunk size เป็นของเดิม ไม่เกี่ยวกับ change นี้)
- [x] 8.4 ทดสอบ manual ด้วยข้อมูลจริงที่มีอยู่แล้ว ผ่าน curl ตรงกับ endpoint จริงบน `http://localhost/flowstack` (mint JWT ท้องถิ่นด้วย `generateToken()` ของแอปเองสำหรับ QA — ไม่กระทบ production) — ทุกกรณีตรงตามคาด:
  - `GET action=plans&id=510f5b62-...` → item `5e1ea0ed-...` (Facebook `sent` แล้ว, `content_items.status` ยัง `approved`) มี `has_published_platform: true` ใน response จริง
  - `PUT action=plan-item-date` เปลี่ยนวันของ item ที่ล็อก → **HTTP 409** `"ไม่สามารถเปลี่ยนวันที่ได้ เนื่องจากเผยแพร่ไปแล้วบางแพลตฟอร์ม (facebook)"`, `scheduled_date` ในฐานข้อมูลไม่เปลี่ยน
  - `PUT action=plans` เปลี่ยนวันของ item เดียวกัน → **HTTP 409** เช่นกัน
  - `PUT action=plans` ส่ง `scheduled_date` เดิม (ไม่เปลี่ยน) พร้อมแก้ `caption` → **HTTP 200 สำเร็จ** (ยืนยัน fix ของ 5.3 ทำงานถูกต้อง — ไม่บล็อกการแก้ field อื่น) แล้ว restore caption กลับค่าเดิมหลังทดสอบ
  - item อื่นที่ยังไม่เผยแพร่แพลตฟอร์มใดเลย (`083f1716-...`) → `PUT action=plan-item-date` เปลี่ยนวันสำเร็จ **HTTP 200** ตามปกติ แล้ว revert วันกลับค่าเดิมหลังทดสอบ
