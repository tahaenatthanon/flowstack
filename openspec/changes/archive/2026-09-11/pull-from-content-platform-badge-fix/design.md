## Context

`content-platform-badge-display` capability กำหนดไว้ว่า `ContentCardDialog` และ `ContentDetailView` เป็น "จุดเดียวที่ยังแสดงแพลตฟอร์มของ content item อยู่" หลังจาก `ContentPlannerCalendar`/`ContentItemList` เปลี่ยนไปแสดงประเภทเนื้อหาแทนแล้ว (`content-type-badge-display`) — แต่ระหว่างสำรวจโค้ดทั้งโมดูลคอนเทนต์ พบว่ามีจุดที่ 3 ที่ตกหล่นไป: `PullFromContentDialog.tsx` (ใช้ใน `MarketingPage.tsx`/`CampaignsPage.tsx` สำหรับดึงคอนเทนต์ที่มีอยู่แล้วมาใช้) ยัง lookup `PLATFORM_MAP[item.platform]` ตรงๆ ด้วยค่าดิบ ทำให้ item หลายแพลตฟอร์มแสดง badge ว่างเปล่า

## Goals / Non-Goals

**Goals:**
- แก้ `PullFromContentDialog.tsx` ให้แสดงแพลตฟอร์มถูกต้องสำหรับ content item ทุกแบบ (แพลตฟอร์มเดียว, หลายแพลตฟอร์ม, ไม่มีแพลตฟอร์ม) โดยใช้ `PlatformBadgeList` ที่มีอยู่แล้ว
- ปรับ scope ของ capability `content-platform-badge-display` ให้ตรงกับความจริง (3 จุด ไม่ใช่ 2 จุด)

**Non-Goals:**
- ไม่เปลี่ยน layout อื่นของแถว item ในลิสต์ (thumbnail, ชื่อ, excerpt, วันที่, ปุ่ม preview/select)
- ไม่แตะ `ContentCardDialog`/`ContentDetailView` (ถูกต้องอยู่แล้ว)
- ไม่เพิ่มการตัดทอนแบบ "+N" — ใช้ `variant="pill"` เดียวกับอีก 2 จุด ซึ่งแสดงครบทุกแพลตฟอร์มไม่ตัดทอน (ต่างจาก `ContentApprovalTab`/คอลัมน์ตารางที่จงใจตัดทอนเพราะพื้นที่แถวจำกัด — ที่นี่เป็น list การ์ดที่มีพื้นที่ wrap ได้ ไม่มีข้อจำกัดเดียวกัน)

## Decisions

- **ใช้ `<PlatformBadgeList platforms={item.platforms ?? item.platform} variant="pill" size={10} />` แทนการเขียน `<span>` เอง** — สอดคล้องกับ `ContentCardDialog`/`ContentDetailView` ที่ใช้ component เดียวกันอยู่แล้ว ไม่ต้องเขียน logic parse/render ซ้ำที่ 3
- **`size={10}`** — เล็กกว่าค่า default (12) เพราะพื้นที่ในแถวลิสต์นี้แคบ (inline กับ title และปุ่ม preview ในแถวเดียว) ใกล้เคียงกับขนาด badge เดิมที่เคยเขียนเอง (`text-[10px]`)
- **ขยาย scope requirement เดิมใน `content-platform-badge-display`** แทนที่จะสร้าง capability ใหม่ — เพราะเป็น requirement เดียวกันเป๊ะ (parse แล้วแสดงแยกทีละแพลตฟอร์ม ห้าม lookup ค่าดิบ) แค่ตกหล่นจุดที่ 3 ไป

## Risks / Trade-offs

- [Risk] `PlatformBadgeList` แสดง badge เต็มรูปแบบ (ไอคอน+label) อาจกว้างกว่า `<span>` เดิมที่ตัดข้อความสั้นๆ ถ้า item มีหลายแพลตฟอร์มมาก อาจทำให้แถวสูงขึ้นเมื่อ wrap → Mitigation: แถวนี้เป็น layout แนวตั้งอยู่แล้ว (title บรรทัดหนึ่ง, excerpt อีกบรรทัด) มีพื้นที่ให้ wrap ได้ตามธรรมชาติ ไม่ใช่ตารางแถวคงที่แบบ `ContentApprovalTab`

## Migration Plan

ไม่มี migration ฐานข้อมูลหรือ API — แก้ frontend component เดียว ปรับใช้ได้ทันทีหลัง build/deploy ตามปกติ

## Open Questions

(ไม่มี)
