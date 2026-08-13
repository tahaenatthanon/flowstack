## Why

หน้ารายการอนุมัติ (`ContentApprovalPage`) ปัจจุบันใช้ Tab Menu 5 แท็บ (ทั้งหมด / อนุมัติแล้ว / รออนุมัติ / ขอแก้ไข / ปฏิเสธ) ในการกรองสถานะ ซึ่งกินพื้นที่และไม่สอดคล้องกับตัวกรองอื่น (ประเภท/แพลตฟอร์ม) ที่ใช้ Dropdown อยู่แล้ว นอกจากนี้ label ของตัวเลือก sort "ขออนุมัติล่าสุด → เก่าสุด" ยาวเกินความจำเป็น

## What Changes

- **BREAKING (UI)**: ลบ Tab Menu ทั้ง 5 แท็บ (`TABS`, `<Tabs>` component) ออกจากหน้ารายการอนุมัติ
- เพิ่ม Filter Status (Dropdown) สำหรับกรองรายการตามสถานะ — ตัวเลือก: ทั้งหมด, อนุมัติแล้ว, รออนุมัติ, ขอแก้ไข, ปฏิเสธ
- เปลี่ยนชื่อตัวเลือก sort จาก "ขออนุมัติล่าสุด → เก่าสุด" เป็น "ล่าสุด-เก่าสุด" และ "ขออนุมัติเก่าสุด → ล่าสุด" เป็น "เก่าสุด-ล่าสุด"

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `content-approval-list`: แทนที่การกรองสถานะด้วย Tab Navigation เป็น Filter Status Dropdown; เปลี่ยน label ของตัวเลือก sort
- `content-approval-request-sort`: เปลี่ยน label ตัวเลือก sort เป็น "ล่าสุด-เก่าสุด" / "เก่าสุด-ล่าสุด"
- `approval-tab-navigation`: ลบออก (Tab Menu ถูกลบทั้งหมด)

## Impact

- **Frontend**: `src/pages/ContentApprovalPage.tsx` — ลบ `TABS`/`EMPTY_STATE`/`activeTab`/`tabCounts`, เพิ่ม `statusFilter` dropdown, ปรับ sort labels; ลบ import `Tabs` ที่ไม่ใช้
- **Tests**: `src/__tests__/content/ContentApprovalPage.test.tsx` — อัปเดต assertions (ไม่มี tab แล้ว, ใช้ filter dropdown)
- **Backend**: ไม่มีการแก้ไข
- **Database**: ไม่มีการแก้ไข
