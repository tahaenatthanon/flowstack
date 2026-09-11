## Why

ตรรกะ parse ค่า `content_items.platform`/`platforms` (comma-joined string หรือ JSON array → array แยกทีละแพลตฟอร์ม lowercase ไม่ซ้ำ) มีอยู่ 2 ที่ในโค้ด: `parsePlatforms()` ใน `src/components/content/PlatformBadgeList.tsx` (ใช้โดย `ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx`) และ `getItemPlatforms()` ส่วนตัวใน `src/components/content/tabs/ContentListTab.tsx` ที่เขียนตรรกะเดียวกันซ้ำเองเกือบทั้งหมด — เป็น duplicate logic ที่ค้นพบระหว่างสำรวจบั๊กตัวกรองแพลตฟอร์ม (ดู `openspec/changes/archive/2026-09-11/content-planner-platform-filter-fix/` และ `openspec/changes/archive/2026-09-11/content-approval-platform-fix/`) ผู้ใช้ตัดสินใจแยกงาน refactor นี้ออกจากงานแก้บั๊กทั้งสองครั้งเพื่อไม่ให้ scope ปนกัน ตอนนี้บั๊กทั้งสองจุดถูกแก้และ archive แล้ว จึงถึงเวลาทำ refactor นี้แยกต่างหาก: รวม parse logic ให้เหลือจุดเดียวใน `src/lib/` (ตาม CLAUDE.md ที่กำหนดให้ `src/lib/` เป็นที่เก็บ business logic/utilities) เพื่อไม่ให้โค้ดสองจุดดริฟท์ออกจากกันได้อีกในอนาคต

## What Changes

- สร้าง `src/lib/contentPlatforms.ts` เป็นที่อยู่ใหม่ของ `parsePlatforms()` (ย้ายจาก `PlatformBadgeList.tsx` มาทั้งหมด ไม่ใช่แค่ re-export)
- อัปเดต `PlatformBadgeList.tsx` และผู้ import เดิมทั้ง 3 ไฟล์ (`ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx`) ให้ import `parsePlatforms` จาก `@/lib/contentPlatforms` แทน `./PlatformBadgeList`
- แก้ `getItemPlatforms()` ใน `ContentListTab.tsx` ให้เป็น thin wrapper เรียก `parsePlatforms(item.platforms ?? item.platform)` แทนการเขียนตรรกะ parse ซ้ำเอง — คงชื่อฟังก์ชันและ signature เดิม (`(item: ContentItem) => string[]`) ไว้ ไม่แก้จุดเรียกใช้ทั้ง 3 จุด (platformCounts, filtered, render loop ไอคอน)
- ย้าย test ของ `parsePlatforms()` (describe block "parsePlatforms" ใน `src/__tests__/content/PlatformBadgeList.test.tsx`) ไปที่ `src/lib/__tests__/contentPlatforms.test.ts` — test ของ `PlatformBadgeList` component เดิมอยู่ที่เดิม
- เพิ่ม characterization test ให้ `ContentListTab.tsx` ครอบคลุม platform chip counts และการกรองด้วยแพลตฟอร์มของ item หลายแพลตฟอร์ม (จุดที่ไม่เคยมี test คลุมมาก่อน) เพื่อล็อกพฤติกรรมไว้ก่อน/หลัง refactor
- **ไม่มีการเปลี่ยนแปลง behavior ที่ผู้ใช้เห็น** — เป็น pure refactor ล้วนๆ (ตรวจแล้วว่าความต่างเล็กน้อยระหว่าง `parsePlatforms()` กับ `getItemPlatforms()` เดิม เช่น การ fallback เมื่อ `platforms` เป็นสตริงที่ไม่ใช่ JSON เป็น unreachable code เพราะ `api/content-items.php` เขียนค่า `platforms` เป็น JSON-array string ที่สะอาดเสมอ ดู design.md)

## Capabilities

### New Capabilities
- `content-platforms-parsing`: กำหนดว่าการ parse ค่า `content_items.platform`/`platforms` ให้เป็น array แพลตฟอร์มต้องมี implementation เดียวที่เป็น canonical ใน `src/lib/` และผู้ใช้ทุกจุดต้องเรียกใช้ implementation นี้ ห้ามเขียนตรรกะ parse ซ้ำเอง — เป็น requirement เชิงสถาปัตยกรรม/ป้องกันบั๊ก ไม่ใช่ behavior ที่ผู้ใช้เห็นโดยตรง แต่เป็นสาเหตุหลักที่ทำให้เกิดบั๊กคลาสเดียวกันซ้ำๆ ในอดีต (ดู `content-planner-platform-filter-fix`, `content-approval-platform-fix`) จึงควรมี spec ติดตามไว้เพื่อป้องกัน regression ในอนาคต

### Modified Capabilities
(ไม่มี — ไม่มี spec-level behavior ของ requirement เดิมที่เปลี่ยนแปลง)

## Impact

- `src/lib/contentPlatforms.ts` (ใหม่)
- `src/components/content/PlatformBadgeList.tsx` (แก้ import)
- `src/components/content/ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx` (แก้ import path เท่านั้น จุดเรียกใช้ไม่เปลี่ยน)
- `src/components/content/tabs/ContentListTab.tsx` (แก้ body ของ `getItemPlatforms()` เท่านั้น)
- `src/__tests__/content/PlatformBadgeList.test.tsx` (ตัด describe block "parsePlatforms" ออก)
- `src/lib/__tests__/contentPlatforms.test.ts` (ใหม่ — ย้าย test มาจากไฟล์ข้างต้น)
- test ใหม่สำหรับ `ContentListTab.tsx` platform chips/filter (ไฟล์เดิมหรือไฟล์ใหม่ ตัดสินใจตอน apply)
- ไม่มีการเปลี่ยน schema ฐานข้อมูลหรือ API
