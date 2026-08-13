## Why

ปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ปัจจุบันแสดงทั้งในหน้าผลงานคอนเทนต์ (`ContentListTab`) และหน้ารายการอนุมัติ (`ContentApprovalPage`) ทำให้บทบาทการอนุมัติหลุดจากหน้า "รายการอนุมัติ" ซึ่งเป็นที่เดียวที่ควรใช้ตัดสินใจ นอกจากนี้ลำดับ Status Card/Tab ยังเรียง "รออนุมัติ" ก่อน "อนุมัติแล้ว" และยังไม่มีวิธีเรียงรายการตาม "วันที่ขออนุมัติ" ทำให้ผู้อนุมัติมองลำดับคิวได้ยาก

## What Changes

- **BREAKING (UI scope)**: นำปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ออกจาก hover actions ในหน้าผลงานคอนเทนต์ (`ContentListTab.tsx`) — ปุ่มเหล่านี้จะแสดงเฉพาะในหน้า "รายการอนุมัติ" เท่านั้น
- สลับลำดับ Status Card และ Status Tab ในหน้ารายการอนุมัติ: "อนุมัติแล้ว" (`approved`) มาก่อน "รออนุมัติ" (`pending_approval`)
- เพิ่มตัวเลือก Sort ในหน้ารายการอนุมัติ สำหรับเรียงตาม "วันที่ขออนุมัติ": "ขออนุมัติล่าสุด → เก่าสุด" และ "ขออนุมัติเก่าสุด → ล่าสุด"
- เพิ่มคอลัมน์ `content_items.requested_at` (DATETIME NULL) บันทึกเวลาที่รายการถูกส่งขออนุมัติ (transition เป็น `pending_approval`)

## Capabilities

### New Capabilities
- `content-approval-request-sort`: บันทึก `requested_at` วันที่ขออนุมัติ และเพิ่มตัวเลือกเรียงรายการในหน้ารายการอนุมัติตามวันที่ขออนุมัติ (ใหม่สุด/เก่าสุด)

### Modified Capabilities
- `content-list-approval-actions`: เอาปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ออกจากหน้าผลงานคอนเทนต์ — เหลือเฉพาะหน้ารายการอนุมัติ
- `approval-stats-cards`: สลับลำดับ stat cards ให้ "อนุมัติแล้ว" มาก่อน "รออนุมัติ"
- `approval-tab-navigation`: สลับลำดับ tab ให้ "อนุมัติแล้ว" มาก่อน "รออนุมัติ"
- `content-approval-list`: เปลี่ยนการเรียง (sort) จากวันที่สร้าง (`created_at`) เป็นวันที่ขออนุมัติ (`requested_at`)

## Impact

- **Database**: `content_items` — เพิ่มคอลัมน์ `requested_at DATETIME NULL` (migration ใหม่ 1 ไฟล์ใน `database/migrations/`)
- **Backend**: `api/content-items.php` — เพิ่ม `ci.requested_at` ใน SELECT และ auto-set `requested_at = NOW()` เมื่อ PUT เปลี่ยน status เป็น `pending_approval`
- **Frontend**: `src/components/content/types.ts` (เพิ่ม field `requested_at`), `ContentListTab.tsx` (ลบปุ่มอนุมัติ), `ContentApprovalPage.tsx` (สลับลำดับ + sort ใหม่)
- **Tests**: `src/__tests__/content/ContentApprovalPage.test.tsx` — อัปเดต fixture/assertions ตามลำดับและ sort ใหม่
