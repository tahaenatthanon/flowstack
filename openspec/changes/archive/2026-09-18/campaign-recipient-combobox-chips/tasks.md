## 1. เปลี่ยนตัวห่อ trigger จาก Button เป็น div-based combobox

- [x] 1.1 ใน [MultiSelectCombobox.tsx](../../../src/components/MultiSelectCombobox.tsx) เปลี่ยน child ของ `PopoverTrigger asChild` จาก `<Button variant="outline" role="combobox" aria-expanded={open}>` เป็น `<div role="combobox" aria-expanded={open} tabIndex={0}>` พร้อม class ให้หน้าตาเหมือนปุ่มเดิม (border, padding, radius, focus ring, hover state ตาม `Button` variant `outline`)
- [x] 1.2 เพิ่ม `onKeyDown` บน div trigger ให้กด Enter หรือ Space แล้ว toggle `open` (เดิมได้ฟรีจากพฤติกรรม native ของ `<button>`)
- [x] 1.3 เปลี่ยน container ของ trigger เป็น `flex flex-wrap items-center gap-1.5` และ `min-height` แทน fixed height เดิม เพื่อรองรับ chip ขึ้นหลายบรรทัด

## 2. ย้าย chip เข้าไปในกล่อง trigger

- [x] 2.1 ย้าย JSX ของ chip block (บรรทัด 133-149 เดิม) จากตำแหน่งใต้ `</Popover>` เข้าไปอยู่ภายใน div trigger แทนที่ `<span>{placeholder}</span>` เมื่อ `selectedOptions.length > 0`
- [x] 2.2 คง `<span>{placeholder}</span>` ไว้เป็น fallback เมื่อ `selectedOptions.length === 0`
- [x] 2.3 เพิ่ม `e.stopPropagation()` ในปุ่ม × ของแต่ละ chip (`remove` handler) เพื่อกัน click event ไหลไปเปิด/ปิด popover ของ trigger ที่ห่ออยู่รอบนอก
- [x] 2.4 ย้าย `ChevronsUpDown` icon ให้อยู่ตำแหน่งที่เหมาะสมเมื่อมี chip หลายบรรทัด (เช่น `ml-auto self-start` หรือ shrink-0 ชิดขวาเสมอ)

## 3. ทดสอบ

- [x] 3.1 ทดสอบในหน้าแคมเปญจริง: เลือก 3 กลุ่ม ("Smart Factory", "Q2 2026 Target List", "Test Group") จนกล่อง wrap เป็น 2 บรรทัด — กล่องขยายความสูงถูกต้อง chevron อยู่มุมขวาเสมอ ไม่มีเนื้อหาถูกตัด
- [x] 3.2 คลิก × บน chip "Q2 2026 Target List" ขณะ popover เปิดอยู่ — ลบออกทันที popover ยังคงเปิดอยู่ ไม่ได้ถูกปิด/เปิดซ้ำเป็นผลข้างเคียงจากการคลิก (`stopPropagation` ทำงานถูกต้อง)
- [x] 3.3 ทดสอบคีย์บอร์ด: กด Tab จาก field ก่อนหน้าไปที่กล่อง trigger ยืนยันว่า focus ตกที่ `<div role="combobox">` ถูกต้อง (เช็คผ่าน `document.activeElement`) — เครื่องมือ automation ของ browser pane ส่ง key event แบบ synthetic ที่ไม่ใส่ค่า `key`/`code` มาด้วย (เป็นข้อจำกัดของเครื่องมือทดสอบเอง ไม่ใช่โค้ด) จึงยืนยัน logic ของ `handleTriggerKeyDown` ด้วยการ dispatch `KeyboardEvent({key:'Enter'})` ตรงๆ ผ่าน JS แทน (เทียบเท่าค่าที่ browser จริงส่งมาตอนผู้ใช้กด Enter จริง) — ผลคือ `aria-expanded` สลับ true/false ถูกต้องทุกครั้ง และปุ่ม × ของแต่ละ chip เป็น native `<button>` โฟกัสได้และกด Enter/Space activate ได้ปกติอยู่แล้วโดยไม่ต้องเขียน handler เพิ่ม (ทดสอบ `.focus()` + `.click()` ยืนยันแล้วว่าลบ chip ได้ถูกต้อง)
- [x] 3.4 เช็ค console log ของเบราว์เซอร์ระหว่างทดสอบทั้งหมด — ไม่มี warning เรื่อง invalid HTML nesting หรืออื่นใดเลย
- [x] 3.5 ทดสอบพิมพ์ค้นหา "Winai" ในช่องค้นหา — กรองเหลือเฉพาะ "Winai" ถูกต้อง และปุ่ม "เลือกทั้งหมด" ยังแสดงอยู่ด้านบน — ยืนยันว่า logic เดิมไม่ได้รับผลกระทบ

## 4. Verification

- [x] 4.1 รัน `pnpm lint` (0 errors, warning เดิมที่ไม่เกี่ยวข้อง) และ `pnpm build` (สำเร็จ)
