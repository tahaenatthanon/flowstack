# content-approved-status Specification (delta)

## MODIFIED Requirements

### Requirement: สถานะ approved มีใน STATUS_MAP
ระบบ SHALL รวม `approved` เป็น status key ใน `STATUS_MAP` พร้อม label ภาษาไทย "อนุมัติแล้ว" และสีที่แตกต่างจากสถานะอื่น (โดยเฉพาะ `published`)

#### Scenario: สถานะ approved ใน STATUS_MAP
- **WHEN** STATUS_MAP ถูก query ด้วย key `approved`
- **THEN** คืนค่า `{ label: 'อนุมัติแล้ว', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300', icon: Stamp, iconColor: 'text-teal-600' }` — ต่างจาก `published` (เขียว CheckCircle2) และ `revision` (น้ำเงิน RotateCcw)
