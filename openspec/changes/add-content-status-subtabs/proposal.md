## Why

ผู้ใช้ไม่สามารถกรองคอนเทนต์ตามสถานะได้ในหน้า "ผลงานคอนเทนต์" — ปัจจุบันคอนเทนต์ทุกสถานะ (draft, review, published) แสดงรวมกันในแท็บเดียว ทำให้ค้นหาและจัดการคอนเทนต์ตาม workflow (ร่าง → รอเผยแพร่ → เผยแพร่แล้ว) ได้ยาก ส่งผลต่อ productivity ของทีมคอนเทนต์ที่ต้องติดตามสถานะของแต่ละรายการ

## What Changes

- เพิ่ม Status Sub-tab bar ใน `ContentListTab` สำหรับกรองตามสถานะ: ทั้งหมด, ฉบับร่าง (draft), รอแก้ไข (revision), รอเผยแพร่ (review), เผยแพร่แล้ว (published)
- เพิ่มสถานะ `revision` (รอแก้ไข) ใน `content_items.status` ENUM ผ่าน database migration
- แต่ละ Sub-tab แสดงจำนวนคอนเทนต์ (count) ของสถานะนั้นจากข้อมูลจริง
- Status Sub-tab วางอยู่ระหว่าง Tab หลัก และ Type Filter เดิม
- เปลี่ยน label ของสถานะ `review` ใน `STATUS_MAP` จาก "รออนุมัติ" เป็น "รอเผยแพร่"
- เพิ่ม entry ใหม่ `revision` ใน `STATUS_MAP` พร้อม label "รอแก้ไข"
- ไอคอนของ Status Sub-tab ใช้รูปแบบเดียวกันกับ Type Filter เดิม เพื่อความสอดคล้องของ UI

## Capabilities

### New Capabilities
- `content-status-filter`: เพิ่ม Status Sub-tab สำหรับกรอง content items ตามสถานะ (draft, revision, review, published) พร้อมแสดงจำนวนนับ

### Modified Capabilities
<!-- ไม่มี capability เดิมที่ถูกแก้ไขในระดับ spec -->

## Impact

- `src/components/content/tabs/ContentListTab.tsx` — เพิ่ม status filter state, Tabs component, และ filter logic
- `src/components/content/types.ts` — เปลี่ยน label `STATUS_MAP.review` จาก "รออนุมัติ" → "รอเผยแพร่"; เพิ่ม entry `revision`
- `src/hooks/useContent.ts` — อาจต้องเพิ่ม query key/invalidation หากมีการเปลี่ยนแปลงที่เกี่ยวข้อง
- `database/schema.sql` — `content_items.status` ENUM เพิ่มค่า `'revision'` (รอแก้ไข)
- `database/migrations/` — migration file สำหรับ ALTER TABLE เพิ่ม ENUM value
