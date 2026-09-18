## Context

`PullFromContentDialog.tsx` เพิ่งถูกแก้ใน change `pull-content-dialog-filters` (archived) เพื่อเพิ่มตัวกรอง 3 มิติ ระหว่างใช้งานจริงพบ 2 บั๊ก layout ที่ root cause อยู่คนละจุดกัน แต่ทั้งคู่เป็นปัญหา flexbox ล้วนๆ ไม่มี logic เปลี่ยนแปลง จึงไม่จำเป็นต้องมี design ที่ซับซ้อน — เอกสารนี้บันทึกเหตุผลของตัวเลือกที่เลือกไว้สั้นๆ เพื่อให้ tasks.md อ้างอิงได้

## Goals / Non-Goals

**Goals:**
- แถวตัวกรอง (ประเภท/สถานะ/แพลตฟอร์ม) ให้ label อยู่บรรทัดเดียวกับ pill แถวแรกเสมอ ไม่ว่าจะมี pill กี่ตัว
- แถวหัวข้อของการ์ดคอนเทนต์ในรายการต้องไม่ล้นกรอบแนวนอนไม่ว่าคอนเทนต์จะมีกี่แพลตฟอร์ม

**Non-Goals:**
- ไม่เปลี่ยน logic การกรอง (`filtered`, `toggleStatus`, ฯลฯ) — แก้เฉพาะ JSX/className
- ไม่แตะ `PlatformBadgeList.tsx`, `ContentCardDialog.tsx`, `ContentDetailView.tsx` (เป็นแค่ reference pattern)
- ไม่แก้ไฟล์อื่นนอกจาก `PullFromContentDialog.tsx`

## Decisions

### Bug A — เอา `flex-wrap` ออกจาก container นอกของแถวตัวกรอง
Container นอกแต่ละแถวมี `flex flex-wrap gap-1.5 items-center` ครอบ label + กล่อง pill (ซึ่งมี `flex gap-1 flex-wrap` ของตัวเองอยู่แล้ว) เมื่อ container นอกก็ `flex-wrap` ด้วย เบราว์เซอร์ปฏิบัติต่อกล่อง pill ทั้งกล่องเป็นหนึ่ง flex item ที่ตกบรรทัดไปทั้งก้อนเมื่อพื้นที่ไม่พอ (label ไปอยู่บรรทัดเดียว กล่อง pill ทั้งกล่องไปอีกบรรทัด)

**ทางเลือก:** ตัด `flex-wrap` ออกจาก container นอก → เหลือ `flex items-center gap-1.5` เท่านั้น label (`shrink-0`) ตรึงอยู่ต้นแถวเสมอ ส่วนกล่อง pill ชั้นในหดพื้นที่ตัวเองและใช้ `flex-wrap` ของตัวเองตกบรรทัด pill ที่ล้นไปบรรทัดถัดไป โดยไม่ดึง label ตามไปด้วย — ไม่ต้องเปลี่ยนโครงสร้าง JSX เลย แก้แค่ className เดียว ทำซ้ำ 3 จุด (ประเภท/สถานะ/แพลตฟอร์ม)

**ทางเลือกอื่นที่พิจารณาแล้วไม่เลือก:** ใส่ `flex-basis`/`min-width` ให้ label — ซับซ้อนเกินไปสำหรับปัญหานี้ เพราะ root cause คือ nested-wrap ไม่ใช่ขนาด label

### Bug B — ย้าย `PlatformBadgeList` ออกจากแถวหัวข้อการ์ด ไปเป็นแถวแยก ("Option A")
แถวหัวข้อการ์ด (`flex items-center gap-2`, ไม่มี `flex-wrap`) มี icon ประเภท + ชื่อเรื่อง (`flex-1 truncate`) + icon ตา + `PlatformBadgeList` (`shrink-0`) เมื่อคอนเทนต์มีหลายแพลตฟอร์ม (พบจริงถึง 8-11 รายการ) badge ที่ถูกบังคับ `shrink-0` ผลักความกว้างรวมเกินการ์ด

พิจารณา 2 ทางเลือก (เทียบผ่าน mockup กับ user แล้ว):
- **Option A (เลือก):** ย้าย badge ออกเป็น `<div>` แยกใต้แถวหัวข้อ — ตรงกับ pattern ที่ `ContentCardDialog.tsx` ใช้อยู่แล้วในบริบทเดียวกัน (title/description แยกจาก badge row) แถวหัวข้อเหลือแค่ icon+title+eye จึงไม่มีการแย่งพื้นที่กับ badge เลย คาดเดา layout ได้ง่ายกว่า
- **Option D (ไม่เลือก):** ใส่ `flex-wrap` ในแถวเดียวกัน (แบบ `ContentDetailView.tsx`) — ใช้ได้ แต่แถวนี้มีองค์ประกอบแย่งพื้นที่มากกว่า (icon ประเภท + title flex-1 + eye icon) ทำให้ตำแหน่ง badge ตกบรรทัดแรกเทียบกับบรรทัดถัดไปดูไม่สม่ำเสมอ (บาง item badge ต่อท้าย title ได้ 1-2 ตัวก่อนตก บาง item ตกทันที)

User ยืนยันเลือก Option A แล้ว

## Risks / Trade-offs

- [ผลข้างเคียง] การย้าย badge เป็นแถวแยกทำให้การ์ดคอนเทนต์ (ที่มี platform เยอะ) สูงขึ้นเล็กน้อย → ยอมรับได้ เพราะป้องกันการล้นกรอบซึ่งเสียหายกว่า
- [ความสม่ำเสมอ] การ์ดที่ไม่มี platform เลย (`platforms` ว่าง) ต้องไม่เห็นแถวว่างเปล่า → mitigation: ครอบด้วยเงื่อนไข `platforms.length > 0` เหมือนที่ `ContentCardDialog.tsx` ทำอยู่แล้ว
