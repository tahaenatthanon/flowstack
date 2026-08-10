## Context

หน้า "ผลงานคอนเทนต์" (`ContentPage.tsx`) มี Tab หลัก 4 อัน โดยแท็บ "ผลงานทั้งหมด" (`ContentListTab.tsx`) ใช้ `Tabs` component จาก shadcn-ui ในการกรองตาม type (บทความ/วีดีโอ/รูปภาพ) อยู่แล้ว แต่ไม่มีตัวกรองตาม status (`draft`, `review`, `published`) ทำให้คอนเทนต์ทุกสถานะปนกันใน view เดียว

**Constraints:**
- ใช้ shadcn-ui `Tabs` component เหมือนกับ Type Filter เดิม
- ใช้ Tailwind CSS ตาม Design System ของโปรเจกต์
- ข้อความ UI ทั้งหมดเป็นภาษาไทย
- ห้ามกระทบหน้าอื่นหรือ component อื่นนอก scope
- `content_items.status` เป็น ENUM: `draft`, `revision`, `review`, `published`
## Goals / Non-Goals

**Goals:**
- เพิ่ม Status Sub-tab bar สำหรับกรอง `draft`, `revision`, `review`, `published` ใน `ContentListTab`
- เพิ่ม ENUM value `revision` ใน `content_items.status` ผ่าน database migration
- แสดงจำนวนนับ (count) ของแต่ละสถานะจากข้อมูล content items ที่ fetch มาแล้ว
- วาง Status Sub-tab ระหว่าง Tab หลักกับ Type Filter เดิม
- เปลี่ยน label `STATUS_MAP.review` จาก "รออนุมัติ" → "รอเผยแพร่"
- เพิ่ม entry `revision` ใน `STATUS_MAP` พร้อม label "รอแก้ไข"
- รักษาความสอดคล้องของไอคอนตาม Design System
- เพิ่มไอคอนในปุ่ม "ทั้งหมด" ของ Type Filter ให้มี icon สอดคล้องกับ tab อื่นในชุดเดียวกัน

**Non-Goals:**
- ไม่เพิ่ม filter ฝั่ง server-side (ใช้ client-side filtering จากข้อมูลที่มีอยู่)
- ไม่เพิ่ม tab ใหม่ในระดับบนของ `ContentPage`
- ไม่เปลี่ยนลำดับ Tab หลัก
- ไม่เปลี่ยน API endpoint logic

## Decisions

### 1. Client-side filtering vs Server-side filtering

**Decision:** Client-side filtering

**Rationale:** `useContentItems()` ดึง content items ทั้งหมดมาแล้ว (ไม่มี pagination) การกรอง client-side เร็วและไม่ต้องเปลี่ยน API การเพิ่ม server-side filter จะ over-engineer สำหรับ use case นี้

### 2. ใช้ Tabs component เดียวกับ Type Filter

**Decision:** ใช้ `<Tabs>` จาก shadcn-ui (`src/components/ui/tabs.tsx`) แบบเดียวกับ Type Filter เดิม

**Rationale:** UI consistency — ผู้ใช้เห็น pattern เดียวกันทั้ง Status และ Type filter ลดความสับสน

### 3. State management

**Decision:** ใช้ `useState<'all' | 'draft' | 'revision' | 'review' | 'published'>('all')` ใน `ContentListTab`

**Rationale:** State อยู่ภายใน component เดียว ไม่ซับซ้อนพอที่จะใช้ URL params หรือ context

### 4. การนับ count

**Decision:** ใช้ `useMemo` นับจาก array `items` ที่ได้จาก `useContentItems()`

**Rationale:** ข้อมูลมีอยู่แล้ว ไม่ต้อง query เพิ่ม คำนวณ O(n) ครั้งเดียวตอน render

### 5. Database migration สำหรับ status `revision`

**Decision:** เพิ่ม ENUM value `revision` ใน `content_items.status` ผ่าน ALTER TABLE

**Rationale:** `revision` เป็นสถานะใหม่ที่ยังไม่มีใน schema ปัจจุบัน ต้องเพิ่มก่อนจึงจะสามารถใช้ filter ได้

### 6. Database migration สำหรับ status `revision`

**Decision:** เพิ่ม ENUM value `revision` ใน `content_items.status` ผ่าน ALTER TABLE

**Rationale:** `revision` เป็นสถานะใหม่ที่ยังไม่มีใน schema ปัจจุบัน ต้องเพิ่มก่อนจึงจะสามารถใช้ filter ได้

**Decision:** วางระหว่าง Tab หลัก (ใน `ContentPage`) และ Type Filter (ใน `ContentListTab`)

**Rationale:** Status เป็นตัวกรองแรกที่ผู้ใช้ต้องการ ตามด้วย type ตาม workflow การทำงาน

## Risks / Trade-offs

- **ข้อมูลเยอะมาก (>1000 items):** Client-side filtering อาจช้า → ในทางปฏิบัติ content items ต่อ tenant ไม่เกินหลักร้อย หากถึงจุดนั้นสามารถเพิ่ม server-side filter ทีหลัง
- **Mobile layout:** Sub-tab เพิ่มอีก 1 แถว → `TabsList` ใช้ `h-auto` + `flex-wrap` ทำให้ tab ที่เกินความกว้างจอขึ้นบรรทัดใหม่แทนการล้นออกนอกจอ รองรับได้

## Open Questions

<!-- ไม่มีประเด็นที่ต้องตัดสินใจเพิ่ม -->
