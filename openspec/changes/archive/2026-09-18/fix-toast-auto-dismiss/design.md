## Context

`useToast`/`toast()` ใน `src/hooks/use-toast.ts` เป็น port ของ shadcn-ui's toast hook ที่ใช้ Radix UI Toast (`@radix-ui/react-toast`) เป็นฐาน ตรวจสอบ source ของ `@radix-ui/react-toast` (`node_modules/@radix-ui/react-toast/dist/index.mjs`) โดยตรงพบกลไกที่ชัดเจน:

- `ToastViewport`'s wrapper ผูก listener `pointermove` (และ `focusin`, `window.blur`) ไว้ที่ตัว wrapper **ทั้งกล่อง** — ไม่ใช่แค่การ์ด toast แต่ละใบ (`node_modules/@radix-ui/react-toast/dist/index.mjs:95-119`) ทุกครั้งที่เมาส์ขยับอยู่ในโซนนี้จะ dispatch `VIEWPORT_PAUSE` ให้ toast ทุกใบหยุด timer พร้อมกัน และ resume ก็ต่อเมื่อเมาส์ออกจากทั้ง viewport (`pointerleave`) เท่านั้น
- `ToastImpl`'s auto-close timer (`startTimer`, บรรทัด ~313-330) ถูกเรียกใหม่จาก `handleResume`/`handlePause` เท่านั้น — ไม่มี timer อื่นใดที่ทำงานอิสระจากกลไกนี้
- `dismiss()` ใน `use-toast.ts` (บรรทัด 145) ถูกเรียกได้ทางเดียวคือผ่าน `onOpenChange(false)` ที่ Radix เรียกมาจาก `handleClose` ซึ่งมาจาก timer ข้างต้นเท่านั้น

เนื่องจาก `ToastViewport` วางตำแหน่งมุมขวาล่าง (`sm:bottom-0 sm:right-0 md:max-w-[420px]`) และเมื่อผู้ใช้เลือกคอนเทนต์ใน `PullFromContentDialog` แล้ว dialog ใหม่ ("สร้างแคมเปญใหม่") จะเปิดทับพื้นที่หน้าจอส่วนใหญ่ทันที การขยับเมาส์ตามปกติของผู้ใช้ในฟอร์มนั้น (เลื่อนดู field, เลือก template) มีโอกาสสูงที่จะกวาดผ่านโซน viewport ซ้ำๆ ทำให้ auto-dismiss timer ไม่เคยเดินจบเลย — สรุปคือ **ไม่มี path ใดที่รับประกันว่า toast จะหายภายในเวลาที่กำหนดแน่นอน** เพราะทุก path ที่มีอยู่ล้วนขึ้นกับกลไก pause ของ Radix ทั้งสิ้น

`TOAST_REMOVE_DELAY = 1000000` (ค่า placeholder จาก shadcn-ui boilerplate ต้นฉบับ) เป็นปัญหาซ้อนอีกชั้น แต่การแก้แค่ค่านี้อย่างเดียว **ไม่เพียงพอ** เพราะ `addToRemoveQueue` ที่ใช้ค่านี้ถูกเรียกจาก `DISMISS_TOAST` ซึ่งก็ยังต้องรอ `dismiss()` ถูกเรียกก่อนอยู่ดี — ติดปัญหาเดียวกัน

## Goals / Non-Goals

**Goals:**
- รับประกันว่า toast notification ทุกจุดในระบบจะเริ่มกระบวนการ dismiss ภายในเวลาที่แน่นอน (5 วินาที) โดยไม่ขึ้นกับตำแหน่งเมาส์ของผู้ใช้หรือ dialog อื่นที่เปิดทับ

**Non-Goals:**
- ไม่เปลี่ยนพฤติกรรม pause-on-hover ของ Radix เอง (ยังคงมีประโยชน์ในกรณีที่ผู้ใช้ตั้งใจ hover อ่าน toast จริงๆ โดยไม่มี dialog อื่นมาทับ)
- ไม่เปลี่ยน `TOAST_LIMIT`, ตำแหน่ง/สไตล์ของ `ToastViewport`, หรือ logic การ dispatch/reducer อื่นๆ
- ไม่แก้ที่ `PullFromContentDialog.tsx` หรือจุดเรียก `toast()` อื่นใดเป็นรายจุด — แก้ที่ hook กลางจุดเดียว

## Decisions

**เพิ่ม timer อิสระใน `toast()` ที่เรียก `dismiss()` ตรงๆ หลังผ่านไป 5000ms** — ไม่ผูกกับ Radix's viewport pause mechanism เลย เป็น `setTimeout` ธรรมดาที่เริ่มทันทีตอน `toast()` ถูกเรียก (พร้อมกับ `ADD_TOAST`) เมื่อครบเวลาจะเรียก `dismiss()` โดยตรง (เหมือนผู้ใช้กดปิดเอง) ผลคือ:
- ในกรณีปกติ (ไม่มีอะไรมาทับ viewport): Radix's own timer (5000ms เช่นกัน) กับ timer อิสระนี้จะทำงานพร้อมกันโดยประมาณ ตัวที่ถึงก่อนจะ dismiss ก่อน (ซ้ำซ้อนกันแต่ไม่มีผลเสีย เพราะ `dismiss()` เรียกซ้ำบน toast ที่ปิดไปแล้วเป็น no-op)
- ในกรณีที่ Radix's timer ถูก pause ค้าง (เช่น dialog อื่นทับ viewport): timer อิสระนี้ยังคงเดินต่อไม่หยุด รับประกันว่า toast จะเริ่ม dismiss ภายใน 5 วินาทีเสมอ

**ทางเลือกอื่นที่พิจารณาแล้วไม่เลือก**:
- *ลด `TOAST_REMOVE_DELAY` อย่างเดียว* — ไม่เลือกเพราะพิสูจน์แล้วว่าไม่แก้ root cause จริง (ดู Context) `dismiss()` ยังต้องพึ่ง Radix's pausable timer อยู่ดี
- *ย้ายตำแหน่ง `ToastViewport` ไม่ให้ทับกับ dialog* — ไม่เลือกเพราะแก้ได้แค่กรณีนี้กรณีเดียว ยังมี dialog/overlay อื่นในระบบที่อาจทับ viewport ได้เหมือนกันในอนาคต ไม่ใช่การแก้ที่ root cause
- *ปิด pause-on-hover ของ Radix ทั้งหมด* — ไม่เลือกเพราะ Radix ไม่มี prop เปิด/ปิดพฤติกรรมนี้ตรงๆ (ต้อง implement toast ใหม่เองทั้งหมด) และพฤติกรรม pause ยังมีประโยชน์ในกรณีผู้ใช้ hover อ่านจริงๆ จึงเก็บไว้ แค่เพิ่ม guaranteed fallback ควบคู่กัน

**ลดค่า `TOAST_REMOVE_DELAY` จาก `1000000` เป็น `1000`** — เป็นการแก้เสริม (ไม่ใช่ fix หลัก) ให้ state cleanup หลัง `dismiss()` เกิดขึ้นเร็วพอ (1 วินาที เพียงพอให้ CSS close-animation เล่นจบ) แทนที่จะค้าง timer ไว้ใน `toastTimeouts` Map นาน 16.7 นาทีโดยไม่จำเป็น

## Risks / Trade-offs

- [Toast dismiss เร็วกว่าที่ผู้ใช้ต้องการอ่าน] ถ้าผู้ใช้ hover อ่าน toast จริงๆ (ไม่มี dialog มาทับ) timer อิสระ 5000ms จะยังคงเดินไปเรื่อยๆ แม้ Radix's timer จะ pause ไว้ให้อ่านต่อ → Mitigation: 5000ms เป็นเวลาที่เพียงพอสำหรับอ่านข้อความสั้นๆ แบบ toast ทั่วไปอยู่แล้ว (เท่ากับ Radix default เดิม) และเนื้อหา toast ในระบบนี้ล้วนเป็นข้อความสั้น ไม่ใช่เนื้อหาที่ต้องอ่านนาน
- [ผลกระทบวงกว้าง] `use-toast.ts` เป็น hook กลางที่ทุก toast ในระบบใช้ร่วมกัน → Mitigation: ไม่มีจุดใดในระบบที่พึ่งพาพฤติกรรม "toast ค้างได้ไม่จำกัดเวลาเมื่อ hover" เป็น intended behavior จึงไม่มี regression ที่คาดว่าจะเกิด
