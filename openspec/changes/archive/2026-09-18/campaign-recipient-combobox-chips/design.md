## Context

`MultiSelectCombobox` ([src/components/MultiSelectCombobox.tsx](../../../src/components/MultiSelectCombobox.tsx)) ปัจจุบันมีโครงสร้าง:

```
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox">   ← render เป็น <button>
      <span>{placeholder}</span>                  ← ข้อความตายตัว ไม่เปลี่ยนตามการเลือก
      <ChevronsUpDown />
    </Button>
  </PopoverTrigger>
  <PopoverContent>...รายการตัวเลือก...</PopoverContent>
</Popover>

{selectedOptions.length > 0 && (
  <div className="flex flex-wrap gap-1.5">   ← chip อยู่ตรงนี้ นอก Popover ทั้งก้อน
    {selectedOptions.map(opt => <Badge>...<button onClick={remove}>×</button></Badge>)}
  </div>
)}
```

โจทย์คือย้าย chip block (พร้อมปุ่ม × ที่เป็น `<button>` จริง) เข้าไปอยู่ **ภายใน** ตัว trigger — ถ้าทำตรงๆ โดยยังห่อด้วย `<Button>` (shadcn) ซึ่ง render เป็น `<button>` จะกลายเป็น `<button><button>×</button></button>` ซึ่งผิดกฎ HTML (ผิด HTML5 content model: interactive content ห้ามซ้อน interactive content) เบราว์เซอร์จะ auto-correct โดยการ "ปิด" `<button>` วงนอกก่อนแล้วค่อยเปิดวงในใหม่ ทำให้ DOM ที่ได้จริงไม่ตรงกับ JSX ที่เขียน (เช่น chip ที่ 2 เป็นต้นไปอาจหลุดออกมานอก trigger โดยไม่ได้ตั้งใจ) และ event bubbling/focus behavior จะเพี้ยนไม่ตรงกับที่ React คาดหวัง

## Goals / Non-Goals

**Goals:**
- ย้าย chip ของรายการที่เลือกเข้าไปแสดงในกล่อง trigger เอง แทนที่การแสดงใต้กล่องแบบเดิม
- คง UX เดิมไว้ครบ: คลิก × บน chip ลบออกได้ทันทีโดยไม่ต้องเปิด popover, คลิกที่กล่อง (นอก chip) เปิด/ปิด popover ได้เหมือนเดิม
- แก้ปัญหา nested-button ให้ถูกต้องตาม HTML semantics ไม่ใช่แค่ทำให้ "ดูเหมือนใช้ได้" บนเบราว์เซอร์บางตัว
- คงการทำงานด้าน keyboard/accessibility ไว้ไม่ให้แย่ลงกว่าเดิม (เดิมได้ฟรีจาก `<button>` เช่น focus ring, Enter/Space toggle)

**Non-Goals:**
- ไม่เปลี่ยน logic การกรอง/เลือกทั้งหมด/toggle ใน popover
- ไม่เปลี่ยน prop API ของ `MultiSelectCombobox` (`options`, `value`, `onChange`, `placeholder`, ฯลฯ) — เปลี่ยนแค่ internal markup/behavior การแสดงผล
- ไม่แก้ปัญหา `selectedTemplate` ค้าง (แยกเป็น change อื่น)

## Decisions

**Decision: เปลี่ยนตัวห่อ trigger จาก shadcn `<Button>` เป็น `<div role="combobox" tabIndex={0}>` ที่แต่ง class ให้หน้าตาเหมือนเดิม**

- ทางเลือกที่พิจารณา: คงเป็น `<Button>` ไว้ แต่เปลี่ยนปุ่ม × บน chip จาก `<button>` เป็น `<span onClick={...}>` ที่ไม่ใช่ element ที่ interactive โดยธรรมชาติ — เลี่ยงปัญหา nested-button ได้จริง แต่ทำให้ปุ่มลบใช้ผ่าน keyboard/screen reader ไม่ได้ (span ไม่ focusable โดย default ต้องเพิ่ม `tabIndex`+`onKeyDown` เองอยู่ดี ซึ่งพอทำครบก็แทบไม่ต่างจากปัญหาเดิมที่ต้อง handle เอง) และยังเป็นการเสีย semantic ที่ถูกต้อง (ปุ่มลบควรเป็น `<button>` จริงเพื่อให้ screen reader ประกาศว่าเป็นปุ่มกดได้)
- **เลือก div-based trigger** เพราะรักษา semantic ที่ถูกต้องของทั้งสองฝั่ง: ตัว trigger เองใช้ `role="combobox"` (ตรงกับที่มีอยู่แล้วใน design เดิม แค่ย้ายจาก attribute ของ `<button>` ไปเป็นของ `<div>`) ส่วนปุ่มลบยังเป็น `<button>` จริงที่ซ้อนอยู่ข้างในได้อย่างถูกกฎ (เพราะ `<div>` ไม่ใช่ interactive content ตาม HTML5 spec) ต้อง trade-off เพิ่ม `onKeyDown` เพื่อรองรับ Enter/Space เปิด popover เอง (เดิมได้ฟรีจาก `<button>` แต่เป็นโค้ดสั้นๆ ไม่กี่บรรทัด)

**Decision: ปุ่มลบ (×) บน chip เรียก `e.stopPropagation()` ก่อน `remove()`**

- ป้องกันไม่ให้ click event ไหลต่อไปถึง `onClick` ของตัว trigger div (ซึ่งจะสั่งเปิด/ปิด popover) — ต้องมีอยู่แล้วแม้ในดีไซน์เดิมที่ chip อยู่นอก trigger (ไม่มีปัญหานี้) แต่ตอนนี้ chip ซ้อนอยู่ในบริเวณคลิกของ trigger จึงต้องระวังเป็นพิเศษ ไม่งั้นคลิก × จะเปิด popover ขึ้นมาโดยไม่ตั้งใจพร้อมกับลบ chip

**Decision: กล่อง trigger ใช้ `flex-wrap` + ความสูง auto แทนความสูงคงที่**

- shadcn `Button` ปกติสูงคงที่ (`h-9`/`h-10`) บรรทัดเดียว พอใส่ chip หลายอันที่อาจ wrap หลายบรรทัด ต้องเปลี่ยนเป็น `min-height` + `flex-wrap` เพื่อให้กล่องขยายตามเนื้อหา — เป็นผลข้างเคียงที่ต้องยอมรับของการย้าย chip เข้ามา (กล่องจะไม่ใช่บรรทัดเดียวตายตัวอีกต่อไปเมื่อเลือกหลายกลุ่ม)

## Risks / Trade-offs

- [Risk] เปลี่ยนจาก `<button>` เป็น `<div>` อาจทำให้ browser default behavior บางอย่างหายไป (เช่น `disabled` attribute ใช้ไม่ได้กับ div, form submission behavior) → **การรับมือ**: component นี้ไม่เคยใช้ `disabled` หรืออยู่ใน `<form>` ที่พึ่งพา native submit behavior ของ trigger เลย (ตรวจสอบจาก usage เดียวที่มีคือ "กลุ่มผู้รับ" ในไดอะล็อกแคมเปญ) ความเสี่ยงนี้จึงต่ำในทางปฏิบัติ แต่ถ้าจุดใช้งานในอนาคตต้องการ `disabled` ต้องเพิ่ม `aria-disabled` + กัน `onClick`/`onKeyDown` เองแทน
- [Risk] Keyboard support ที่เพิ่มเองอาจไม่ครบเท่า native `<button>` (เช่น บาง screen reader คาดหวังพฤติกรรมเฉพาะของ `role="button"`/`role="combobox"` ที่ native element ให้มาฟรี) → **การรับมือ**: ทดสอบด้วยมือ: Tab เข้าไปโฟกัส, Enter/Space เปิด, Tab ต่อไปที่ปุ่ม × ของแต่ละ chip, Enter/Space ลบได้
- [Trade-off] กล่องสูงขึ้นเมื่อเลือกหลายกลุ่ม (ไม่ใช่บรรทัดเดียวคงที่อีกต่อไป) — ยอมรับได้เพราะเป็นสิ่งที่ผู้ใช้ต้องการโดยตรง (เห็น chip ในกล่อง) และ layout โดยรอบ (grid 2 คอลัมน์ผู้ส่ง/ผู้รับ) ไม่ได้ผูกความสูงคงที่ไว้

## Migration Plan

1. แก้ [MultiSelectCombobox.tsx](../../../src/components/MultiSelectCombobox.tsx): เปลี่ยน `PopoverTrigger asChild` child จาก `<Button>` เป็น `<div role="combobox" tabIndex={0}>`, ย้าย chip rendering block เข้าไปอยู่ในนั้น (แทนที่ `<span>{placeholder}</span>` เมื่อมีรายการที่เลือกไว้), เพิ่ม `onKeyDown` (Enter/Space → toggle `open`)
2. ทดสอบด้วยมือในหน้าแคมเปญ: เลือกหลายกลุ่มจนกล่อง wrap หลายบรรทัด, คลิก × ลบทีละอัน, เปิด popover ด้วย keyboard (Tab+Enter), ลบด้วย keyboard (Tab ไปที่ × แล้ว Enter/Space)
3. ยืนยันว่าไม่มี browser console warning เรื่อง invalid HTML nesting (เช็คผ่าน DevTools)
4. รัน `pnpm lint` และ `pnpm build`

Rollback: การเปลี่ยนแปลงจำกัดอยู่ในไฟล์เดียว ไม่มี migration ฐานข้อมูล ย้อนกลับได้ด้วยการ revert commit เดียว

## Open Questions

- ไม่มี — แนวทางได้รับการยืนยันจากผู้ใช้แล้วผ่าน mockup ที่สาธิตให้ดูก่อนหน้า
