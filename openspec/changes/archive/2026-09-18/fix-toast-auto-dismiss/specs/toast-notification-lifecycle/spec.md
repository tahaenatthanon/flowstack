## ADDED Requirements

### Requirement: Toast notification ต้องเริ่ม dismiss ภายในเวลาที่คาดเดาได้แน่นอน ไม่ว่าเมาส์ผู้ใช้จะอยู่ตรงไหน
ระบบ SHALL เริ่มกระบวนการ dismiss toast notification ภายในเวลาไม่เกิน 5000 มิลลิวินาทีหลังจาก toast ถูกสร้าง โดยกลไกนี้ SHALL ไม่ขึ้นกับตำแหน่งของเมาส์ผู้ใช้หรือ dialog/overlay อื่นที่อาจเปิดทับพื้นที่ toast viewport — กล่าวคือ toast ต้องไม่ค้างอยู่บนหน้าจอโดยไม่มีกำหนดเวลาแม้ auto-dismiss timer ภายในของ Radix UI จะถูก pause ค้างจากการที่เมาส์เคลื่อนผ่านโซน toast viewport ซ้ำๆ ก็ตาม

#### Scenario: Toast แสดงตามปกติโดยไม่มีอะไรมาทับ viewport
- **WHEN** toast notification ถูกสร้างขึ้นและไม่มีเมาส์ผู้ใช้อยู่ในโซน toast viewport
- **THEN** toast หายไปจากหน้าจอภายในประมาณ 5000 มิลลิวินาที

#### Scenario: มี dialog อื่นเปิดทับโซน toast viewport ทันทีหลัง toast ถูกสร้าง
- **WHEN** toast notification ถูกสร้างขึ้น แล้วมี dialog อื่นเปิดขึ้นมาทับพื้นที่เดียวกับ toast viewport ทำให้เมาส์ผู้ใช้เคลื่อนผ่านโซนนั้นซ้ำๆ ระหว่างใช้งาน dialog นั้น (ซึ่งทำให้ auto-dismiss timer ภายในของ Radix UI ถูก pause ค้าง)
- **THEN** toast SHALL ยังคงเริ่ม dismiss ภายในเวลาไม่เกิน 5000 มิลลิวินาทีนับจากตอนสร้าง โดยไม่ขึ้นกับการ pause นั้น

### Requirement: Toast ที่ถูก dismiss แล้วต้องถูกล้างออกจาก state ภายในเวลาสั้น
ระบบ SHALL ลบ toast ออกจาก state จริง (ไม่ใช่แค่ซ่อนด้วย CSS) ภายในเวลาไม่เกิน 1000 มิลลิวินาทีหลังจากถูก dismiss เพื่อไม่ให้ timer ค้างอยู่ในหน่วยความจำนานเกินความจำเป็น

#### Scenario: Toast ถูก dismiss แล้ว
- **WHEN** toast notification ถูก dismiss ไม่ว่าจะด้วยเหตุผลใด (auto-dismiss, ผู้ใช้กดปิด)
- **THEN** toast ถูกลบออกจาก state ภายในเวลาไม่เกิน 1000 มิลลิวินาที
