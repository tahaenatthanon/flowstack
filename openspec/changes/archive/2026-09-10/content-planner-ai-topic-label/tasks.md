## 1. Label + helper text

- [x] 1.1 แก้ `src/components/content/ContentPlannerAI.tsx`: เปลี่ยน `<Label>` ของ input หลักจาก "Trigger Command" เป็น "หัวข้อ/คำสั่งสำหรับแผน" (คง `<span className="text-destructive">*</span>` เดิมไว้)
- [x] 1.2 เพิ่ม helper text ใต้ input: "AI จะคิดหัวข้อย่อยของแต่ละโพสต์เองจากคำสั่งนี้" (สไตล์เดียวกับ helper text อื่นในไฟล์ เช่น `text-[10px] text-muted-foreground`)
- [x] 1.3 ยืนยันว่า placeholder, state (`triggerCmd`/`setTriggerCmd`), และ request field (`trigger_command`) ไม่ถูกแก้เลย

## 2. Verification

- [x] 2.1 รัน `pnpm lint` ให้ผ่าน
- [x] 2.2 รัน `pnpm test` ให้ผ่านทั้งหมด (ไม่มีการแก้ logic แต่ต้องยืนยันไม่มีอะไรพัง)
- [x] 2.3 เปิด dev server จริง ตรวจด้วยตาว่า label/helper text ใหม่แสดงถูกต้อง ไม่ wrap เกินพื้นที่ panel (`w-80`) และ "สร้างแผนด้วย AI" ยังทำงานได้ตามปกติ — ยืนยันแล้ว: label "หัวข้อ/คำสั่งสำหรับแผน *" + helper text แสดงถูกต้องไม่ wrap, พิมพ์ข้อความแล้วกด "สร้างแผนด้วย AI" ได้ผล 201 Created และ DB ยืนยัน `trigger_command` เก็บค่าที่พิมพ์ถูกต้องทุกตัวอักษร ไม่มี PHP error ใหม่
