## Context

`content-platform-badge-display` กำหนดไว้ว่า `ContentCardDialog`, `ContentDetailView`, และ `PullFromContentDialog` เป็นจุดที่ยังแสดงแพลตฟอร์มของ content item อยู่ — ทั้งสามจุดใช้ `PlatformBadgeList` ที่ parse ค่าแพลตฟอร์ม (JSON array หรือ comma-joined string) แล้วแสดงแยกทีละแพลตฟอร์มพร้อมไอคอน/สีที่ถูกต้อง แต่ระหว่างตรวจสอบแดชบอร์ดคอนเทนต์ (`ContentDashboardPage.tsx`) อย่างละเอียด พบว่ามีอีก 2 จุดที่ตกหล่นไป: การ์ด "คอนเทนต์ค้างท่อ" (`aging.items`) และการ์ด "เนื้อหาล่าสุด" (`recentItems`) ทั้งคู่ยัง lookup `PLATFORM_MAP[item.platform]` ตรงๆ ด้วยค่าดิบจาก `content_items.platform` — item ที่มีหลายแพลตฟอร์มจึงไม่แสดง badge ใดๆ เลย (ต่างจากบั๊กเดิมที่เคยเจอซึ่งแสดง badge ว่างเปล่า จุดนี้ถูก guard ด้วย `item.platform && ...` จึงไม่ render อะไรทั้งนั้น — แย่กว่าเพราะดูเหมือนไม่มีข้อมูลแพลตฟอร์มไปเลย)

สเปกที่มีอยู่ (`content-dashboard-layout`) เขียน scenario "แสดงประเภทและแพลตฟอร์มในบรรทัดเดียวกัน" ของการ์ด "เนื้อหาล่าสุด" ไว้ตรงกับพฤติกรรมบั๊กเป๊ะ (ระบุ `PLATFORM_MAP` ตรงๆ) — ต้องแก้สเปกนี้ไปพร้อมกับโค้ด ไม่งั้น archive แล้วสเปกจะยังบอกว่าพฤติกรรมเดิมถูกต้อง ส่วนการ์ด "คอนเทนต์ค้างท่อ" (`content-dashboard-bi-widgets`) ไม่เคยมีสเปกระบุเรื่อง platform badge ไว้เลย ต้องเพิ่มใหม่

## Goals / Non-Goals

**Goals:**
- แก้การ์ด "คอนเทนต์ค้างท่อ" และ "เนื้อหาล่าสุด" ให้แสดงแพลตฟอร์มถูกต้องสำหรับ content item ทุกแบบ (แพลตฟอร์มเดียว, หลายแพลตฟอร์ม, ไม่มีแพลตฟอร์ม) โดยใช้ `PlatformBadgeList` ที่มีอยู่แล้ว — สอดคล้องกับอีก 3 จุดในระบบ
- ปรับ scope ของ capability `content-platform-badge-display` ให้ตรงกับความจริง (5 จุด ไม่ใช่ 3 จุด)
- แก้สเปก `content-dashboard-layout` ที่เขียนพฤติกรรมบั๊กไว้เป็น requirement ให้ตรงกับพฤติกรรมที่ถูกต้อง
- เพิ่มสเปก `content-dashboard-bi-widgets` ให้ครอบคลุมการแสดง platform badge ของการ์ด "คอนเทนต์ค้างท่อ" ซึ่งไม่เคยถูกระบุไว้

**Non-Goals:**
- ไม่เปลี่ยน layout อื่นของทั้งสองการ์ด (thumbnail, ชื่อ, สถานะ, วันที่/อายุ, ปุ่ม "ดูทั้งหมด")
- ไม่แตะ 3 จุดอื่นใน `ContentDashboardPage.tsx` ที่ใช้ `PLATFORM_MAP[...]` เช่นกัน (`f.platform` ของคิวล้มเหลว, `s.platform` ของกำหนดการถัดไป, `ch.platform` ของสถานะช่องทาง) — ทั้งสามมาจาก `publish_channels.platform` ซึ่งเป็นแพลตฟอร์มเดียวเสมอ (ยืนยันจาก SQL ใน `api/content-analytics.php`/`api/brand-content.php`) ไม่ใช่บั๊กคลาสเดียวกัน
- ไม่แตะ `ContentCardDialog`/`ContentDetailView`/`PullFromContentDialog` (ถูกต้องอยู่แล้ว)
- ไม่เพิ่มการตัดทอนแบบ "+N" — ใช้ `variant="pill"` แบบเดียวกับอีก 3 จุด

## Decisions

- **ใช้ `<PlatformBadgeList platforms={item.platform} variant="pill" size={...} />` แทนการ lookup `PLATFORM_MAP` เอง ในทั้งสองการ์ด** — สอดคล้องกับ 3 จุดที่แก้ไปแล้ว ไม่ต้องเขียน logic parse/render ซ้ำ
- **ขนาด badge**: การ์ด "คอนเทนต์ค้างท่อ" เดิมใช้ `<Badge variant="outline">` มาตรฐาน (ไม่ใช่ `text-[10px]` แบบ `PullFromContentDialog`) จึงใช้ `size` default ของ `PlatformBadgeList` (12) ให้สัดส่วนใกล้เคียงกับ badge สถานะข้างๆ (`STATUS_MAP`) ที่อยู่ในแถวเดียวกัน — การ์ด "เนื้อหาล่าสุด" ก็เช่นกัน เพราะ layout เป็นบรรทัดแนวนอนร่วมกับ type badge ไม่ใช่พื้นที่แคบแบบแถวลิสต์ของ `PullFromContentDialog`
- **item ไม่มีแพลตฟอร์ม**: `PlatformBadgeList` คืน `null` เองเมื่อ parse ได้ array ว่าง (ไม่ต้อง guard `item.platform &&` ซ้ำเหมือนโค้ดเดิม) — พฤติกรรมนี้ตรงกับที่ระบุไว้แล้วใน `content-platform-badge-display`
- **ขยาย scope requirement เดิมใน `content-platform-badge-display`** แทนที่จะสร้าง capability ใหม่ — เป็น requirement เดียวกันเป๊ะ (parse แล้วแสดงแยกทีละแพลตฟอร์ม ห้าม lookup ค่าดิบ) แค่ตกหล่นอีก 2 จุด
- **แก้ scenario เดิมใน `content-dashboard-layout` แทนการเพิ่ม scenario ใหม่คู่ขนาน** — scenario "แสดงประเภทและแพลตฟอร์มในบรรทัดเดียวกัน" เดิมผิดตรงตัว (ระบุ `PLATFORM_MAP` เป็น requirement) ปล่อยไว้คู่กับ scenario ใหม่จะทำให้สเปกขัดแย้งกันเอง

## Risks / Trade-offs

- [Risk] `PlatformBadgeList` แสดง badge เต็มรูปแบบ (ไอคอน+label ต่อแพลตฟอร์ม) กว้างกว่า badge เดี่ยวเดิม ถ้า item มีหลายแพลตฟอร์มมากอาจทำให้แถวสูงขึ้นเมื่อ wrap → Mitigation: ทั้งสองการ์ดเป็น layout แนวตั้ง/มีพื้นที่ wrap ตามธรรมชาติอยู่แล้ว (ไม่ใช่ตารางแถวคงที่) เหมือนกับที่ยอมรับความเสี่ยงนี้ไปแล้วใน `PullFromContentDialog`
- [Risk] การ์ด "คอนเทนต์ค้างท่อ" จำกัด 5 รายการ และ "เนื้อหาล่าสุด" จำกัด 5 รายการ — พื้นที่แนวตั้งจำกัดกว่า list ทั่วไป ถ้าหลายแถวมีหลายแพลตฟอร์มพร้อมกันการ์ดอาจสูงขึ้นเห็นได้ชัด → Mitigation: ยอมรับได้เพราะ correctness สำคัญกว่าความหนาแน่นของ layout — ตรงกับหลักการเดิมที่ยึดถือในทุกจุดที่แก้บั๊กนี้มาก่อน

## Migration Plan

ไม่มี migration ฐานข้อมูลหรือ API — แก้ frontend component เดียว (`ContentDashboardPage.tsx`) ปรับใช้ได้ทันทีหลัง build/deploy ตามปกติ

## Open Questions

(ไม่มี)
