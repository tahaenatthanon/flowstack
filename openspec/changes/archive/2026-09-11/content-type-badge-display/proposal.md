## Why

Change `platform-color-catalog` (archived วันนี้) เพิ่งแก้ให้ chip บนปฏิทิน (`ContentPlannerCalendar`) และคอลัมน์แพลตฟอร์มในมุมมองรายการ (`ContentItemList`) แสดงไอคอนแยกทีละแพลตฟอร์ม แทนสตริงดิบ/สีเทา default — แก้ถูกจุดที่พัง แต่พอเห็นของจริงในเบราว์เซอร์แล้วพบว่า content item ที่เลือกไว้หลายแพลตฟอร์ม (พบได้บ่อยในข้อมูลจริง สูงสุด 7 แพลตฟอร์ม) ทำให้ chip ที่มีพื้นที่แค่ ~80px ต้องอัดไอคอนเรียงกันแน่นเกินไป และข้อมูลแพลตฟอร์มไม่ใช่สิ่งที่มีประโยชน์ที่สุดสำหรับการกวาดตามองปฏิทิน — "เป็นบทความหรือวีดีโอ" สื่อความหมายชัดเจนกว่าในพื้นที่จำกัดขนาดนี้ ส่วนรายละเอียดแพลตฟอร์มยังดูได้ครบเมื่อคลิกเปิด dialog (ซึ่ง `platform-color-catalog` ทำให้ถูกต้องแล้ว)

## What Changes

- `ContentPlannerCalendar` chip: เลิกแสดงไอคอนแพลตฟอร์มทั้งหมด เปลี่ยนเป็นแสดง badge/ไอคอนประเภทเนื้อหาแทน — พื้นหลังทั้ง chip เปลี่ยนจากสีตามแพลตฟอร์มแรก เป็นสีตามประเภท (บทความ = ฟ้า, วีดีโอ = แดง ตาม `TYPE_MAP` ที่มีอยู่แล้ว) ข้อมูลแพลตฟอร์มไม่ปรากฏบน chip อีกต่อไป (ดูได้จากการคลิกเปิด dialog แทน)
- `ContentItemList`: คอลัมน์ "แพลตฟอร์ม" เปลี่ยนเป็นคอลัมน์ "ประเภท" แสดง badge เต็ม (ไอคอน + ชื่อประเภท เช่น "📄 บทความ") แทนไอคอนแพลตฟอร์ม — **BREAKING (UI)**: หัวคอลัมน์และ sort key เปลี่ยนความหมายจากเรียงตามแพลตฟอร์มเป็นเรียงตามประเภท
- เพิ่ม component กลางสำหรับ badge ประเภทเนื้อหา (ไอคอน + สี + label จาก `TYPE_MAP`/`getCanonicalContentType()` ที่มีอยู่แล้ว) รองรับโหมด "icon-only" (ปฏิทิน) และ "pill" (มุมมองรายการ)
- ลบโหมด `variant="icon-only"` ที่ไม่มีผู้ใช้งานอีกต่อไปออกจาก `PlatformBadgeList` (หลังจากนี้ไม่มีจุดไหนในระบบเรียกใช้โหมดนี้แล้ว — dialog และ detail view ใช้แค่ `variant="pill"`)
- **ไม่กระทบ**: `ContentCardDialog` header และ `ContentDetailView` ยังแสดง badge แพลตฟอร์มแยกทีละอันเหมือนเดิมทุกประการ (ตามที่ `platform-color-catalog` ทำไว้) — เปลี่ยนเฉพาะ 2 จุดที่ระบุข้างต้น

## Capabilities

### New Capabilities
- `content-type-badge-display`: กฎการแสดง badge/ไอคอนประเภทเนื้อหา (บทความ/วีดีโอ) บน `ContentPlannerCalendar` chip และ `ContentItemList` คอลัมน์ประเภท

### Modified Capabilities
- `content-platform-badge-display`: ตัด scope ของ requirement เดิมที่เคยครอบคลุมทั้ง 4 จุด (dialog, ปฏิทิน, รายการ, detail view) ให้เหลือเฉพาะ `ContentCardDialog` และ `ContentDetailView` เท่านั้น (ปฏิทินกับรายการไม่แสดงแพลตฟอร์มอีกต่อไป) และตัด requirement เรื่อง component ต้องรองรับ 2 โหมด (`pill`/`icon-only`) ให้เหลือแค่โหมด `pill` เดียว เพราะไม่มีผู้ใช้ `icon-only` เหลืออยู่

## Impact

- **Frontend**: `ContentPlannerCalendar.tsx`, `ContentItemList.tsx`, `PlatformBadgeList.tsx` (ตัดโหมด icon-only), component กลางใหม่สำหรับ type badge
- **ไม่กระทบ**: backend, schema ฐานข้อมูล, `ContentCardDialog.tsx`, `ContentDetailView.tsx` (ยังใช้ `PlatformBadgeList` variant="pill" เหมือนเดิม)
- **ไม่กระทบ**: ตัวกรอง `typeFilter`/`platformFilter` เดิมเหนือปฏิทิน/รายการ ยังทำงานเหมือนเดิมทุกประการ (คนละกลไกกับการแสดงผลในคอลัมน์/chip)
