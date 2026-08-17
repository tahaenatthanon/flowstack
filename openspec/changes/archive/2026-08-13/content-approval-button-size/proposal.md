## Why

ปุ่ม "ขออนุมัติ" ใน footer ของ `ContentCardDialog` (เปิดจากหน้าผลงานคอนเทนต์) ใช้ `size="sm"` (ความสูง `h-9`) ในขณะที่ปุ่มอื่นใน footer เดียวกัน — "ยกเลิก", "AI เขียนให้", "บันทึก", "ลบ" — ใช้ขนาด default (`h-10`) ทำให้ปุ่มในแถวเดียวกันมีความสูงไม่เท่ากันและดูไม่สม่ำเสมอ

## What Changes

- แก้ปุ่ม "ขออนุมัติ" ใน `ContentCardDialog` footer ให้ใช้ขนาด default (ลบ `size="sm"` ออก) เพื่อให้ความสูงเท่ากับปุ่มอื่นใน footer เดียวกัน

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ -->

### Modified Capabilities

- `content-dialog-request-approval`: เปลี่ยน requirement "Button styling in ContentCardDialog footer" — ปุ่ม "ขออนุมัติ" ใช้ขนาด default (ไม่มี `size="sm"`) แทนขนาด `sm` เพื่อให้เท่ากับปุ่มอื่นใน footer

## Impact

- `src/components/content/ContentCardDialog.tsx` — ลบ `size="sm"` ออกจากปุ่ม "ขออนุมัติ" ใน `DialogFooter`
- Spec `openspec/specs/content-dialog-request-approval/spec.md` — อัปเดต requirement เรื่องขนาดปุ่ม
