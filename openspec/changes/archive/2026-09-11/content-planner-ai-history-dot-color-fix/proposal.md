## Why

`ContentPlannerAI.tsx` (sidebar "แผนล่าสุด") render จุดสีเล็กๆ ข้างหัวข้อแต่ละ item ด้วย hardcoded ternary chain (`item.platform === 'facebook' ? 'bg-indigo-500' : ...`) ที่นิยามสีแพลตฟอร์มซ้ำกับ `PLATFORM_CATALOG` ใน `src/lib/platformConfig.ts` — ละเมิด requirement ที่มีอยู่แล้วใน capability `platform-color-catalog` ("ห้ามมีการนิยามสีของแพลตฟอร์มเดียวกันซ้ำในไฟล์อื่น") ซึ่งเป็นจุดตกหล่นจากตอนทำ change นั้นครั้งแรก นอกจากนี้ยังมีบั๊กคลาสเดียวกับที่แก้ไปแล้วหลายรอบ: เทียบ `item.platform === 'facebook'` แบบ exact-match กับฟิลด์ที่อาจเป็น comma-joined string เมื่อ item มีหลายแพลตฟอร์ม ทำให้ item หลายแพลตฟอร์มได้จุดสีเทา default เสมอ ทั้งที่ควรได้สีของแพลตฟอร์มแรกอย่างน้อย — พบระหว่างสำรวจโค้ดทั้งโมดูลคอนเทนต์ (จุดที่ 4 จาก 4 ที่พบ)

## What Changes

- แก้จุดสีใน `ContentPlannerAI.tsx` ให้ parse แพลตฟอร์มของ item ก่อน (`parsePlatforms(item.platforms ?? item.platform)`) แล้วใช้สีของแพลตฟอร์มแรกจาก `getPlatformColors()` (single source of truth เดียวกับที่อื่นทั้งระบบ) แทนการเขียน ternary chain สีเอง
- ใช้ `hex.text` ของแพลตฟอร์มนั้น (โทนเข้ม เหมาะกับจุดขนาดเล็กที่ต้องมองเห็นชัด ต่างจาก `hex.bg` ที่เป็นโทนอ่อนสำหรับพื้นหลัง badge) เป็นสี background ของจุด
- เมื่อ item ไม่มีแพลตฟอร์มเลย (parse ได้ array ว่าง) ยังคงใช้สีเทา default เหมือนเดิม
- ไม่เปลี่ยน layout อื่นของ sidebar (ชื่อหัวข้อ, วันที่, ปุ่มลบแผน ฯลฯ)

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `platform-color-catalog`: requirement "แหล่งข้อมูล label/สี/ไอคอนของแพลตฟอร์มต้องมีเพียงแหล่งเดียว" เดิมมีอยู่แล้วและครอบคลุมกรณีนี้ในหลักการ แต่ยังไม่มี scenario ที่ยืนยันว่า `ContentPlannerAI.tsx` (ซึ่งละเมิด requirement นี้อยู่ก่อนหน้า) ปฏิบัติตามแล้ว — เพิ่ม scenario ใหม่เพื่อบันทึกไว้

## Impact

- `src/components/content/ContentPlannerAI.tsx`
- ไม่มีการเปลี่ยน schema ฐานข้อมูลหรือ API
