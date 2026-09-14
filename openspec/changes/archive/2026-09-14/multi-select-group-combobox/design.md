## Context

ระบบมี Combobox หลายตัวอยู่แล้ว (`CompanyCombobox`, `LeadSourceCombobox`, `ModelCombobox`, `OpportunityCombobox`, `ProjectCombobox`, `UserCombobox`, `ProjectFilterSelect`) ทุกตัวสร้างจาก pattern เดียวกัน: `Popover` + `Command`/`CommandInput`/`CommandItem` และ **ทุกตัวเป็น single-select** — `onSelect` เรียก `onChange(value)` แล้ว `setOpen(false)` ปิด popover ทันที (ดูตัวอย่างเต็มใน [ProjectFilterSelect.tsx](src/components/ProjectFilterSelect.tsx))

ตัวเลือกกลุ่มผู้รับในหน้าแคมเปญอีเมล ([MarketingPage.tsx](src/pages/MarketingPage.tsx)) เพิ่งเปลี่ยนจาก dropdown single-select เดิมเป็น checkbox list (เพื่อรองรับ multi-group ใน change ก่อนหน้า `email-campaign-multi-group-send`) — checkbox list ใช้งานได้แต่ไม่มีช่องค้นหา และไม่ scale เมื่อมีกลุ่มเยอะ

Pattern "ค้นหา + เลือกได้หลายอัน" ที่มีอยู่แล้วในระบบคือ `CustomerList` (component ภายใน `MarketingPage.tsx` เอง ใช้ตอนเพิ่มสมาชิกเข้ากลุ่ม) แต่เป็น "search box + checkbox list ที่แสดงตลอด" ไม่ใช่ dropdown/popover — คนละ UI pattern กับที่ขอ (multi-select dropdown)

## Goals / Non-Goals

**Goals:**
- Component ใหม่ที่ generic พอจะใช้แทนที่ checkbox list ของกลุ่มผู้รับ และใช้ซ้ำที่อื่นในระบบได้ในอนาคต (เช่น เลือก assignee หลายคน, filter หลายค่า)
- ค้นหา/กรองรายการได้แบบเดียวกับ Combobox เดิม (ใช้ `Command`'s built-in filter)
- เห็นรายการที่เลือกไว้ตลอดเวลาโดยไม่ต้องเปิด popover (chip)

**Non-Goals:**
- ไม่แก้ backend ใดๆ — `group_ids: string[]` ที่ส่งเข้า/ออกจาก API เหมือนเดิมทุกประการ
- ไม่ทำ virtualization สำหรับรายการยาวมาก (หลักพัน+) — ขอบเขตนี้รองรับ "หลายสิบถึงหลักร้อย" ตามที่ชง proposal เดิม (จำนวนกลุ่มจริงตอนนี้ = 4)
- ไม่ migrate Combobox single-select ตัวอื่นๆ มาใช้ component ใหม่นี้ — สร้างเสร็จแล้วต้องใช้งานได้ ไม่บังคับ refactor ของเดิม

## Decisions

### 1. Popover ไม่ปิดหลังเลือกแต่ละรายการ (deviate จาก convention เดิมโดยตั้งใจ)
Combobox เดิมทุกตัวปิด popover ทันทีหลัง `onSelect` เพราะเป็น single-select (เลือกเสร็จก็จบ) — `MultiSelectCombobox` ต้อง "ไม่ปิด" เพื่อให้เลือกต่อได้หลายรายการรวด เดียว ปิดเฉพาะตอนผู้ใช้คลิกนอก popover หรือกด Escape (พฤติกรรมเริ่มต้นของ `Popover` จาก Radix อยู่แล้ว ไม่ต้องเขียนเพิ่ม)

### 2. Chip แสดงนอก dropdown ใช้ `Badge` + ปุ่ม × ใหม่
ไม่มี removable-badge pattern ในระบบมาก่อน — สร้างใหม่โดยใช้ `Badge` ที่มีอยู่แล้ว + ปุ่ม icon `X` (lucide, มีอยู่แล้วในระบบ) วางไว้ข้างในหรือท้าย badge เมื่อคลิก × เรียก `onChange` เอา id นั้นออกจาก array ทันที (ไม่ต้องเปิด popover)

### 3. API ของ component: generic ด้วย `options: { value, label, meta? }[]`
```ts
interface MultiSelectOption {
  value: string;
  label: string;
  /** ข้อความรอง แสดงจางๆ ด้านขวาของแต่ละตัวเลือก เช่น "22 คน" */
  meta?: string;
}
interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;        // ข้อความบนปุ่ม trigger เมื่อยังไม่เลือก
  searchPlaceholder?: string;
  emptyText?: string;
  showSelectAll?: boolean;     // default true
  className?: string;
}
```
`meta` ทำให้ใช้กับ email groups ได้ตรงๆ (`meta: `${g.member_count} คน``) โดยไม่ต้องผูก field ชื่อ `member_count` เข้ากับ component ทั่วไป — คงความ generic ไว้

### 4. "เลือกทั้งหมด" เป็น default เปิด (`showSelectAll = true`)
ยังไม่ได้ถามผู้ใช้ตรงๆ ระหว่าง explore — ตัดสินใจเปิดเป็นค่าเริ่มต้นเพราะ `CustomerList` ที่เป็น precedent ใกล้เคียงที่สุดในระบบมีปุ่มนี้อยู่แล้ว และเป็น prop ที่ปิดได้ทีหลังถ้าไม่ต้องการในบางจุดที่ใช้ component นี้

### 5. Trigger button คงที่ ไม่โชว์ตัวสรุปจำนวนที่เลือก
เพราะ chip แถวนอก popover ทำหน้าที่นั้นอยู่แล้ว — trigger แสดงแค่ placeholder เช่น "เลือกกลุ่มผู้รับ" เสมอ ป้องกันข้อมูลซ้ำซ้อน (ตัวเลขโชว์ 2 ที่ไม่ตรงกันได้ถ้า sync พลาด)

## Risks / Trade-offs

- **[ความเสี่ยง] Chip row อาจกินพื้นที่แนวตั้งมากเมื่อเลือกหลายสิบรายการ** → Mitigation: ใช้ `flex-wrap` + จำกัดความสูงด้วย `max-h` + `overflow-y-auto` บน chip container เอง (เหมือน pattern ที่มีอยู่แล้วบน checkbox list เดิม)
- **[ความเสี่ยง] Component ใหม่ที่ generic เกินไปอาจถูกออกแบบเผื่ออนาคตเกินความจำเป็น (YAGNI)** → Mitigation: ขอบเขต props จำกัดเฉพาะที่ใช้จริงตอนนี้ (options/value/onChange/meta/showSelectAll) ไม่เพิ่ม prop เผื่อ use case ที่ยังไม่มีคนขอ
- **[Trade-off] ไม่ทำ virtualization** — ถ้าจำนวนกลุ่มโตเกินหลักร้อยในอนาคต การ render `CommandItem` ทุกตัวอาจช้า แต่ไม่ใช่ปัญหาที่ข้อมูลจริงตอนนี้ (4 กลุ่ม) ยอมรับความเสี่ยงนี้ไว้ก่อน

## Migration Plan

ไม่มี migration ฝั่ง data — เป็นการเปลี่ยน UI component ล้วนๆ Deploy ปกติ แทนที่ checkbox list ในไฟล์เดียว (`MarketingPage.tsx`) Rollback: revert commit ได้ตรงๆ

## Open Questions

- ยืนยัน default `showSelectAll = true` กับผู้ใช้จริงหรือยัง — ถ้าไม่ต้องการให้ปิดเป็นค่าเริ่มต้นแทน (แค่พลิก default ใน component เดียว ไม่กระทบโครงสร้าง)
