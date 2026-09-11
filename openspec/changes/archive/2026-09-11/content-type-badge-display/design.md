## Context

`platform-color-catalog` (archived) แก้ให้ `ContentPlannerCalendar` chip และ `ContentItemList` คอลัมน์แพลตฟอร์มแสดงไอคอนแยกทีละแพลตฟอร์ม (component `PlatformBadgeList` variant `icon-only`) แทนสตริงดิบ/สีเทา default — ถูกต้องตามข้อมูล แต่พอเห็นของจริงบนเบราว์เซอร์กับ content item ที่มี 7 แพลตฟอร์ม พบว่า chip ขนาด ~80px ต้องอัดไอคอน 7 อันเรียงกัน ซึ่งแม้จะไม่ผิดแต่ไม่ใช่สัญญาณภาพที่มีประโยชน์ที่สุดสำหรับพื้นที่ขนาดนี้

ระบบมี resolver ประเภทเนื้อหาที่เป็น canonical source of truth อยู่แล้วและไม่มีการนิยามซ้ำที่ไหนอื่น (ต่างจากปัญหาสีแพลตฟอร์มที่เจอรอบก่อน):

```
TYPE_MAP (types.ts:529-533) — ใช้อยู่แล้ว 6 ไฟล์ ไม่มีการนิยามซ้ำที่ไหน
  article → FileText icon, 'text-blue-500 bg-blue-50 dark:bg-blue-950'
  image   → Image icon,    'text-violet-500 bg-violet-50 dark:bg-violet-950'
  video   → Video icon,    'text-red-500 bg-red-50 dark:bg-red-950'

getCanonicalContentType() (types.ts:479-481) — บังคับเหลือแค่ 'article' | 'video'
```

ตรวจข้อมูลจริงแล้วยืนยันว่า `type='image'` ไม่เคยถูกใช้เลยสักแถว (`content_items`: article 46, video 4, image 0) ตรงกับที่ `getCanonicalContentType()` ปฏิบัติอยู่แล้ว — ไม่ต้องออกแบบสีที่ 3 เพิ่ม

หลังการเปลี่ยนแปลงนี้ `PlatformBadgeList`'s `variant="icon-only"` จะไม่มีผู้เรียกใช้เหลืออยู่เลย (เดิมมีแค่ 2 จุดคือ `ContentPlannerCalendar` และ `ContentItemList` ซึ่งทั้งคู่กำลังเปลี่ยนไปใช้ type badge แทน) ส่วน `ContentCardDialog` และ `ContentDetailView` ยังใช้แค่ `variant="pill"` เหมือนเดิม ไม่ถูกแตะในการเปลี่ยนแปลงนี้

## Goals / Non-Goals

**Goals:**
- Chip บนปฏิทินสื่อสาร "ประเภทเนื้อหา" (บทความ/วีดีโอ) แทนแพลตฟอร์ม ด้วยสีพื้นหลังทั้ง chip + ไอคอนเดียว ไม่มี label ข้อความ (พื้นที่จำกัด)
- คอลัมน์ในมุมมองรายการแสดง badge ประเภทเนื้อหาแบบเต็ม (ไอคอน + ชื่อ) แทนไอคอนแพลตฟอร์ม พร้อมหัวคอลัมน์และ sort key ที่ตรงกับข้อมูลที่แสดงจริง
- ลบโค้ดที่ไม่มีผู้ใช้แล้ว (`icon-only` variant ของ `PlatformBadgeList`) ไม่ปล่อยเป็น dead code
- ไม่กระทบ `ContentCardDialog`/`ContentDetailView` ที่ยังต้องแสดงแพลตฟอร์มแยกทีละอันเหมือนเดิม

**Non-Goals:**
- ไม่เพิ่มสีที่ 3 สำหรับ `type='image'` (ไม่มีข้อมูลจริงใช้ค่านี้ และ `getCanonicalContentType()` ก็ไม่รองรับอยู่แล้ว)
- ไม่แก้ตัวกรอง `platformFilter`/`typeFilter` เหนือปฏิทิน/รายการ (คนละกลไกกับสิ่งที่แสดงในคอลัมน์/chip — พบบั๊กแยกต่างหากที่ `platformFilter` เทียบสตริงตรงๆ พลาดกับ item หลายแพลตฟอร์ม ได้ spawn เป็น task แยกไว้แล้ว ไม่รวมใน change นี้)
- ไม่แตะ backend/schema — เป็นการเปลี่ยนเฉพาะ frontend presentation เหมือนเดิม
- ไม่เปลี่ยนพฤติกรรมล็อกคอนเทนต์ที่เผยแพร่แล้ว (`lock-published-content-date`) — ไอคอน Lock ยังคงอยู่คู่กับ type badge บน chip เหมือนเดิม

## Decisions

### 1. Chip ปฏิทิน: พื้นหลังทั้ง chip ใช้ `TYPE_MAP.color` (Tailwind class) แทน `getPlatformColors()` (inline hex)
เปลี่ยนจาก `style={{backgroundColor: colors.bg, color: colors.text}}` (hex, ไม่มี dark mode) เป็น `className={TYPE_MAP[type].color}` (Tailwind class รวม `dark:` variant อยู่แล้ว) — ผลพลอยได้คือ chip ปฏิทินได้ dark mode ที่ถูกต้องเป็นครั้งแรก (ของเดิมทั้งตอนใช้สีแพลตฟอร์มก็ไม่มี dark mode เพราะเป็น inline hex)

ไอคอนในบรรทัดเดียวกับ topic (จุดเดิมที่เคยเป็น `<PlatformBadgeList variant="icon-only">`) เปลี่ยนเป็น icon component จาก `TYPE_MAP[type].icon` (`FileText`/`Video`) ตัวเดียว ไม่มี label ข้อความ ขนาดเท่ากับไอคอน Lock ที่มีอยู่แล้ว (`h-2.5 w-2.5`)

**ทางเลือกที่พิจารณา**: คง background สีแพลตฟอร์มไว้ + เพิ่ม type badge เป็นองค์ประกอบเสริม (ตามที่เสนอเป็นตัวเลือกแรกตอน explore) — ผู้ใช้เลือกปฏิเสธชัดเจน ("หายไปเลย เหลือแค่ type badge") เพราะอยากให้สัญญาณภาพเดียวของ chip ชัดเจนไม่ปนกัน 2 มิติ

### 2. Component กลางใหม่สำหรับ type badge รองรับ 2 variant เหมือน `PlatformBadgeList`
สร้าง `ContentTypeBadge.tsx` รับ `contentType: string | null | undefined` (ผ่าน `getCanonicalContentType()` ก่อนเรียก หรือรับ raw แล้ว resolve เองภายใน) และ `variant: 'pill' | 'icon-only'`:
- `icon-only` — ไอคอนเดียวจาก `TYPE_MAP[type].icon` สีตาม `TYPE_MAP[type].color` ไม่มี label (ใช้ใน `ContentPlannerCalendar`)
- `pill` — ไอคอน + label ในกล่องมน สีพื้น/ตัวอักษรจาก `TYPE_MAP[type].color` (ใช้ใน `ContentItemList`)

**ทางเลือกที่พิจารณา**: inline logic ตรงๆ ในแต่ละไฟล์โดยไม่มี component กลาง — ปฏิเสธเพราะจะเขียน `TYPE_MAP[type].icon`/`.color`/`.label` ซ้ำ 2 ที่ ผิด pattern ที่เพิ่งวางไว้กับ `PlatformBadgeList` ในรอบก่อน (DRY เดียวกัน)

### 3. ลบ `variant="icon-only"` ออกจาก `PlatformBadgeList` แทนที่จะปล่อยไว้เฉยๆ
หลัง `ContentPlannerCalendar`/`ContentItemList` เลิกใช้ platform icon-only mode จะไม่มีผู้เรียกใช้โหมดนี้เหลืออยู่เลยในทั้งระบบ — ลบทิ้งเพื่อไม่ให้เป็น dead code ที่ดูเหมือนยังใช้งานได้ (`NO MAGIC` — พฤติกรรมต้องชัดเจน ไม่มีโค้ดที่ไม่มีใครเรียกแต่ยังคงอยู่ให้สับสน) `PlatformBadgeList` เหลือแค่โหมด `pill` เดียว ยัง export `parsePlatforms()` เหมือนเดิมเพราะยังใช้อยู่ใน `ContentCardDialog`/`ContentDetailView`

**ทางเลือกที่พิจารณา**: เก็บ `icon-only` ไว้เผื่ออนาคตอยากใช้อีก — ปฏิเสธเพราะ component นี้เรียบง่ายพอที่จะเพิ่มโหมดกลับมาได้ง่ายถ้าจำเป็นจริงในอนาคต ไม่คุ้มที่จะแบกโค้ดที่ไม่มีจุดเรียกใช้ไว้ตอนนี้

### 4. คอลัมน์ ContentItemList: เปลี่ยนหัวคอลัมน์เป็น "ประเภท" และ sort key จาก `'platform'` เป็น `'type'`
หัวคอลัมน์และปุ่ม sort ต้องตรงกับข้อมูลที่แสดงจริงเสมอ — เปลี่ยน `SortKey` union จาก `'platform'` เป็น `'type'` และ comparator จาก `a.platform.localeCompare(b.platform)` เป็นเทียบ `getCanonicalContentType(a)` กับ `getCanonicalContentType(b)` (สตริง 'article'/'video' เทียบกันตรงๆ พอ เพราะมีแค่ 2 ค่า)

Search filter (บรรทัดที่ match `item.platform?.toLowerCase().includes(q)`) **ไม่แก้** —ยังค้นหาจากข้อมูลแพลตฟอร์มดิบได้ต่อไป แม้จะไม่แสดงในคอลัมน์แล้ว เพราะเป็นการค้นข้อมูลจริงของ item ไม่ใช่การแสดงผล คนละเรื่องกับที่ change นี้แก้

## Risks / Trade-offs

- **[Risk]** ผู้ใช้ที่คุ้นกับการกวาดตาดูสีแพลตฟอร์มบนปฏิทินแบบเดิม (ก่อน `platform-color-catalog` ด้วยซ้ำ ที่เคยใช้สีแพลตฟอร์มมานาน) จะไม่เห็นข้อมูลนี้บนปฏิทินอีกต่อไป ต้องคลิกเปิด dialog ถึงจะเห็น → ยอมรับ trade-off นี้ตามที่ผู้ใช้ยืนยันชัดเจนแล้วว่าต้องการให้ประเภทเนื้อหาเป็นสัญญาณหลักแทน
- **[Trade-off]** `ContentItemList`'s sort-by-type จะมีแค่ 2 กลุ่ม (บทความ/วีดีโอ) ทำให้การเรียงมีประโยชน์จำกัดกว่าการเรียงตามแพลตฟอร์มเดิม (ซึ่งมีให้เลือกหลายค่ากว่า) — ยอมรับเพราะเป็นผลตรงไปตรงมาจากการเปลี่ยนคอลัมน์ตามที่ตกลง ผู้ใช้ยังกรองตามแพลตฟอร์มได้จาก `platformFilter` แถบด้านบนอยู่เหมือนเดิม (ไม่เกี่ยวกับ sort ในคอลัมน์นี้)

## Migration Plan

ไม่มี schema migration — frontend ล้วน ไม่มี breaking change ต่อ API หรือฐานข้อมูล ส่วนที่ถือเป็น breaking ในระดับ UI (หัวคอลัมน์/sort key เปลี่ยนความหมาย) ไม่ต้องมี migration path เพราะเป็น state ชั่วคราวใน component (sort key ที่เลือกไว้ไม่ persist ข้าม session)

Rollback: revert commit เดียวได้ทั้งหมด ไม่มี state ค้างต้อง cleanup

## Open Questions

- ไม่มี — ขอบเขต (พื้นหลัง chip เปลี่ยนเป็นสีตามประเภทล้วน ไม่ผสมกับสีแพลตฟอร์ม, list view ได้ badge เต็มไม่ใช่แค่ไอคอน, ลบ icon-only variant ที่ตายแล้ว) ถูกตัดสินใจร่วมกับผู้ใช้แล้วในขั้น explore ก่อนเปิด change นี้
