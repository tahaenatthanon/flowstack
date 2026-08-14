## 1. Implementation

- [x] 1.1 สลับลำดับ block `{/* Channels */}` กับ `{/* Platform Distribution */}` ใน `src/pages/ContentDashboardPage.tsx` ให้ "แพลตฟอร์ม" อยู่ก่อน "สถานะช่องทาง"

## 2. Verification

- [x] 2.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่านโดยไม่มี error
- [x] 2.2 ตรวจบนเบราว์เซอร์ว่าลำดับ widget เป็น กำหนดการโพสต์ถัดไป → แพลตฟอร์ม → สถานะช่องทาง

## 3. Platform Icon

- [x] 3.1 เพิ่ม case `youtube` ใน `src/components/content/PlatformIcon.tsx`
- [x] 3.2 เพิ่ม `youtube` ใน `PLATFORM_MAP` (`src/components/content/types.ts`) และ `PLATFORM_COLORS`/`PLATFORM_LABELS` (`src/lib/platformConfig.ts`)
- [x] 3.3 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน และตรวจว่า widget "แพลตฟอร์ม" แสดงไอคอน YouTube ถูกต้อง
