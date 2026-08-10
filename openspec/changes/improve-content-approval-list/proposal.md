## Why

หน้ารายการอนุมัติปัจจุบันแสดงเฉพาะคอนเทนต์ที่สถานะ `review` (รออนุมัติ) และมีเพียงตัวกรองแพลตฟอร์มกับช่องค้นหาพื้นฐาน ผู้ใช้งานไม่มีภาพรวมของสถานะคอนเทนต์ทั้งหมด ไม่สามารถกรองตามสถานะอื่น ๆ และไม่สามารถจัดเรียงรายการตามวันที่ ทำให้การจัดการคอนเทนต์ในขั้นตอนอนุมัติขาดประสิทธิภาพ

## What Changes

- เพิ่ม Stat Cards แสดงจำนวนสรุปตามสถานะ: รออนุมัติ (`review`), อนุมัติแล้ว (`published`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`) โดยใช้ Visual Style แบบ `stat-card card-hover` สอดคล้องกับ Stat Cards ของหน้า Projects
- เพิ่ม Type Filter Dropdown สำหรับกรองตามประเภทคอนเทนต์: ทั้งหมด, บทความ (`article`), วีดีโอ (`video`) — วางไว้ด้านหน้าของ Platform Filter
- เพิ่ม Tab Navigation สำหรับกรองรายการตามสถานะ โดยใช้รูปแบบเดียวกับ Status Filter ในหน้าผลงานคอนเทนต์ (`ContentListTab.tsx`) — TabsList แบบ `h-auto p-1 flex flex-wrap gap-0.5`, TabsTrigger แบบ `gap-1.5 text-xs sm:text-sm` พร้อม Icon `h-3.5 w-3.5` และ count badge ทรงกลมด้านหลังข้อความ: ทั้งหมด, รออนุมัติ, อนุมัติแล้ว, ขอแก้ไข, ปฏิเสธ
- เพิ่ม Dropdown จัดเรียงรายการตามวันที่ (ใหม่ → เก่า, เก่า → ใหม่)
- ย้ายช่องค้นหาไปไว้ด้านหน้าสุดของ toolbar ตามด้วย Type Filter, Platform Filter และตัวเลือกการเรียงลำดับ โดย Tab Navigation อยู่แถวบน พร้อมเปลี่ยนไอคอนช่องค้นหาเป็น `Search` (แว่นขยาย) จาก `FileText` เดิม
- เปลี่ยน logic หน้าให้แสดงทุกสถานะ (ไม่ใช่เฉพาะ `review`) โดย Tab เป็นตัวกรอง
- **BREAKING**: เปลี่ยนการกรองจากแสดงเฉพาะ `review` เป็นแสดงทุกรายการตาม Tab ที่เลือก
- เพิ่มสถานะ `rejected` ใน `STATUS_MAP` และเปลี่ยน `handleReject` จาก `draft` เป็น `rejected`
- **DATABASE**: `ALTER TABLE content_items` เพิ่ม `'rejected'` ใน ENUM ของ column `status`

## Capabilities

### New Capabilities
- `approval-stats-cards`: แสดง Stat Cards สรุปจำนวนคอนเทนต์ตามสถานะ (รออนุมัติ, อนุมัติแล้ว, ขอแก้ไข, ปฏิเสธ) โดยใช้ Visual Style `stat-card card-hover` สอดคล้องกับหน้า Projects
- `approval-tab-navigation`: Tab Navigation สำหรับกรองรายการตามสถานะ โดยใช้รูปแบบเดียวกับ Status Filter ในหน้าผลงานคอนเทนต์ (`h-auto p-1 flex flex-wrap gap-0.5`, Icons `h-3.5 w-3.5`, count badge ทรงกลม) พร้อมแสดงจำนวนรายการในแต่ละ Tab
- `approval-sort-order`: Dropdown จัดเรียงรายการตามวันที่ (ใหม่ → เก่า, เก่า → ใหม่)
- `approval-type-filter`: Type Filter Dropdown สำหรับกรองตามประเภทคอนเทนต์ (ทั้งหมด, บทความ, วีดีโอ) วางด้านหน้า Platform Filter

### Modified Capabilities
- `content-approval-list`: เปลี่ยนจากแสดงเฉพาะ `review` เป็นแสดงทุกรายการโดยมี Tab กรองตามสถานะ, เพิ่ม Stat Cards, Sort Dropdown, Type Filter, จัดกลุ่ม toolbar ใหม่, เพิ่มสถานะ `rejected` แยกจาก `draft`, และเพิ่ม `rejected` ใน DB schema ENUM

## Impact

- `src/pages/ContentApprovalPage.tsx` — ปรับปรุง UI หลัก: เพิ่ม Stat Cards (ใช้ `stat-card card-hover` pattern), Tab Navigation (Status Filter pattern จาก ContentListTab พร้อม count badge), Type Filter, Sort Dropdown, ปรับ logic การกรองและการ reject
- `src/components/content/types.ts` — เพิ่ม `rejected: { label: 'ปฏิเสธ', color: ... }` ใน `STATUS_MAP`; อ้างอิง `TYPE_MAP` สำหรับ Type Filter
- `database/migrations/` — migration ใหม่: `ALTER TABLE content_items MODIFY COLUMN status ENUM(...'rejected')`
- `api/content-items.php` *(optional)* — เพิ่ม query params `?status=`, `?type=` และ `?sort=`/`?order=`
