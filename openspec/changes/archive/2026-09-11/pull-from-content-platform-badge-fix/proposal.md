## Why

`PullFromContentDialog.tsx` (dialog "ดึงจาก Content" ใช้ใน `MarketingPage.tsx`/`CampaignsPage.tsx`) แสดง badge แพลตฟอร์มของแต่ละ content item ด้วยการ lookup `PLATFORM_MAP[item.platform]` ตรงๆ ด้วยค่าดิบ ซึ่งเป็นบั๊กคลาสเดียวกับที่แก้ไปแล้วใน `ContentApprovalTab`/`ContentItemList`/`ContentPlannerCalendar` — เมื่อ item มีหลายแพลตฟอร์ม (`item.platform` เป็น `"facebook,linkedin"`) lookup จะไม่เจอ key ที่ตรงกัน ทำให้ render เป็น `<span>` ว่างเปล่า (มี element แต่ไม่มีข้อความ/สี) ปรากฏให้เห็นชัดเจนในดีอะล็อกเลือกคอนเทนต์ — พบระหว่างสำรวจโค้ดทั้งโมดูลคอนเทนต์หลังแก้บั๊กเดียวกันไปแล้ว 2 รอบ (ดู `content-planner-platform-filter-fix`, `content-approval-platform-fix`)

## What Changes

- แก้ `PullFromContentDialog.tsx` ให้แสดงแพลตฟอร์มของแต่ละ item ด้วย `<PlatformBadgeList>` (component ที่มีอยู่แล้ว ออกแบบมาสำหรับแสดงแพลตฟอร์มหลายอันแยกทีละ pill พร้อมไอคอน/สีที่ถูกต้อง) แทนการเขียน `<span>` + `PLATFORM_MAP[item.platform]` เอง
- ไม่เปลี่ยน layout อื่นของแถว item ในลิสต์ (thumbnail, ชื่อ, excerpt, วันที่)
- เพิ่ม test ครอบคลุม item ที่มีหลายแพลตฟอร์มแสดง badge ครบทุกอัน ไม่ว่างเปล่า

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `content-platform-badge-display`: requirement "Content item ที่มีหลายแพลตฟอร์มต้องแสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง" เดิมระบุขอบเขตไว้ว่า "`ContentCardDialog` และ `ContentDetailView` เท่านั้น" — ต้องขยายขอบเขตให้รวม `PullFromContentDialog` เป็นจุดที่ 3 เพราะเป็นอีกจุดหนึ่งที่แสดงแพลตฟอร์มของ content item และมีบั๊กเดียวกัน (lookup ค่าดิบตรงๆ)

## Impact

- `src/components/content/dialogs/PullFromContentDialog.tsx`
- `src/__tests__/content/PullFromContentDialog.test.tsx`
- ไม่มีการเปลี่ยน schema ฐานข้อมูลหรือ API
