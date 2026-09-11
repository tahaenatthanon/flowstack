## 1. แก้ตรรกะกรองแพลตฟอร์ม

- [x] 1.1 `ContentPlannerCalendar.tsx` — import `parsePlatforms` จาก `./PlatformBadgeList` (ถ้ายังไม่ได้ import) แล้วเปลี่ยนบรรทัด `if (platformFilter !== 'all' && item.platform !== platformFilter) continue;` เป็นเช็ค `parsePlatforms(item.platforms ?? item.platform).includes(platformFilter)`
- [x] 1.2 `ContentItemList.tsx` — import `parsePlatforms` จาก `./PlatformBadgeList` แล้วเปลี่ยน `result.filter(item => item.platform === platformFilter)` เป็นเช็ค `.includes(platformFilter)` แบบเดียวกัน

## 2. Verification

- [x] 2.1 `pnpm lint` และ `tsc --noEmit` — ผู้ใช้รันเอง: 0 error ทั้งคู่ (lint 48 warning เท่าเดิม ไม่มีของใหม่จากไฟล์ที่แก้)
- [x] 2.2 `pnpm test` — เพิ่ม 4 test ใน `ContentPlannerCalendar.test.tsx` (match/ไม่ match/ไม่ถดถอย/all) และสร้างไฟล์ใหม่ `ContentItemList.test.tsx` (ไม่เคยมี test มาก่อน) อีก 4 test เคสเดียวกัน — รวม 233/233 ผ่านทั้งหมด (33 ไฟล์)
- [x] 2.3 `pnpm build` — ผู้ใช้รันเอง: สำเร็จ (คำเตือน circular chunk/chunk size เป็นของเดิม ไม่เกี่ยวกับ change นี้)
- [x] 2.4 ทดสอบ manual ในเบราว์เซอร์จริง: สร้าง/ใช้ content item ที่มีหลายแพลตฟอร์ม กดปุ่มกรองแพลตฟอร์มที่ item นั้นมี ยืนยันว่า item ปรากฏทั้งในปฏิทินและมุมมองรายการ — ผู้ใช้เช็คเองแล้ว ผ่าน
