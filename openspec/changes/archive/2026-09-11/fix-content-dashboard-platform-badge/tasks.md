## 1. Code Fix

- [x] 1.1 ใน `ContentDashboardPage.tsx` เพิ่ม import `PlatformBadgeList` จาก `@/components/content/PlatformBadgeList`
- [x] 1.2 แก้การ์ด "คอนเทนต์ค้างท่อ" (`aging.items.map`, ปัจจุบันประมาณบรรทัด 397-412): แทนที่ `const platform = item.platform ? PLATFORM_MAP[item.platform] : null;` และ `{platform && <Badge ...>{platform.label}</Badge>}` ด้วย `<PlatformBadgeList platforms={item.platform} variant="pill" />`
- [x] 1.3 แก้การ์ด "เนื้อหาล่าสุด" (`recentItems.map`, ปัจจุบันประมาณบรรทัด 476-500): แทนที่ `const platform = item.platform ? PLATFORM_MAP[item.platform] : null;` และการ render badge แพลตฟอร์มเดิมด้วย `<PlatformBadgeList platforms={item.platform} variant="pill" />` โดยคงตำแหน่งเดิม (อยู่บรรทัดเดียวกับ type badge, type ก่อนแพลตฟอร์ม) — คง fallback `-` เดิมไว้เมื่อไม่มีแพลตฟอร์ม (แก้ spec `content-dashboard-layout` ให้ตรงกับพฤติกรรมนี้ระหว่าง implement)
- [x] 1.4 ลบ import `PLATFORM_MAP` ออกจาก `ContentDashboardPage.tsx` ถ้าไม่มีจุดอื่นในไฟล์ใช้แล้ว (เช็คจุดที่เหลือ: `f.platform`, `s.platform`, `ch.platform` — ทั้งสามยังใช้ `PLATFORM_MAP` ต่อไปตามเดิม เพราะมาจาก `publish_channels.platform` ไม่ใช่บั๊กคลาสเดียวกัน — ยืนยันแล้วว่า import ยังต้องอยู่ ไม่ลบ)

## 2. Tests

- [x] 2.1 สร้าง `src/__tests__/content/ContentDashboardPagePlatforms.test.tsx` (mock `apiFetch`/`@/lib/api` ให้คุมข้อมูลได้): การ์ด "คอนเทนต์ค้างท่อ" กับ "เนื้อหาล่าสุด" แสดง badge แยกครบทุกแพลตฟอร์มเมื่อ item มีหลายแพลตฟอร์ม, แสดง badge เดียวเมื่อมีแพลตฟอร์มเดียว, ไม่แสดง badge ใดๆ เมื่อไม่มีแพลตฟอร์ม (5 test, ผ่านทั้งหมด)
- [x] 2.2 ยืนยันว่า 3 จุดที่ไม่แตะ (`f.platform` ของคิวล้มเหลว, `s.platform` ของกำหนดการถัดไป, `ch.platform` ของสถานะช่องทาง) ยังแสดงผลถูกต้องเหมือนเดิมหลังแก้ (ไม่มี regression) — โค้ดจุดเหล่านี้ไม่ถูกแตะต้องเลย ตรวจด้วย grep ยืนยันแล้วว่ายังใช้ `PLATFORM_MAP` ตามเดิมทุกจุด

## 3. Verification

- [x] 3.1 `pnpm exec tsc --noEmit` และ `pnpm lint` ผ่านไม่มี error (lint: 0 error, 47 warning ที่มีอยู่ก่อนแล้ว ไม่เกี่ยวกับไฟล์ที่แก้)
- [x] 3.2 `pnpm test` ผ่านทั้งหมด ไม่มี regression (38 test files, 254 tests ผ่านหมด)
- [x] 3.3 `pnpm build` ผ่านไม่มี error
- [x] 3.4 ทดสอบด้วยมือใน browser: เปิด `/content-dashboard` (แท็บ "ภาพรวม") ยืนยันว่า content item ที่มีหลายแพลตฟอร์มในการ์ด "คอนเทนต์ค้างท่อ" และ "เนื้อหาล่าสุด" แสดง badge ครบถูกต้อง ไม่มีรายการที่ดูเหมือนไม่มีแพลตฟอร์ม — ยืนยันด้วยข้อมูลจริงบน dev server (localhost:8080): "AI Governance..." ในการ์ดค้างท่อแสดง Facebook+YouTube 2 badge, "ก้าวล้ำไปอีกขั้น KTNBS..." ในการ์ดเนื้อหาล่าสุดแสดง Facebook+Line OA+Lotus Notes/Domino 3 badge, ไม่มี console error
