## Context

ตรรกะ parse `content_items.platform`/`platforms` มีอยู่ 2 implementation คู่ขนานกัน:
- `parsePlatforms()` ใน `src/components/content/PlatformBadgeList.tsx` — ใช้โดย `ContentApprovalTab.tsx`, `ContentItemList.tsx`, `ContentPlannerCalendar.tsx` (ทั้งสามผ่านการแก้บั๊กมาแล้วในสองการเปลี่ยนแปลงก่อนหน้า)
- `getItemPlatforms()` ใน `src/components/content/tabs/ContentListTab.tsx` — เขียนตรรกะเดียวกันซ้ำเองเกือบทั้งหมด ใช้ภายในไฟล์นั้น 3 จุด (platformCounts, filtered, render loop ไอคอน)

การมี 2 implementation คู่ขนานคือสาเหตุที่ทำให้บั๊ก "เทียบ platform แบบ exact-match กับสตริง comma-joined" ถูกแก้ในจุดหนึ่งแล้วยังหลงเหลืออยู่อีกจุดหนึ่งโดยไม่มีใครรู้ (`ContentListTab.tsx` ถูกแก้ไปแล้วก่อนหน้านี้ผ่าน commit `17c106c`, แต่ `ContentApprovalTab.tsx` ยังไม่ถูกแก้จนกระทั่ง `content-approval-platform-fix`) การรวมเป็น implementation เดียวและวางไว้ใน `src/lib/` (ตาม CLAUDE.md ที่กำหนดให้ `src/lib/` เป็น business logic/utilities) ทำให้ทุกจุดใช้ตรรกะเดียวกันเสมอ

## Goals / Non-Goals

**Goals:**
- รวม `parsePlatforms()` เป็น implementation เดียวที่ `src/lib/contentPlatforms.ts`
- ทุกผู้ใช้ (4 ไฟล์เดิม + `ContentListTab.tsx`) เรียกใช้ implementation เดียวกันนี้ ไม่มีการเขียนตรรกะ parse ซ้ำที่ไหนอีก
- ไม่เปลี่ยน behavior ที่ผู้ใช้เห็น — ทุก test เดิมต้องผ่าน และเพิ่ม characterization test ปิดช่องว่าง coverage ที่พบใน `ContentListTab.tsx`

**Non-Goals:**
- ไม่เปลี่ยน UI/UX ของหน้าไหนทั้งสิ้น
- ไม่แก้ signature หรือพฤติกรรมของ `parsePlatforms()` เอง (รับ `string[] | string | null | undefined` คืน `string[]` เหมือนเดิมทุกประการ)
- ไม่แตะ `PlatformBadgeList` component, `PLATFORM_CATALOG`, หรือ platform color/label logic ใดๆ ใน `src/lib/platformConfig.ts`

## Decisions

- **ไฟล์ปลายทาง: `src/lib/contentPlatforms.ts` (ใหม่) แทนที่จะรวมเข้า `src/lib/platformConfig.ts`** — `platformConfig.ts` ประกาศตัวเองชัดเจนว่าเป็น "Platform color/label catalog — single source of truth" การเอาตรรกะ parse ค่าฟิลด์มาแปะจะทำให้ขอบเขตของไฟล์นั้นเบลอ แยกไฟล์ใหม่เพื่อคงความรับผิดชอบเดี่ยว (single responsibility) ของแต่ละไฟล์
- **ย้าย `parsePlatforms()` ทั้งหมด ไม่ใช่แค่ re-export จาก `PlatformBadgeList.tsx`** — ตามที่ผู้ใช้ระบุชัดเจนว่าต้องการ "ย้าย" ไม่ใช่เพิ่ม indirection ใหม่ ทุก import statement ที่เคยชี้ไป `./PlatformBadgeList` เปลี่ยนไปชี้ `@/lib/contentPlatforms` ตรงๆ
- **`getItemPlatforms()` ใน `ContentListTab.tsx` คงชื่อและ signature เดิม กลายเป็น thin wrapper `(item) => parsePlatforms(item.platforms ?? item.platform)`** — แทนที่จะ inline `parsePlatforms(item.platforms ?? item.platform)` ที่จุดเรียกใช้ทั้ง 3 จุดตรงๆ (platformCounts, filtered, render loop) เพื่อลด diff ในไฟล์ที่มีโค้ดเยอะอยู่แล้ว และคงชื่อ local ที่อ่านเข้าใจง่ายกว่าตรงจุดเรียกใช้
- **แก้ไข: การวิเคราะห์ระหว่าง explore ที่ว่าความต่างเชิงพฤติกรรมเป็น "unreachable" นั้นผิด — พบ regression จริงระหว่าง apply และแก้ไขแล้ว** ระหว่าง explore เคยสรุปว่า `getItemPlatforms()` เดิม (fall through ไป `item.platform` เมื่อ `item.platforms` parse เป็น JSON array ไม่ได้) กับ `parsePlatforms()` (split สตริงนั้นตรงๆ) ต่างกันแต่ unreachable เพราะเช็คแค่ path การเขียน (`json_encode` ใน INSERT/UPDATE) แต่ไม่ได้เช็ค path การอ่านตอน `platforms` เป็นค่าว่าง — `content-items.php:56` มี fallback `COALESCE(NULLIF(ci.platforms,''), JSON_ARRAY(COALESCE(NULLIF(ci.platform,''), cpi.platform)))` ซึ่งเมื่อ `ci.platforms` เป็น NULL/ว่าง (เช่น content item เก่าก่อนมีคอลัมน์นี้) จะห่อค่า `ci.platform` ทั้งก้อน (อาจเป็น comma-joined เช่น `"facebook,youtube"`) เป็น JSON array ที่มี **element เดียว** คือสตริงนั้นทั้งดุ้น — `parsePlatforms()` เดิม (ก่อนแก้ในการเปลี่ยนแปลงนี้) parse JSON สำเร็จแล้วไม่ split element ต่อ ในขณะที่ `getItemPlatforms()` เดิมมี `flatMap(p => p.split(','))` ที่ split element ซ้ำอีกชั้นเสมอ จึงรอดจากบั๊กนี้มาโดยบังเอิญ พบจริงในฐานข้อมูล (`content_items.id = f6ea7fbc-...`, `platform="facebook,youtube"`, `platforms=NULL`) ระหว่างทดสอบด้วยมือหลัง apply — แก้โดยเพิ่ม `.flatMap(p => String(p).split(','))` ใน `parsePlatforms()` เอง (`src/lib/contentPlatforms.ts`) ให้ split ทุก element ซ้ำเสมอ ทำให้เป็น union ที่ถูกต้องกว่าทั้งสอง implementation เดิม — แก้ที่จุดเดียวนี้ทำให้ `ContentApprovalTab.tsx`/`ContentItemList.tsx`/`ContentPlannerCalendar.tsx` ที่ใช้ `parsePlatforms()` อยู่แล้วได้รับการแก้บั๊กแฝงนี้ไปด้วยโดยอัตโนมัติ (บั๊กนี้มีอยู่ก่อนหน้าการเปลี่ยนแปลงนี้แล้วในทั้ง 3 ไฟล์นั้น เพียงแต่ไม่มีใครสังเกตเพราะมี content item ที่เข้าเงื่อนไขนี้แค่รายการเดียวในฐานข้อมูล)
- **เพิ่ม characterization test ให้ `ContentListTab.tsx`** — ก่อน refactor ไม่มี test คลุม platform chip counts, การกรองด้วยแพลตฟอร์มของ item หลายแพลตฟอร์ม, หรือ render loop ไอคอนแพลตฟอร์มเลยแม้แต่ตัวเดียว เพิ่ม test เหล่านี้ก่อน/ระหว่าง refactor เพื่อล็อกพฤติกรรมที่มีอยู่ไว้ ป้องกัน regression เงียบๆ ที่ "pure refactor" มักพลาดได้ถ้าไม่มี test คลุม

## Risks / Trade-offs

- [Risk] การย้าย import path อาจตกหล่นบางจุด (เช่น import แบบ dynamic หรือ re-export ที่ไม่ปรากฏใน grep ตรงๆ) → Mitigation: รัน `pnpm exec tsc --noEmit` หลังแก้ทุกไฟล์ — TypeScript จะ error ทันทีถ้ามี import ที่ค้างอยู่ที่ path เดิม
- [Risk] การเพิ่ม characterization test ใหม่ให้ `ContentListTab.tsx` อาจเผยพฤติกรรมเดิมที่ไม่ถูกต้อง (เช่น edge case ที่ไม่เคยมีใครสังเกต) ทำให้ขอบเขตงานขยายเกิน "pure refactor" → Mitigation: ถ้าพบพฤติกรรมเดิมที่ดูผิด ให้หยุดและรายงานเป็นบั๊กแยก ไม่แก้ปนไปกับ refactor นี้ — เขียน test ให้ตรงกับพฤติกรรมปัจจุบันเสมอ (characterization ไม่ใช่ correctness)

## Migration Plan

ไม่มี migration ฐานข้อมูลหรือ API — ย้ายโค้ดฝั่ง frontend ล้วนๆ ปรับใช้ได้ทันทีหลัง build/deploy ตามปกติ หาก build/test ผ่านหมดถือว่าปลอดภัย ไม่ต้อง rollback plan พิเศษ (revert commit เดียวพอ)

## Open Questions

(ไม่มี)
