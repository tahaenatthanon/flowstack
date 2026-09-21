## 1. Bug A — แถวตัวกรองแยกบรรทัดจาก label

- [x] 1.1 แก้ container นอกของแถวตัวกรอง "ประเภท" จาก `flex flex-wrap gap-1.5 items-center` เป็น `flex gap-1.5 items-center` ใน `PullFromContentDialog.tsx`
- [x] 1.2 แก้ container นอกของแถวตัวกรอง "สถานะ" ด้วยการเปลี่ยนเดียวกัน
- [x] 1.3 แก้ container นอกของแถวตัวกรอง "แพลตฟอร์ม" ด้วยการเปลี่ยนเดียวกัน

## 2. Bug B — platform badge ล้นกรอบการ์ด

- [x] 2.1 ย้าย `<PlatformBadgeList ... className="shrink-0" />` ออกจาก `<div className="flex items-center gap-2">` (แถวหัวข้อ: type icon + title + eye icon) ในการ์ดรายการคอนเทนต์
- [x] 2.2 เพิ่ม `<div>` แยกต่างหากใต้แถวหัวข้อ ครอบด้วยเงื่อนไข `platforms.length > 0` (ตาม pattern `ContentCardDialog.tsx`) แสดง `PlatformBadgeList` ในแถวใหม่นี้แทน

## 3. ตรวจสอบด้วยเบราว์เซอร์

- [x] 3.1 เปิดหน้าต่าง "ดึงคอนเทนต์" ปรับขนาดหน้าต่างให้แคบ ตรวจว่า label ของทั้ง 3 แถวตัวกรองอยู่บรรทัดเดียวกับ pill แถวแรกเสมอ
- [x] 3.2 ตรวจว่ารายการที่มีแพลตฟอร์มจำนวนมาก (8+ ตัว) แสดง badge ในแถวแยก ไม่ล้นกรอบการ์ด และแถวหัวข้อยังอยู่บรรทัดเดียว
- [x] 3.3 ตรวจว่ารายการที่ไม่มีแพลตฟอร์มเลยไม่แสดงแถว badge ว่างเปล่า
- [x] 3.4 ตรวจว่าฟังก์ชันกรอง (ประเภท/สถานะ/แพลตฟอร์ม) และการเลือกคอนเทนต์ยังทำงานปกติ ไม่มี regression จาก change ก่อนหน้า

## 4. Build & Lint

- [x] 4.1 รัน `pnpm lint`
- [x] 4.2 รัน `pnpm build`

## 5. Bug C — เอาชื่อแพลตฟอร์มออก ใช้ไอคอนอย่างเดียว (ตาม pattern หน้า "ผลงานคอนเทนต์")

- [x] 5.1 แถวตัวกรองแพลตฟอร์ม: เอา label ข้อความ (`val.label`) ออกจาก pill เหลือแค่ไอคอน เพิ่ม `title` เพื่อเป็น tooltip แทน (อ้างอิง pattern จาก `ContentListTab.tsx`)
- [x] 5.2 badge แพลตฟอร์มของการ์ดคอนเทนต์ในรายการ: เปลี่ยนจาก `PlatformBadgeList` (icon+label) เป็น badge ไอคอนอย่างเดียวแบบ inline (เหมือน `ContentListTab.tsx`) พร้อม `title` tooltip
- [x] 5.3 ตรวจด้วยเบราว์เซอร์ว่าทั้งแถวตัวกรองและ badge ในการ์ดแสดงไอคอนอย่างเดียว มี tooltip ชื่อแพลตฟอร์มตอน hover (ยืนยันผ่าน DOM: title="Facebook/Instagram/TikTok/..." ครบ) และฟังก์ชันกรองแพลตฟอร์ม (ทดสอบกรอง TikTok เหลือ 1 รายการถูกต้อง) ยังทำงานปกติ
- [x] 5.4 รัน `pnpm lint` และ `pnpm build` ซ้ำ (ผ่านทั้งคู่ ไม่มี error ใหม่)
