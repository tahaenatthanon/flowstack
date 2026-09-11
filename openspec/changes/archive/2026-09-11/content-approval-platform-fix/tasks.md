## 1. Code Fix

- [x] 1.1 แก้ filter predicate ใน `ContentApprovalTab.tsx` ให้ใช้ `parsePlatforms(item.platforms ?? item.platform).includes(platformFilter)` แทน `item.platform === platformFilter` (import `parsePlatforms` จาก `./PlatformBadgeList`)
- [x] 1.2 แก้ที่มาของ `usedPlatforms` ให้ `flatMap` แพลตฟอร์มที่ parse แล้วของทุก item ก่อนเข้า `Set` แทนการ `map(i => i.platform)` ตรงๆ
- [x] 1.3 แก้การแสดงผลคอลัมน์ "แพลตฟอร์ม" ในตาราง ให้ parse แพลตฟอร์มของ item แล้วแสดง badge ของแพลตฟอร์มแรก + ป้าย `+N` เมื่อมีมากกว่า 1 แพลตฟอร์ม, badge เดียวเมื่อมี 1 แพลตฟอร์ม, และ `-` เมื่อไม่มีแพลตฟอร์มเลย (คงพื้นที่แถวเดิม)

## 2. Verification

- [x] 2.1 `pnpm exec tsc --noEmit` และ `pnpm lint` ผ่านไม่มี error
- [x] 2.2 เพิ่ม/รัน test ครอบคลุม: item หลายแพลตฟอร์มถูกกรองเจอ, item ไม่มีแพลตฟอร์มที่กรองถูกซ่อน, dropdown แยกตัวเลือกแพลตฟอร์มจาก item หลายแพลตฟอร์ม, คอลัมน์ตารางแสดง badge แรก+`+N` ถูกต้อง — `pnpm test` ผ่านทั้งหมด (ไม่มี regression)
- [x] 2.3 `pnpm build` ผ่านไม่มี error
- [x] 2.4 ทดสอบด้วยมือใน browser: เปิด Tab "รายการอนุมัติ", สร้าง/ตรวจ content item ที่มีหลายแพลตฟอร์ม, ยืนยันว่า filter, dropdown ตัวเลือก, และคอลัมน์ตารางแสดงผลถูกต้องตามที่ระบุใน specs — ทดสอบกับข้อมูลจริงใน DB (item หลายแพลตฟอร์ม เช่น facebook,lineoa,lotusdomino): คอลัมน์แสดง "Facebook +2" ถูกต้อง, dropdown แยกตัวเลือกเป็นรายแพลตฟอร์มไม่โชว์ค่าดิบรวม, กรองด้วย "Line OA"/"LinkedIn" เจอ item ที่มีแพลตฟอร์มนั้นซ่อนอยู่ (ไม่ใช่แค่ badge แรกที่โชว์) ถูกต้อง ไม่มี console error
