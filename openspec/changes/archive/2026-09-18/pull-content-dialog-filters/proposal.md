## Why

หน้าต่าง "ดึงคอนเทนท์" (`PullFromContentDialog`) ในหน้าแคมเปญอีเมล มีแค่ช่องค้นหาด้วยชื่อเรื่องเท่านั้น ไม่มีตัวกรองมิติอื่นเลย และที่สำคัญกว่านั้นคือ backend (`GET /content-items.php`) ไม่กรองสถานะใดๆ — ดึงข้อมูล**ทุกสถานะ**มาแสดงรวมกันหมด ทั้ง `draft`, `revision`, `pending_approval`, `rejected` ปนกับ `approved`/`published`

จากข้อมูลจริงในระบบตอนนี้ 32 จาก 50 รายการ (64%) ยังไม่ผ่านการอนุมัติ — ผู้ใช้ที่กำลังรีบสร้างแคมเปญมีความเสี่ยงเผลอกด "เลือกคอนเทนต์นี้" ดึงเนื้อหาที่ยังไม่ผ่านการตรวจไปใส่ในอีเมลที่จะส่งถึงลูกค้าจริง

## What Changes

- เพิ่มตัวกรอง 3 มิติในหน้าต่าง "ดึงคอนเทนท์" เรียงตามลำดับ: **ประเภท** (article/video/image) → **สถานะ** (draft/pending_approval/approved/revision/rejected/published) → **แพลตฟอร์ม** (facebook/lineoa/...)
- **สถานะ**: กรองฝั่ง backend แบบ opt-in ผ่าน query param ใหม่ `?status=` บน `GET /content-items.php` — ไม่ใส่ param เหมือนเดิม (ปัจจุบัน `useContent.ts`/Content Planner เรียกแบบนี้) ยังคืนทุกสถานะเหมือนเดิมทุกประการ ไม่ breaking — `PullFromContentDialog` ส่ง `?status=approved,published` เป็นค่าเริ่มต้นเสมอ ผู้ใช้กดเปลี่ยนเพื่อดูสถานะอื่นได้ภายหลัง
- **ประเภท** และ **แพลตฟอร์ม**: กรองฝั่ง client-side ตามรูปแบบเดิมที่มีอยู่แล้วใน `ContentItemList.tsx`/`ContentPlannerPage.tsx` (pill-button toggle, ใช้ `parsePlatforms()` สำหรับแพลตฟอร์มเพราะเป็น comma-joined string)
- UI ใช้ pill-button pattern เดียวกับที่มีอยู่แล้วในหน้า Content Planner เพื่อความสม่ำเสมอ ไม่ประดิษฐ์ UI pattern ใหม่

## Capabilities

### New Capabilities
- `campaign-content-picker-filters`: กำหนดว่าหน้าต่าง "ดึงคอนเทนท์" ในหน้าแคมเปญอีเมลกรองรายการคอนเทนต์ตามประเภท/สถานะ/แพลตฟอร์มอย่างไร รวมถึงค่าเริ่มต้นของตัวกรองสถานะที่ต้องปลอดภัยต่อการส่งแคมเปญจริง

### Modified Capabilities
(ไม่มี — `content-status-filter`/`content-planner-platform-filter` ดูแลตัวกรองของหน้า "ผลงานคอนเทนต์"/Content Planner ซึ่งเป็นคนละหน้าจอ คนละ entry point ไม่ได้เปลี่ยน requirement เดิมของ capability เหล่านั้นเลย)

## Impact

- **Backend**: `api/content-items.php` — เพิ่ม optional `?status=` query param ใน GET handler (whitelist ค่าเดียวกับ `$validStatus` ที่มีอยู่แล้ว) ไม่กระทบ caller เดิมที่ไม่ส่ง param
- **Frontend**: `src/components/content/dialogs/PullFromContentDialog.tsx` — เพิ่ม state/UI ตัวกรอง 3 มิติ, ส่ง `?status=approved,published` เป็นค่าเริ่มต้นใน query
- **ไม่แตะ**: `useContent.ts`, `ContentPlannerPage.tsx`, `ContentItemList.tsx` และหน้าอื่นที่เรียก endpoint เดิมโดยไม่ส่ง `status` param — พฤติกรรมเดิมคงเดิมทุกประการ
