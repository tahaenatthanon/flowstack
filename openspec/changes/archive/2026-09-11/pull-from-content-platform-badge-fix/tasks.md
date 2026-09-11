## 1. Code Fix

- [x] 1.1 แก้ `PullFromContentDialog.tsx` ให้ import `PlatformBadgeList` จาก `@/components/content/PlatformBadgeList` แทนการเขียน `<span>` + `PLATFORM_MAP[item.platform]` เอง — ใช้ `<PlatformBadgeList platforms={item.platforms ?? item.platform} variant="pill" size={10} />`
- [x] 1.2 ลบ import `PLATFORM_MAP` ที่ไม่ได้ใช้แล้วออกจาก `PullFromContentDialog.tsx` (ถ้าไม่มีที่ใช้อื่นเหลืออยู่)

## 2. Tests

- [x] 2.1 เพิ่ม test ใน `src/__tests__/content/PullFromContentDialog.test.tsx`: item ที่มีหลายแพลตฟอร์มแสดง badge แยกครบทุกอัน, item ที่มีแพลตฟอร์มเดียวแสดง badge เดียว, item ที่ไม่มีแพลตฟอร์มไม่แสดง badge ใดๆ (mock `apiFetch`/`@/lib/api` ให้คืนรายการ content item ที่ควบคุมได้) — เพิ่ม 3 tests ผ่านหมด

## 3. Verification

- [x] 3.1 `pnpm exec tsc --noEmit` และ `pnpm lint` ผ่านไม่มี error
- [x] 3.2 `pnpm test` ผ่านทั้งหมด ไม่มี regression — ผลจริง: 37 test files, 249 tests, ผ่านทั้งหมด
- [x] 3.3 `pnpm build` ผ่านไม่มี error
- [x] 3.4 ทดสอบด้วยมือใน browser: เปิดหน้าที่ใช้ `PullFromContentDialog` (MarketingPage หรือ CampaignsPage) ยืนยันว่า content item ที่มีหลายแพลตฟอร์มแสดง badge ครบถูกต้อง ไม่มี badge ว่างเปล่า — ทดสอบกับข้อมูลจริงใน DB ผ่าน `/marketing` → "ดึงคอนเทนท์": item 3 แพลตฟอร์ม (facebook,lineoa,lotusdomino) แสดง badge ครบ 3 อัน, item 4 แพลตฟอร์ม แสดงครบ 4 อัน ไม่มี badge ว่างเปล่า ไม่มี console error
