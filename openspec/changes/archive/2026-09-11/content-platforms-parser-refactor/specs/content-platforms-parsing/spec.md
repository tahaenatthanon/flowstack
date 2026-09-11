## ADDED Requirements

### Requirement: มี implementation เดียวสำหรับ parse ค่า platform ของ content item
ระบบ SHALL มี implementation เดียวที่เป็น canonical สำหรับ parse ค่า `content_items.platform`/`platforms` (comma-joined string หรือ JSON array string หรือ array ที่ parse แล้ว) ให้เป็น array แพลตฟอร์มแยกทีละอัน lowercase ไม่ซ้ำ ไม่มีค่าว่าง — implementation นี้อยู่ที่ `src/lib/contentPlatforms.ts` เท่านั้น ห้ามมีการเขียนตรรกะ parse ค่านี้ซ้ำที่ไฟล์อื่น

#### Scenario: ทุกจุดที่ต้องใช้รายการแพลตฟอร์มของ content item เรียกใช้ implementation เดียวกัน
- **WHEN** component หรือ tab ใดๆ ในหน้าคอนเทนต์ต้องการรายการแพลตฟอร์มที่ parse แล้วของ content item
- **THEN** component นั้น import `parsePlatforms` จาก `@/lib/contentPlatforms` โดยตรง หรือเรียกผ่าน wrapper ที่เรียก `parsePlatforms` จาก `@/lib/contentPlatforms` ภายใน — ไม่มีการ reimplement ตรรกะ parse เอง

#### Scenario: ไม่มีตรรกะ parse ซ้ำใน ContentListTab
- **WHEN** `ContentListTab.tsx` ต้องการรายการแพลตฟอร์มของ content item ผ่าน `getItemPlatforms(item)`
- **THEN** `getItemPlatforms` เรียก `parsePlatforms(item.platforms ?? item.platform)` จาก `@/lib/contentPlatforms` ภายใน ไม่มีตรรกะแยกวิเคราะห์ comma/JSON ของตัวเองอีกต่อไป

#### Scenario: พฤติกรรมการ parse ไม่เปลี่ยนแปลงหลัง refactor
- **WHEN** content item มีค่า `platform`/`platforms` ในรูปแบบใดๆ ที่เคย parse ถูกต้องอยู่แล้วก่อนหน้านี้ (comma-joined string, JSON array string, array ที่ parse แล้ว, ไม่มีแพลตฟอร์มเลย)
- **THEN** ผลลัพธ์การ parse เหมือนเดิมทุกประการทั้งใน `ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx`, `PlatformBadgeList.tsx`, และ `ContentListTab.tsx`

#### Scenario: split element ที่เป็น comma-joined ซ้อนอยู่ใน array อีกชั้น
- **WHEN** content item เก่าที่ `platforms` เป็น NULL/ว่าง แต่ `platform` เป็น comma-joined (เช่น `"facebook,youtube"`) ทำให้ API ห่อค่าเป็น JSON array ที่มี element เดียวคือสตริงนั้นทั้งก้อน (เช่น `["facebook,youtube"]`)
- **THEN** `parsePlatforms()` SHALL แยกเป็นแพลตฟอร์มเดี่ยวแต่ละอันถูกต้อง (`["facebook", "youtube"]`) ไม่ใช่เก็บไว้เป็นค่ารวมก้อนเดียว — ทุกจุดที่เรียกใช้ (รวมถึง `ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx` ที่เคยมีบั๊กแฝงนี้อยู่ก่อนแล้ว) ได้รับการแก้ไปพร้อมกันเพราะใช้ implementation เดียวกัน
