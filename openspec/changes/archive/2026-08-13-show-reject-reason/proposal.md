## Why

เมื่อผู้อนุมัติกด "ขอแก้ไข" หรือ "ปฏิเสธ" พร้อมกรอกเหตุผล เหตุผลนั้นถูกบันทึกลงคอลัมน์ `content_items.reject_reason` แล้ว แต่**ไม่ถูกส่งกลับมาจาก API และไม่มีจุดแสดงผลใน UI** ทำให้ผู้สร้างเนื้อหาไม่รู้ว่าต้องแก้ไขอะไร และเหตุผลที่กรอกในหน้ารายการอนุมัติก็ไม่ถูกบันทึกด้วยซ้ำ (ส่งเฉพาะ `status`)

## What Changes

- **Backend**: `GET /content-items.php` เพิ่ม `ci.reject_reason` ใน SELECT เพื่อให้ client ได้รับเหตุผลกลับมา
- **หน้ารายการอนุมัติ (`ContentApprovalTab`)**: เพิ่มปุ่ม "ขอแก้ไข" (เปลี่ยนสถานะเป็น `revision` พร้อมเหตุผล) ในคอลัมน์ "จัดการ" ให้ครบ 3 ปุ่ม (อนุมัติ / ขอแก้ไข / ปฏิเสธ)
- **หน้ารายการอนุมัติ (`ContentApprovalTab`)**: แก้ `handleReject` ให้ส่ง `reject_reason` ที่กรอกไว้ไปบันทึกด้วย (ปัจจุบันทิ้งเหตุผลที่กรอก)
- **หน้ารายละเอียดเนื้อหา (`ContentDetailView`)**: แสดงเหตุผล `reject_reason` เมื่อสถานะเป็น `revision` หรือ `rejected` เพื่อให้ผู้สร้างเนื้อหาเห็นเหตุผลที่ขอแก้ไข/ปฏิเสธ
- **สีสถานะ (`STATUS_MAP`)**: ปรับสี `approved` (blue → green/success) และ `revision` (orange → blue/info) ให้ตรงกับ semantic tokens ของ Icon ใน Status Card ของหน้ารายการอนุมัติ เพื่อให้สีของแต่ละสถานะสอดคล้องกันทั้งระบบ
- **ความกว้างคอลัมน์ "จัดการ"**: ล็อกความกว้างคอลัมน์ "จัดการ" ในตารางรายการอนุมัติให้คงที่ เพื่อให้ความกว้างของคอลัมน์อื่น (เช่น "ชื่อคอนเทนต์") ไม่ขยับเมื่อมี/ไม่มีปุ่ม action

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ — เป็นการขยาย requirement ของ capability ที่มีอยู่ -->

### Modified Capabilities

- `content-approval-list`: เพิ่ม requirement "ขอแก้ไข" (revision) จากหน้ารายการอนุมัติ พร้อมบันทึกเหตุผล
- `approval-detail-full-content`: เพิ่ม requirement ให้แสดงเหตุผล `reject_reason` ในหน้ารายละเอียดเนื้อหาเมื่อสถานะเป็น `revision` หรือ `rejected`
- `content-list-status-badge`: เปลี่ยน mapping สีของ status badge ให้สอดคล้องกับ semantic color tokens ของ Stat Card (revision=blue/info, approved=green/success)
- `content-approval-list`: กำหนดความกว้างคงที่ให้คอลัมน์ "จัดการ" เพื่อไม่ให้ layout ตารางขยับตามปุ่ม action

## Impact

- `api/content-items.php` — เพิ่ม `ci.reject_reason` ใน SELECT ของ GET
- `src/components/content/tabs/ContentApprovalTab.tsx` — เพิ่มปุ่ม "ขอแก้ไข" + dialog เหตุผล + ส่ง `reject_reason` ตอนปฏิเสธ/ขอแก้ไข
- `src/components/content/views/ContentDetailView.tsx` — แสดงเหตุผล `reject_reason`
- `src/components/content/types.ts` — ปรับสี `approved` และ `revision` ใน `STATUS_MAP`
- `src/components/content/tabs/ContentApprovalTab.tsx` — ล็อกความกว้างคอลัมน์ "จัดการ" (w-[240px] + whitespace-nowrap)
