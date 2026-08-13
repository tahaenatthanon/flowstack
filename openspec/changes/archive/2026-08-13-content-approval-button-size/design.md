## Context

ปุ่ม "ขออนุมัติ" ใน footer ของ `ContentCardDialog` (`src/components/content/ContentCardDialog.tsx` บรรทัด ~763) ปัจจุบันเขียนเป็น:

```tsx
<Button variant="default" size="sm" className="gap-1.5" onClick={() => setRequestApprovalConfirm(true)}>
  <Send className="h-3.5 w-3.5" />ขออนุมัติ
</Button>
```

ปุ่มอื่นใน `DialogFooter` เดียวกัน (ยกเลิก, AI เขียนให้, บันทึก, ลบ) ไม่ได้ระบุ `size` จึงใช้ค่า default ของ shadcn button (`h-10 px-4 py-2` ตาม `src/components/ui/button.tsx` บรรทัด 20) ขณะที่ `size="sm"` ได้ `h-9 rounded-md px-3` (บรรทัด 21) — ส่งผลให้ "ขออนุมัติ" เตี้ยกว่าปุ่มอื่นในแถวเดียวกัน

## Goals / Non-Goals

**Goals:**
- ทำให้ปุ่ม "ขออนุมัติ" มีความสูงเท่ากับปุ่มอื่นใน footer ของ `ContentCardDialog` (สม่ำเสมอ)

**Non-Goals:**
- ไม่เปลี่ยนขนาดปุ่ม "ขออนุมัติ" ใน `ContentDetailView` (ปุ่มใน action bar นั้นใช้ `size="sm"` ทุกปุ่มอยู่แล้ว จึงสม่ำเสมอแล้ว)
- ไม่เปลี่ยน variant, สี, ไอคอน หรือตำแหน่งของปุ่ม

## Decisions

### Decision 1: ลบ `size="sm"` ออกจากปุ่ม "ขออนุมัติ" ใน `ContentCardDialog` footer

ใช้ขนาด default (ไม่ระบุ `size`) ให้ตรงกับปุ่ม "ยกเลิก", "AI เขียนให้", "บันทึก" ที่อยู่ใน footer เดียวกัน

**Rationale**: เป็นการแก้จุดเดียวที่ตรงสาเหตุ — ปุ่มใน `DialogFooter` ชุดเดียวกันควรใช้ขนาดเดียวกัน และปุ่มส่วนใหญ่ใน footer นี้ใช้ default size อยู่แล้ว

**Alternatives considered**:
- เปลี่ยนปุ่มอื่นทั้งหมดเป็น `size="sm"` แทน — กระทบปุ่ม 4 จุด มากกว่า และ footer มีพื้นที่เพียงพอสำหรับ default size อยู่แล้ว
- ใช้ custom class เช่น `h-10` — ซ้ำซ้อนกับ default size ของ shadcn ไม่จำเป็น

## Risks / Trade-offs

- [ปุ่ม "ขออนุมัติ" อาจดูเด่นขึ้นเล็กน้อยเพราะสูงเท่ากับ "บันทึก"] → เป็นผลที่ต้องการ เนื่องจากเป็น primary action ที่ควรสอดคล้องกับ "บันทึก"
