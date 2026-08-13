## Why

เมื่อผู้อนุมัติกด "ขอแก้ไข" หรือ "ปฏิเสธ" พร้อมกรอกเหตุผล เหตุผลจะถูกบันทึกลง `content_items.reject_reason` แต่ปัจจุบันเหตุผลแสดงเฉพาะในหน้ารายละเอียด (`ContentDetailView` — เปิดจาก Tab "รายการอนุมัติ") ยังไม่แสดงใน Tab "ผลงานทั้งหมด" ซึ่งเปิด `ContentCardDialog` ผ่าน `ContentListTab` ทำให้ผู้สร้างเนื้อหาไม่เห็นเหตุผลที่ต้องแก้ไข

## What Changes

- **`PlanItem` type**: เพิ่ม field `reject_reason?: string | null` เพื่อให้ `ContentCardDialog` รับเหตุผลได้
- **`ContentListTab`**: ใน `asPlanItem` map ค่า `reject_reason` จาก `ContentItem` ไปยัง `PlanItem`
- **`ContentCardDialog`**: แสดงแบนเนอร์ amber แสดงเหตุผล `reject_reason` เมื่อ `contentStatus` เป็น `revision` หรือ `rejected`
- **`ContentListTab` (แถวรายการ)**: แสดงเหตุผล `reject_reason` ใต้ชื่อรายการโดยตรงใน Tab "ผลงานทั้งหมด" เมื่อสถานะเป็น `revision` หรือ `rejected` (ไม่ต้องคลิกเปิดกล่อง)

## Capabilities

### New Capabilities

- `content-list-reject-reason`: แสดงเหตุผลที่ขอแก้ไข/ปฏิเสธ (`reject_reason`) ในกล่องแก้ไขเนื้อหา (`ContentCardDialog`) และในแถวรายการของ Tab "ผลงานทั้งหมด"

### Modified Capabilities

<!-- ไม่มี capability ที่ requirement เดิมเปลี่ยน — เป็น capability ใหม่ -->

## Impact

- `src/components/content/types.ts` — เพิ่ม field `reject_reason` ใน `PlanItem`
- `src/components/content/tabs/ContentListTab.tsx` — map `reject_reason` ใน `asPlanItem` + แสดงเหตุผลในแถวรายการ
- `src/components/content/ContentCardDialog.tsx` — แสดงแบนเนอร์เหตุผล

## Prerequisite

- **Database migration**: คอลัมน์ `content_items.reject_reason` ต้องมีอยู่จริงในฐานข้อมูลที่แอปใช้งาน (`.env` → `DB_NAME=flowstack_dev`). หากรัน migration ไปที่ฐานข้อมูลชื่ออื่น (เช่น `flowstack`) เหตุผลจะไม่ถูกบันทึกและไม่แสดง — ต้องรัน `database/migrations/2026_08_11_114953_add_reject_reason.sql` กับ `flowstack_dev` ก่อน
