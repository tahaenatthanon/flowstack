## Why

หน้าแคมเปญอีเมลเพิ่งเปลี่ยนตัวเลือกกลุ่มผู้รับจาก dropdown single-select เป็น checkbox list (เพื่อเลือกได้หลายกลุ่ม) แต่ checkbox list สเกลไม่ดีเมื่อจำนวนกลุ่มมาก — ไม่มีช่องค้นหา ต้อง scroll หากลุ่มที่ต้องการเอง ระบบยังไม่มี multi-select component ที่ค้นหาได้เลยสักตัว (Combobox ที่มีอยู่แล้วทั้งหมด — `CompanyCombobox`, `ProjectCombobox`, `UserCombobox` ฯลฯ — เป็น single-select ทั้งหมด)

## What Changes

- สร้าง `MultiSelectCombobox` เป็น component ใหม่ใน `src/components/` (generic, ใช้ซ้ำที่อื่นในระบบได้ ไม่ผูกกับ email groups) — Popover + Command (ของเดิมที่มีอยู่แล้ว) พร้อมช่องค้นหา, เลือกได้หลายรายการโดย popover ไม่ปิดหลังเลือกแต่ละอัน (ต่างจาก Combobox เดิมทุกตัวที่ปิดทันทีหลังเลือก 1 รายการ — เป็นความจงใจ ไม่ใช่ inconsistency)
- แสดงรายการที่เลือกไว้เป็น chip (พร้อมปุ่ม ×) อยู่นอก dropdown เห็นตลอดเวลาไม่ต้องเปิด popover — เป็น pattern ใหม่ที่ระบบยังไม่เคยมี (ไม่มี removable badge/chip ที่ไหนในระบบมาก่อน)
- แทนที่ checkbox list ของกลุ่มผู้รับในหน้าแคมเปญ ([MarketingPage.tsx](src/pages/MarketingPage.tsx)) ด้วย `MultiSelectCombobox` — พฤติกรรมข้างใต้ (multi-group, dedupe-by-email, live recipient count) ไม่เปลี่ยน เปลี่ยนแค่ UI ตัวเลือก
- มีตัวเลือก "เลือกทั้งหมด" ในรายการ (เหมือน pattern ของ `CustomerList` ที่มีอยู่แล้วในไฟล์เดียวกัน) — ตั้งเป็น default เพราะเป็น pattern ที่ระบบใช้อยู่แล้วสำหรับ "เลือกได้หลายอัน" ทุกที่ ถือเป็นสมมติฐานที่ยังไม่ได้ยืนยันกับผู้ใช้ตรงๆ ระหว่าง explore

## Capabilities

### New Capabilities
- `multi-select-combobox`: พฤติกรรมทั่วไปของ component เลือกได้หลายรายการพร้อมค้นหา (search, chip แสดง/ลบรายการที่เลือก, popover ไม่ปิดหลังเลือก, เลือกทั้งหมด) ไม่ผูกกับ domain ใดโดยเฉพาะ

### Modified Capabilities
- `email-campaign-recipient-resolution`: requirement "เลือกผู้รับแคมเปญได้หลายกลุ่มพร้อมกัน" เปลี่ยนกลไก UI จาก checkbox list เป็น `MultiSelectCombobox` — พฤติกรรมผลลัพธ์ (เลือกได้หลายกลุ่ม, group_ids ที่บันทึก) ไม่เปลี่ยน

## Impact

- **Frontend ใหม่**: `src/components/MultiSelectCombobox.tsx` — ใช้ `Popover`, `Command`, `Badge` ที่มีอยู่แล้ว ไม่มี dependency ใหม่
- **Frontend แก้ไข**: `src/pages/MarketingPage.tsx` — แทนที่ checkbox list ของกลุ่มผู้รับ (เพิ่มไว้ใน change ก่อนหน้า `email-campaign-multi-group-send`) ด้วย `<MultiSelectCombobox>`
- **ไม่กระทบ backend**: `api/email-campaigns.php`, `resolveCampaignRecipients()`, endpoint `recipient_count` ทั้งหมดรับ/คืน `group_ids: string[]` เหมือนเดิม — เปลี่ยนแค่ตัวป้อนข้อมูลฝั่ง UI
