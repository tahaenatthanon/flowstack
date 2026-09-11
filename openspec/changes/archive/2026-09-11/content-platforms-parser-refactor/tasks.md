## 1. Move parsePlatforms to src/lib/

- [x] 1.1 สร้าง `src/lib/contentPlatforms.ts` ย้าย `parsePlatforms()` มาทั้งฟังก์ชัน (พร้อม doc comment เดิม) จาก `src/components/content/PlatformBadgeList.tsx`
- [x] 1.2 แก้ `PlatformBadgeList.tsx` ให้ import `parsePlatforms` จาก `@/lib/contentPlatforms` แทนการนิยามในไฟล์เดียวกัน (component ยังใช้งานเหมือนเดิม)
- [x] 1.3 แก้ import ใน `ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx` จาก `./PlatformBadgeList` / `@/components/content/PlatformBadgeList` เป็น `@/lib/contentPlatforms` (จุดเรียกใช้ `parsePlatforms(...)` ไม่ต้องแก้)

## 2. Refactor ContentListTab

- [x] 2.1 แก้ body ของ `getItemPlatforms()` ใน `ContentListTab.tsx` ให้เป็น `(item) => parsePlatforms(item.platforms ?? item.platform)` เรียก `parsePlatforms` จาก `@/lib/contentPlatforms` แทนตรรกะ parse ที่เขียนเอง — คงชื่อฟังก์ชันและ signature เดิม ไม่แก้จุดเรียกใช้ทั้ง 3 จุด (platformCounts, filtered, render loop ไอคอน)

## 3. Move & add tests

- [x] 3.1 สร้าง `src/lib/__tests__/contentPlatforms.test.ts` (แก้จาก path เดิมที่ระบุผิดใน proposal เป็น `src/__tests__/lib/...` — ตรวจแล้วว่า convention จริงของ repo คือ colocate ใต้ `src/lib/__tests__/` เหมือน `projectUtils.test.ts`/`scoring.test.ts`) ย้าย describe block "parsePlatforms" (6 tests) จาก `src/__tests__/content/PlatformBadgeList.test.tsx` มาไว้ที่นี่ แก้ import เป็น `@/lib/contentPlatforms`
- [x] 3.2 ลบ describe block "parsePlatforms" ออกจาก `src/__tests__/content/PlatformBadgeList.test.tsx` เหลือเฉพาะ describe block ของ component `PlatformBadgeList`
- [x] 3.3 เพิ่ม characterization test ให้ `ContentListTab.tsx` ครอบคลุม: platform chip counts นับถูกต้องสำหรับ item หลายแพลตฟอร์ม (นับแยกทีละแพลตฟอร์ม ไม่นับเป็นก้อนเดียว), กรองด้วย platformFilter เจอ item หลายแพลตฟอร์มที่มีแพลตฟอร์มนั้นอยู่, render loop แสดงไอคอนครบทุกแพลตฟอร์มของ item (ไม่ตัดทอน) — สร้างไฟล์ใหม่ `src/__tests__/content/ContentListTabPlatformChips.test.tsx` (3 tests)

## 4. Verification

- [x] 4.1 `pnpm exec tsc --noEmit` และ `pnpm lint` ผ่านไม่มี error (ยืนยันไม่มี import ค้างที่ path เดิม) — lint warning ลดลง 1 จุดด้วย (react-refresh warning ของ PlatformBadgeList.tsx ที่เคย co-export ฟังก์ชันหายไปพร้อมกับการย้าย parsePlatforms ออก)
- [x] 4.2 `pnpm test` ผ่านทั้งหมด ไม่มี regression — test เดิมทุกตัวต้องผ่านเหมือนเดิม บวก test ใหม่จาก 3.1 และ 3.3 — ผลจริง: 37 test files, 245 tests, ผ่านทั้งหมด
- [x] 4.3 `pnpm build` ผ่านไม่มี error
- [x] 4.4 ทดสอบด้วยมือใน browser: เปิดหน้า `/content` แท็บ "ผลงานทั้งหมด" (ContentListTab) ด้วยข้อมูลจริงใน DB — **พบ regression จริง**: content item เก่า 1 รายการ (`platform="facebook,youtube"`, `platforms=NULL`) แสดงเป็น chip รวม "facebook,youtube: 1" ใน platform toolbar แทนที่จะแยกเป็น Facebook/YouTube (สาเหตุ: SQL fallback ห่อ `platform` เป็น JSON array element เดียว ดู design.md) แก้โดยเพิ่ม `.flatMap(p => String(p).split(','))` ใน `parsePlatforms()` (`src/lib/contentPlatforms.ts`) เพิ่ม regression test ใน `src/lib/__tests__/contentPlatforms.test.ts` แล้วรัน 4.1-4.3 ซ้ำผ่านหมด (246 tests) ทดสอบ browser ซ้ำยืนยันแล้วว่า chip แยกถูกต้อง (Facebook 39, YouTube 3) ไม่มี console error
