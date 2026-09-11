## Why

Content item หนึ่งชิ้นเลือกได้หลายแพลตฟอร์มพร้อมกัน (เก็บเป็นสตริง comma-joined ใน `content_items.platform` เช่น `"facebook,linkedin,twitter,instagram,lineoa,wordpress,wix"`) แต่ 3 จุด UI ที่แสดงแพลตฟอร์มของ content item — dialog แก้ไข, chip บนปฏิทิน, และคอลัมน์ในมุมมองรายการ — เอาสตริงทั้งก้อนนี้ไป lookup เป็นแพลตฟอร์มเดียว ผลคือ: dialog โชว์สตริงดิบยาวๆ ตรงๆ ให้ผู้ใช้เห็น ส่วน chip ปฏิทินกับคอลัมน์รายการ lookup พลาดเงียบๆ กลายเป็นไอคอน/สีเทา default ที่ไม่สื่อความหมายอะไรเลย ทั้งที่ระบบมี component ที่ทำถูกอยู่แล้ว (`ContentDetailView.tsx`) และมีข้อมูล platforms แบบ array ที่ parse ไว้ถูกต้องอยู่แล้วในบางจุด (`ContentCardDialog`'s `platforms` state) เพียงแต่ไม่ได้ถูกใช้ตรงจุดที่ควรใช้

ระหว่างแก้ยังพบว่าสี/label ของแพลตฟอร์มถูกนิยามซ้ำกันอยู่ 2 ระบบคู่ขนาน (`PLATFORM_MAP` แบบ Tailwind class มี dark mode vs `getPlatformColors()` แบบ hex ไม่มี dark mode) บวกอีก 1 map ที่ซ้ำซ้อนไม่มีเหตุผล (`AnalyticsSocialTab.tsx`) ทำให้สีแพลตฟอร์มเดียวกันไม่ตรงกันเป๊ะในแต่ละหน้า และแก้แค่จุดเดียวจะไม่ปิดปัญหาการดริฟต์ในระยะยาว

## What Changes

- รวมนิยาม label/สีของแพลตฟอร์มเป็นแหล่งข้อมูลเดียว (`src/lib/platformConfig.ts`) ที่มีทั้ง label, hex color (bg/text/border), และ Tailwind class (พร้อม dark mode) ต่อแพลตฟอร์ม — `PLATFORM_MAP` ใน `types.ts` และ `getPlatformColors()` เดิมยังคง API/import path เดิมทุกไฟล์ที่ใช้อยู่ (16+ ไฟล์) แต่ดึงค่าจากแหล่งเดียวกันแทนการนิยามซ้ำ
- ยุบ `PLATFORM_LABELS` ใน `AnalyticsSocialTab.tsx` เข้ากับ catalog กลาง (ซ้ำกับของเดิม 100% ไม่มีเหตุผลให้แยก)
- คงแยก `PLATFORM_COLORS` ใน `ContentVideoView.tsx` ไว้ตามเดิม — เป็นดีไซน์ตั้งใจ (badge สีทึบทับวิดีโอ ต่างจากโทนอ่อนที่อื่น) ไม่ใช่ความซ้ำซ้อนที่ต้องแก้
- เพิ่ม component กลางสำหรับแสดงแพลตฟอร์มหลายอันเป็นรายการแยก มีสี/ไอคอนต่อแพลตฟอร์ม (ดึง pattern ที่ `ContentDetailView.tsx` ทำถูกอยู่แล้วออกมาใช้ซ้ำ) รองรับ 2 โหมด: แบบมี label (dialog) และแบบไอคอนอย่างเดียว (พื้นที่แคบ)
- แก้ 3 จุดที่แสดงแพลตฟอร์มของ content item แบบผิด ให้แสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง ไม่ตัดทอน (แสดงได้สูงสุดเท่าที่แพลตฟอร์มมีจริง คือ 7):
  - `ContentCardDialog.tsx` — badge ใน header
  - `ContentPlannerCalendar.tsx` — ไอคอนบน chip
  - `ContentItemList.tsx` — คอลัมน์แพลตฟอร์มในมุมมองรายการ
- ปรับ `ContentDetailView.tsx` ให้เรียกใช้ component กลางตัวใหม่แทน logic inline เดิม (มันคือต้นแบบของ component นี้อยู่แล้ว)

## Capabilities

### New Capabilities
- `platform-color-catalog`: แหล่งข้อมูลเดียวสำหรับ label/สี/ไอคอนของแพลตฟอร์ม ที่ระบบส่วนอื่นทั้งหมดต้องอ้างอิงแทนการนิยามซ้ำ
- `content-platform-badge-display`: กฎการแสดงผลแพลตฟอร์มของ content item ที่มีหลายแพลตฟอร์ม — ต้องแยกแสดงทีละแพลตฟอร์มพร้อมสี/ไอคอนที่ถูกต้อง ในทุกจุดที่แสดง (dialog, ปฏิทิน, รายการ, detail view)

### Modified Capabilities
(ไม่มี — ไม่มี capability เดิมใน `openspec/specs/` ที่ครอบคลุมการแสดงผลสี/แพลตฟอร์มนี้มาก่อน)

## Impact

- **Data layer**: `src/lib/platformConfig.ts` (ขยายเป็น catalog เดียว), `src/components/content/types.ts` (`PLATFORM_MAP` กลายเป็น derived re-export), `src/components/content/AnalyticsSocialTab.tsx` (ลบ `PLATFORM_LABELS` ที่ซ้ำ)
- **UI layer**: component กลางใหม่ (badge/icon list แบบ 2 โหมด), `ContentCardDialog.tsx`, `ContentPlannerCalendar.tsx`, `ContentItemList.tsx`, `ContentDetailView.tsx` (refactor ให้ใช้ component กลาง)
- **ไม่กระทบ**: `ContentVideoView.tsx` (คงไว้ตามเดิมโดยเจตนา), schema ฐานข้อมูล, backend API ใดๆ — เป็นการแก้เฉพาะฝั่ง frontend presentation
- **Import path**: ทุกไฟล์ที่ import `PLATFORM_MAP`/`getPlatformColors` เดิม (16+ ไฟล์) ไม่ต้องแก้ import — ได้ค่าที่ถูกต้อง/สอดคล้องกันโดยอัตโนมัติ
