## Why

`ContentDashboardPage.tsx` แสดง badge แพลตฟอร์มของ content item ในสองการ์ด ("คอนเทนต์ค้างท่อ" และ "เนื้อหาล่าสุด") ด้วยการ lookup `PLATFORM_MAP[item.platform]` ตรงๆ ด้วยค่าดิบจาก `content_items.platform` — เป็นบั๊กคลาสเดียวกับที่แก้ไปแล้วหลายรอบในโมดูลนี้ (`ContentApprovalTab`/`ContentItemList`/`ContentPlannerCalendar`, ตัวกรอง `ContentApprovalTab`, และ `PullFromContentDialog`) เมื่อ content item มีหลายแพลตฟอร์ม (`item.platform` เป็น `"facebook,linkedin"`) lookup จะไม่เจอ key ที่ตรงกัน ทำให้ไม่แสดง badge แพลตฟอร์มใดๆ เลย — ผู้ใช้เปิดแดชบอร์ดเห็นคอนเทนต์ที่ยิงหลายแพลตฟอร์มแล้วดูเหมือนไม่มีข้อมูลแพลตฟอร์ม พบระหว่างสำรวจโค้ดทั้งแดชบอร์ดคอนเทนต์อย่างละเอียด (ดู capability `content-platform-badge-display` ที่ระบุจุดที่เคยแก้ไว้แล้วก่อนหน้านี้)

## What Changes

- แก้การ์ด "คอนเทนต์ค้างท่อ" (`aging.items`) ใน `ContentDashboardPage.tsx` ให้แสดงแพลตฟอร์มของแต่ละ item ด้วย `<PlatformBadgeList>` แทนการ lookup `PLATFORM_MAP[item.platform]` เอง
- แก้การ์ด "เนื้อหาล่าสุด" (`recentItems`) ใน `ContentDashboardPage.tsx` ให้แสดงแพลตฟอร์มของแต่ละ item ด้วย `<PlatformBadgeList>` เช่นเดียวกัน
- ไม่เปลี่ยน layout อื่นของทั้งสองการ์ด (thumbnail, ชื่อ, สถานะ, วันที่/อายุ)
- ไม่แตะจุดอื่นใน `ContentDashboardPage.tsx` ที่ใช้ `PLATFORM_MAP` ตรงๆ (`f.platform` จากคิวล้มเหลว, `s.platform` จากกำหนดการถัดไป, `ch.platform` จากสถานะช่องทาง) เพราะยืนยันแล้วว่าทั้งสามจุดนั้นมาจาก `publish_channels.platform` ซึ่งเป็นค่าเดียวเสมอ ไม่ใช่บั๊กคลาสเดียวกัน

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `content-platform-badge-display`: requirement "Content item ที่มีหลายแพลตฟอร์มต้องแสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง" เดิมระบุขอบเขตไว้ที่ `ContentCardDialog`, `ContentDetailView`, และ `PullFromContentDialog` — ต้องขยายให้รวมสองการ์ดในแดชบอร์ด (`ContentDashboardPage`: "คอนเทนต์ค้างท่อ" และ "เนื้อหาล่าสุด") เป็นจุดเพิ่มเติมที่มีบั๊กเดียวกัน
- `content-dashboard-layout`: requirement "เนื้อหาล่าสุดเป็นตารางหลัก" มี scenario "แสดงประเภทและแพลตฟอร์มในบรรทัดเดียวกัน" ที่เขียนสเปกไว้ตรงกับพฤติกรรมเดิม (ระบุการใช้ `PLATFORM_MAP` ตรงๆ) — ต้องแก้ scenario นี้ให้ระบุการใช้ `PlatformBadgeList` แทน เพื่อให้สเปกไม่ตกลงมาเป็นบั๊กที่ถูกกำหนดไว้เองอีก
- `content-dashboard-bi-widgets`: requirement "Widget คอนเทนต์ค้างท่อ (Aging)" ยังไม่เคยระบุพฤติกรรมการแสดง badge แพลตฟอร์มของรายการค้างท่อไว้เลย — ต้องเพิ่ม scenario ใหม่ให้ระบุว่าต้องแสดงด้วย `PlatformBadgeList` เมื่อ item มีหลายแพลตฟอร์ม

## Impact

- `src/pages/ContentDashboardPage.tsx`
- ไม่มีการเปลี่ยน schema ฐานข้อมูลหรือ API
