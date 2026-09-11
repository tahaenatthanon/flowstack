## 1. Component กลางสำหรับ type badge

- [x] 1.1 สร้าง `src/components/content/ContentTypeBadge.tsx` — export component รับ `{ contentType: string | null | undefined; variant: 'pill' | 'icon-only'; size?: number; className?: string }` resolve ประเภทผ่าน `getCanonicalContentType({ content_type: contentType })` (reuse ตรงๆ ไม่เขียน logic แยก 'video'/'article' ซ้ำ) ก่อนเลือกไอคอน/สีจาก `TYPE_MAP`
- [x] 1.2 `variant="icon-only"` render เฉพาะไอคอนจาก `TYPE_MAP[type].icon` สีตาม `TYPE_MAP[type].color` (แยกเอาแค่ text-color class ส่วนแรก ไม่พ่วง bg) ไม่มี label
- [x] 1.3 `variant="pill"` render ไอคอน + label ในกล่องมน (สไตล์อ้างอิง `PlatformBadgeList`'s pill variant เดิม) สีจาก `TYPE_MAP[type].color` เต็มสตริง (รวม bg + dark mode)

## 2. ปฏิทิน — เปลี่ยนจาก platform icon เป็น type badge

- [x] 2.1 `ContentPlannerCalendar.tsx` (`renderItemChip`) — ลบการเรียก `parsePlatforms`/`getPlatformColors`/`PlatformBadgeList` ทั้งหมด
- [x] 2.2 เปลี่ยน chip background/text จาก `style={{backgroundColor: colors.bg, color: colors.text}}` (hex) เป็น `className` จาก `TYPE_MAP[getCanonicalContentType(item)].color` (Tailwind class มี dark mode ในตัว)
- [x] 2.3 แทนที่ `<PlatformBadgeList variant="icon-only">` เดิมด้วย `<ContentTypeBadge contentType={item.content_type} variant="icon-only" size={10} />`
- [x] 2.4 ตรวจสอบว่าไอคอน Lock (จาก `lock-published-content-date`) ยังแสดงคู่กับ type badge ได้ตามปกติ ไม่ถูกเบียดหาย — ยังเป็น sibling element เดิมในแถว flex เดียวกัน ไม่ได้แก้โครงสร้าง

## 3. มุมมองรายการ — เปลี่ยนคอลัมน์แพลตฟอร์มเป็นคอลัมน์ประเภท

- [x] 3.1 `ContentItemList.tsx` — เปลี่ยน `SortKey` union จาก `'platform'` เป็น `'type'`
- [x] 3.2 เปลี่ยน comparator ใน `sort()` จากเทียบ `a.platform`/`b.platform` เป็นเทียบ `getCanonicalContentType(a)`/`getCanonicalContentType(b)`
- [x] 3.3 เปลี่ยนหัวคอลัมน์ `renderSortBtn('platform', 'แพลตฟอร์ม')` เป็น `renderSortBtn('type', 'ประเภท')`
- [x] 3.4 แทนที่เนื้อหาคอลัมน์ (เดิมคือ `<PlatformBadgeList variant="icon-only">` หรือ "-") ด้วย `<ContentTypeBadge variant="pill" />` — content type ไม่มีทางว่างเปล่า (ทุก content item มี `type` เสมอ) จึงไม่ต้องมี fallback "-" เหมือนที่คอลัมน์แพลตฟอร์มเคยมี
- [x] 3.5 ตรวจสอบว่า search filter ที่ match `item.platform` (บรรทัดใกล้เคียง) ยังคงเดิม ไม่ต้องแก้ (ค้นข้อมูลจริง ไม่ใช่สิ่งที่แสดงในคอลัมน์) — ยืนยันแล้วว่าไม่ได้แตะบรรทัดนั้น

## 4. ลบโค้ดที่ไม่มีผู้ใช้แล้ว

- [x] 4.1 `PlatformBadgeList.tsx` — ลบ branch `variant === 'icon-only'` และตัด `'icon-only'` ออกจาก type union ของ `variant` prop (เหลือแค่ `'pill'`)
- [x] 4.2 ตรวจสอบว่าไม่มีไฟล์อื่นเรียก `<PlatformBadgeList variant="icon-only">` เหลืออยู่ (`grep -r "icon-only"`) — ยืนยันแล้วว่าไม่มี (มีแค่ test file ซึ่งจัดการใน 4.3 และ ContentTypeBadge ซึ่งเป็นคนละ component)
- [x] 4.3 ปรับ/ลบ test ใน `PlatformBadgeList.test.tsx` ที่ทดสอบ `variant="icon-only"` ของแพลตฟอร์ม (ย้าย coverage ไปที่ `ContentTypeBadge.test.tsx` แทนถ้าเนื้อหาเกี่ยวข้อง) — ลบ describe block เดิมออก เหลือแค่ `parsePlatforms` + `variant="pill"` และอัปเดต docstring บนสุดของไฟล์ให้ตรงกับผู้ใช้ปัจจุบัน

## 5. Verification

- [x] 5.1 `pnpm lint` และ `tsc --noEmit` — 0 errors ทั้งคู่ warning เท่าเดิม (48) ไม่มีของใหม่จากไฟล์ที่แก้
- [x] 5.2 `pnpm test` — เพิ่ม `ContentTypeBadge.test.tsx` ใหม่ 6 test (pill/icon-only × บทความ/วีดีโอ/fallback ค่า null และ 'image') เพิ่ม 4 test ใน `ContentPlannerCalendar.test.tsx` (สี chip ตามประเภท, 7 แพลตฟอร์ม vs 1 แพลตฟอร์มแสดงเหมือนกัน, Lock+type badge อยู่ด้วยกันได้) `ContentItemList` ไม่มี test เดิม (ถูก mock เป็น `() => null` ในทุก test ที่อ้างถึง ไม่มีอะไรต้องแก้) รวม 225/225 ผ่านทั้งหมด (32 ไฟล์)
- [x] 5.3 `pnpm build` — สำเร็จ ไม่มี error (คำเตือน chunk size เป็นของเดิม)
- [x] 5.4 ทดสอบ manual ในเบราว์เซอร์จริงที่ localhost:8080 (mint JWT ท้องถิ่นแบบเดียวกับ 2 change ก่อนหน้า) — ทุกกรณีตรงตามคาดผ่านการเช็ค DOM/JS ตรงๆ:
  - content item 7 แพลตฟอร์ม (`5e1ea0ed-fb2c-4f9d-8b22-41304ccf97a8`) ใน bucket "ยังไม่กำหนดวันที่" → chip มี class `text-blue-500 bg-blue-50 dark:bg-blue-950`, มี `<svg>` แค่ 1 อัน (ไม่มีไอคอนแพลตฟอร์มเหลือเลย)
  - พบ chip วีดีโอจริงบนปฏิทิน → class `text-red-500 bg-red-50 dark:bg-red-950` ถูกต้อง
  - สลับมุมมองรายการ → หัวคอลัมน์ทั้งชุดเป็น `["หัวข้อ","ประเภท","วันที่","แผน","แคปชั่น","จัดการ"]`, content item เดียวกันแสดง badge "บทความ" (ไม่ใช่ไอคอนแพลตฟอร์ม), แถวยัง `opacity:0.7` ตาม lock feature เดิม (ไม่ถูกกระทบ), กดปุ่ม sort "ประเภท" แล้ว 18 บทความเรียงมาก่อน 3 วีดีโอถูกต้อง
  - เปิด dialog ของ content item 7 แพลตฟอร์มเดียวกัน → header ยังโชว์ "FacebookLinkedInTwitter / XInstagramLine OAWordPressWix" ครบ (ContentCardDialog ไม่ถูกกระทบ)
  - เปิดแท็บเบราว์เซอร์ใหม่ล้วนๆ (fresh context ไม่มี cache) → console สะอาด ไม่มี error เลย ยืนยันว่า error "PlatformBadgeList is not defined" ที่เจอตอนแรกในแท็บเดิมเป็นแค่ Vite HMR artifact ชั่วคราวตอนแก้ไฟล์สดๆ (dev server รันข้ามหลาย change ต่อเนื่องมาโดยไม่เคย restart) ไม่ใช่บั๊กจริงในซอร์ส — ยืนยันด้วย `grep PlatformBadgeList src/components/content/ContentItemList.tsx` ไม่เจอ, `tsc --noEmit`/`pnpm build` สะอาดทั้งคู่
