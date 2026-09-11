## Context

`ContentPlannerAI.tsx` sidebar "แผนล่าสุด" แสดงจุดสีเล็กๆ (`w-1.5 h-1.5 rounded-full`) ข้างหัวข้อแต่ละ item ในแผน ใช้ hardcoded ternary chain เทียบ `item.platform` กับชื่อแพลตฟอร์มตรงๆ 6 ชนิด แล้ว fallback เป็นเทาถ้าไม่ตรง — ทั้งนิยามสีซ้ำกับ `PLATFORM_CATALOG` และพังกับ item หลายแพลตฟอร์ม (comma-joined string ไม่ตรงกับชื่อเดี่ยวใดๆ เลย)

## Goals / Non-Goals

**Goals:**
- จุดสีมาจาก `PLATFORM_CATALOG` (ผ่าน `getPlatformColors()`) แหล่งเดียว ไม่มีการนิยามสีซ้ำ
- item หลายแพลตฟอร์มได้สีของแพลตฟอร์มแรกที่มีจริง แทนที่จะตกไปสีเทาเสมอ
- item ที่ไม่มีแพลตฟอร์มเลยยังคงได้สีเทา default เหมือนเดิม

**Non-Goals:**
- ไม่เปลี่ยนขนาด/ตำแหน่ง/รูปร่างของจุด (`w-1.5 h-1.5 rounded-full`)
- ไม่เพิ่มไอคอนหรือ tooltip ที่จุด — ยังเป็นแค่จุดสีเรียบๆ เหมือนเดิม
- ไม่แตะ `ContentVideoView.tsx` (มี exception ที่ตั้งใจแยกไว้ชัดเจนอยู่แล้วใน spec เดิม)

## Decisions

- **ใช้ `getPlatformColors(platform).text` แทน `.bg`** — `hex.bg` เป็นโทนอ่อนสำหรับพื้นหลัง badge/pill (เช่น facebook `#e0e7ff`) ซึ่งจางเกินไปสำหรับจุดขนาด 1.5x1.5px ที่ต้องมองเห็นชัดบนพื้นหลังสว่าง `hex.text` เป็นโทนเข้มกว่า (เช่น facebook `#4338ca`) ให้ผลลัพธ์ใกล้เคียงกับสี Tailwind เดิมที่ hardcode ไว้ (เช่น `bg-indigo-500` ใกล้เคียง `#4338ca`) โดยไม่ต้องเพิ่มค่าสีใหม่ใน `PLATFORM_CATALOG`
- **หา "แพลตฟอร์มแรก" ผ่าน `parsePlatforms(item.platforms ?? item.platform)[0]`** — สอดคล้องกับ pattern เดียวกับที่ใช้แก้บั๊กนี้ในทุกจุดก่อนหน้า (`ContentApprovalTab`, `ContentItemList`, `ContentPlannerCalendar`, `PullFromContentDialog`) จุดสีขนาดเล็กแสดงได้แค่สีเดียวอยู่แล้วโดยธรรมชาติของ UI จึงใช้แค่ตัวแรกพอ ไม่ต้องแสดงหลายจุด
- **ใช้ inline `style={{ backgroundColor: ... }}` แทน Tailwind class** — `getPlatformColors()` คืนค่า hex ไม่ใช่ Tailwind class string จึงต้องใช้ inline style เหมือนกับที่ `ContentListTab.tsx`/`AnalyticsContentTab.tsx` ทำอยู่แล้วเวลาใช้ `getPlatformColors()`
- **fallback เทา (`#9ca3af` หรือเทียบเท่า `bg-gray-400`) เมื่อ parse ได้ array ว่างเท่านั้น** — ไม่ใช้ fallback ของ `getPlatformColors()` เอง (ซึ่งคืนสีเทาอ่อนของ `DEFAULT_ENTRY` ที่ออกแบบมาสำหรับพื้นหลัง ไม่ใช่จุดทึบ) เพื่อคงสีเทาเข้มแบบเดิมที่มองเห็นชัดเหมือนก่อนแก้

## Risks / Trade-offs

- [Risk] สีจุดจะเปลี่ยนเฉดเล็กน้อยจากที่ hardcode ไว้เดิม (เช่น facebook จาก Tailwind `indigo-500` `#6366f1` เป็น catalog `text` `#4338ca` ซึ่งเป็น `indigo-700`) → Mitigation: เป็นการเปลี่ยนแปลงเล็กน้อยในองค์ประกอบ UI ขนาด 1.5px ที่ไม่ใช่จุดโฟกัสหลัก ถือเป็นการยอมรับได้เพื่อแลกกับการไม่มี logic ซ้ำ (เหมือนที่ยอมรับการเปลี่ยนแปลงเล็กน้อยใน `ContentDetailView` ตอนรวม component ก่อนหน้านี้)

## Migration Plan

ไม่มี migration ฐานข้อมูลหรือ API — แก้ frontend component เดียว ปรับใช้ได้ทันทีหลัง build/deploy ตามปกติ

## Open Questions

(ไม่มี)
