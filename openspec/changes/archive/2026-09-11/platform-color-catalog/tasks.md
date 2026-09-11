## 1. Data layer — single catalog

- [x] 1.1 ใน `src/lib/platformConfig.ts` เพิ่ม `PLATFORM_CATALOG: Record<string, { label: string; hex: { bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }; colorClass: string }>` รวมทุกแพลตฟอร์มที่มีอยู่ในทั้ง `PLATFORM_MAP` (types.ts) และ `PLATFORM_COLORS` (platformConfig.ts) ปัจจุบัน (facebook, instagram, tiktok, lineoa, linkedin, twitter, wordpress, wix, custom, lotusdomino, youtube) — ใช้ hue เดียวกับ `PLATFORM_MAP`'s Tailwind class เป็นฐาน (ใกล้เคียงกับ `getPlatformColors()` เดิมอยู่แล้ว) เพื่อลด visual diff
- [x] 1.2 เขียน `getPlatformColors(platform)` ใหม่ให้ดึงจาก `PLATFORM_CATALOG` (คง signature/shape เดิม `{bg, text, border, filterBg, filterText}` เพื่อไม่ต้องแก้ผู้เรียกเดิม 6 ไฟล์) พร้อมเพิ่มคู่ dark-mode ในผลลัพธ์
- [x] 1.3 เพิ่ม `getPlatformColorClass(platform): string` และ `getPlatformLabel(platform): string` เป็น export ใหม่จาก `platformConfig.ts`
- [x] 1.4 ใน `src/components/content/types.ts` เปลี่ยน `PLATFORM_MAP` จาก object ตรงๆ เป็นค่าที่ derive จาก `PLATFORM_CATALOG` (import จาก `@/lib/platformConfig`) — คง shape `{label, color}` เดิมทุกประการ ไม่ให้ผู้ import เดิมพัง

## 2. Data layer — ยุบ map ซ้ำซ้อน

- [x] 2.1 ใน `src/components/content/AnalyticsSocialTab.tsx` ลบ `PLATFORM_LABELS` local แล้วเปลี่ยน `platformLabel()` ให้เรียก `getPlatformLabel()` จาก `platformConfig.ts` แทน
- [x] 2.2 ยืนยันว่า `src/components/content/views/ContentVideoView.tsx`'s `PLATFORM_COLORS` **ไม่ถูกแก้** (คงไว้ตามเดิมโดยเจตนา — ใส่ comment สั้นๆ อธิบายเหตุผลถ้ายังไม่มี)

## 3. UI layer — component กลาง

- [x] 3.1 สร้าง `src/components/content/PlatformBadgeList.tsx` export component รับ props `{ platforms: string[]; variant: 'pill' | 'icon-only'; size?: number }` — ทำ normalize/dedupe/lowercase ของ `platforms` array ภายใน (ย้าย logic parse จาก `ContentDetailView.tsx:286-292` มาไว้ที่นี่ เป็น `parsePlatforms()` export แยกด้วยเผื่อที่อื่นอยากใช้)
- [x] 3.2 `variant="pill"` render `<PlatformIcon>` + `<span>` label สี ต่อแพลตฟอร์ม (สไตล์อ้างอิง `ContentDetailView.tsx:293-296` เดิม) ไม่ตัดทอนจำนวน
- [x] 3.3 `variant="icon-only"` render เฉพาะ `<PlatformIcon>` สีต่อแพลตฟอร์ม ไม่มี label, ระยะห่างแคบกว่า, ใช้ `flex-wrap` รองรับกรณีมีหลายไอคอนในพื้นที่แคบ

## 4. UI layer — แก้ 3 จุดที่พัง

- [x] 4.1 `ContentCardDialog.tsx:543-551` — แทนที่ `<Badge>` เดี่ยวที่ใช้ `existingItem.platform` ด้วย `<PlatformBadgeList platforms={platforms} variant="pill" />` (ใช้ `platforms` state ที่ parse ไว้ถูกต้องอยู่แล้วในไฟล์นี้ — ไม่ต้อง parse ซ้ำ)
- [x] 4.2 `ContentPlannerCalendar.tsx` (`renderItemChip`) — แทนที่ `PlatformIcon platform={item.platform}` เดี่ยวด้วย parse `item.platforms`/`item.platform` แล้ว render `<PlatformBadgeList variant="icon-only" size={10} />`; อัปเดต `getPlatformColors(item.platform)` ที่ใช้กำหนดพื้นหลัง/สี chip ให้ใช้แพลตฟอร์มแรกที่ parse ได้แทนสตริงรวม (เพื่อให้พื้นหลัง chip ยังมีสีความหมาย ไม่ใช่สีเทา default)
- [x] 4.3 `ContentItemList.tsx:129,160-163` — แทนที่ `PLATFORM_MAP[item.platform || '']` เดี่ยวด้วย parse แพลตฟอร์มแล้ว render `<PlatformBadgeList variant="icon-only" />` ในคอลัมน์แพลตฟอร์ม; ตรวจสอบ layout คอลัมน์ (`col-span-1`) รองรับ `flex-wrap` ได้โดยไม่ทำ grid แถวอื่นเพี้ยน — คงข้อความ "-" fallback เมื่อไม่มีแพลตฟอร์มเลยเหมือนพฤติกรรมเดิม

## 5. UI layer — refactor ต้นแบบ

- [x] 5.1 `ContentDetailView.tsx:285-298` — แทนที่ inline IIFE parse-and-render ด้วย `<PlatformBadgeList platforms={item.platforms ?? item.platform} variant="pill" />` — พบว่าของเดิมไม่มีไอคอน (มีแค่ label สี) ต่างจากที่ spec เขียนไว้ตอนแรกว่า "เหมือนเดิมทุกประการรวมไอคอน" ซึ่งขัดกับ design.md ที่ตั้งใจให้ pill variant มีไอคอนเสมอ (ให้เหมือน ContentCardDialog header) — แก้ spec scenario ให้ตรงกับความจริงแล้ว (สี/label/ลำดับเหมือนเดิม, มีไอคอนเพิ่มเป็นการปรับปรุง ไม่ใช่ถดถอย) ไม่ใช่ bug ที่ต้องย้อนแก้โค้ด

## 6. Verification

- [x] 6.1 `pnpm lint` — 0 errors (`tsc --noEmit` ก็ผ่านสะอาด) มี warning ใหม่ 1 อันใน `PlatformBadgeList.tsx` (`react-refresh/only-export-components` เพราะ export ทั้ง component และ `parsePlatforms()` จากไฟล์เดียวกัน) เป็น pattern เดียวกับที่มีอยู่แล้วหลายไฟล์ในโค้ดเบส (เช่น `ContentVideoView.tsx`, `badge.tsx`) ไม่ใช่ของใหม่ที่ควรแก้
- [x] 6.2 `pnpm test` — เพิ่มไฟล์ `PlatformBadgeList.test.tsx` ใหม่ 13 test (parsePlatforms 6 เคส + pill variant 4 เคส + icon-only variant 3 เคส ครอบคลุม 1/7 แพลตฟอร์ม, unknown fallback, ค่าว่าง) test เดิมของ `ContentPlannerCalendar`/`ContentItemList`/`ContentCardDialog` ไม่ต้องแก้เลยเพราะ fixture เดิมใช้ `platform` เดี่ยว (ไม่มี `platforms`) ซึ่ง fallback ไปที่ `item.platform` ถูกต้องอยู่แล้ว — รวม 218/218 ผ่านทั้งหมด (31 ไฟล์)
- [x] 6.3 `pnpm build` — สำเร็จ ไม่มี error (คำเตือน chunk size เป็นของเดิม ไม่เกี่ยวกับ change นี้)
- [x] 6.4 ทดสอบ manual ในเบราว์เซอร์จริง (dev server ที่ localhost:8080, mint JWT ท้องถิ่นสำหรับ QA เหมือนที่ทำตอน apply `lock-published-content-date`) เปิด content item `5e1ea0ed-fb2c-4f9d-8b22-41304ccf97a8` (7 แพลตฟอร์ม) ทั้ง 3 จุด — ยืนยันด้วย DOM/JS ตรงๆ ไม่ใช่แค่ดูภาพ:
  - **Dialog header**: เปิด item จาก bucket "ยังไม่กำหนดวันที่" → เห็น badge แยก 7 อัน (Facebook, LinkedIn, Twitter/X, Instagram, Line OA, WordPress, Wix) พร้อมไอคอนและ label ครบ ไม่ใช่ badge เดียวโชว์สตริงดิบ
  - **Calendar chip**: chip เดียวกันใน bucket มี `<svg>` 7 อัน สี text ตรงกับแต่ละแพลตฟอร์มเป๊ะ (เช่น Facebook `rgb(67,56,202)`, Instagram `rgb(190,24,93)`) ไม่ใช่ไอคอนโลกกลมสีเทา
  - **List view**: สลับไปมุมมองรายการ พบ content item เดียวกันมี 7 ไอคอนสีในคอลัมน์แพลตฟอร์มตรงกันเป๊ะกับ 2 จุดข้างต้น และ **ยืนยันไม่กระทบ change ก่อนหน้า (`lock-published-content-date`)** — แถวนั้นยัง `opacity:0.7` พร้อม title "เผยแพร่ไปแล้วบางแพลตฟอร์ม ไม่สามารถลากเปลี่ยนวันที่ได้" ตามเดิม
  - ไม่มี error ใน console ระหว่างทดสอบทั้งหมด
