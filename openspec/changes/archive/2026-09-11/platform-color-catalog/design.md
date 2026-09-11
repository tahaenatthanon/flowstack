## Context

`content_items.platform` เก็บแพลตฟอร์มที่เลือกไว้ทั้งหมดเป็นสตริง comma-joined เดียว (เช่น `"facebook,linkedin,twitter,instagram,lineoa,wordpress,wix"` — ดู `ContentCardDialog.tsx:261` ตอน save) ในขณะที่ `content_items.platforms` เป็น JSON array ของค่าเดียวกัน ปัจจุบัน 3 จุด UI เอา `item.platform` (สตริงรวม) ไป lookup เป็นแพลตฟอร์มเดียวตรงๆ ทำให้พังเมื่อ item มีมากกว่า 1 แพลตฟอร์ม (เคสส่วนใหญ่ในข้อมูลจริง):

- `ContentCardDialog.tsx:543-551` — badge header โชว์สตริงดิบทั้งก้อน (`PLATFORM_MAP[existingItem.platform]` lookup พลาด → fallback เป็น raw string)
- `ContentPlannerCalendar.tsx:109,134` — `getPlatformColors(item.platform)`/`PlatformIcon platform={item.platform}` lookup พลาดเงียบๆ → สีเทา/ไอคอนโลกกลม default
- `ContentItemList.tsx:129,161-162` — เดียวกัน แต่ fallback โชว์ raw string เหมือน dialog

`ContentDetailView.tsx:285-298` มี logic ที่ทำถูกอยู่แล้ว: parse `item.platforms` (รองรับทั้ง JSON array, comma string, และ fallback จาก `item.platform.split(',')`) แล้ว normalize/dedupe/lowercase จากนั้น map แต่ละแพลตฟอร์มเป็น badge สีแยกกัน — เป็นต้นแบบที่ควรดึงออกมาใช้ซ้ำ แทนที่จะเขียนใหม่

พร้อมกันนั้น สี/label ของแพลตฟอร์มถูกนิยามซ้ำอยู่ในหลายที่:
- `PLATFORM_MAP` (`src/components/content/types.ts`) — `{label, color}` โดย `color` เป็น Tailwind class string มี `dark:` variant, ใช้อยู่ 16+ ไฟล์ (ส่วนใหญ่ใช้ `.label`)
- `PLATFORM_COLORS`/`getPlatformColors()` (`src/lib/platformConfig.ts`) — `{bg, text, border, filterBg, filterText}` เป็น hex ตรงๆ ไม่มี dark mode, ใช้ 6 ไฟล์ (เฉพาะจุดที่ต้องคำนวณสีแบบ dynamic เช่น toggle invert สีตอนเลือก filter — `ContentPlannerPage.tsx:468-478`)
- `PLATFORM_LABELS` ใน `AnalyticsSocialTab.tsx` — ซ้ำกับ label ใน `PLATFORM_MAP` เป๊ะๆ (มีแค่ facebook/instagram) ไม่มีเหตุผลให้แยก
- `PLATFORM_COLORS` ใน `ContentVideoView.tsx` — คนละชุดสีโดยเจตนา (โทนทึบเข้มสำหรับ badge ทับวิดีโอ ต่างจากโทนอ่อนที่อื่น) — ไม่ใช่ความซ้ำซ้อนที่ต้องแก้

ทั้งสองระบบหลัก (`PLATFORM_MAP`, `getPlatformColors`) ให้สีที่ใกล้เคียงกันแต่ไม่ตรงกันเป๊ะ (เช่น facebook: `bg-indigo-100`/`#4338ca` text vs `#eef2ff` bg/`#4338ca` text — เฉด bg ต่างกัน 50 vs 100) เป็นสัญญาณว่ามีคนแก้ทีละระบบแยกกันไปเรื่อยๆ โดยไม่รู้ว่ามีอีกระบบอยู่

## Goals / Non-Goals

**Goals:**
- มีแหล่งข้อมูล label/สี/ไอคอนของแพลตฟอร์มเพียงแหล่งเดียวที่ทุกระบบอ้างอิง ไม่มีการนิยามซ้ำที่ดริฟต์ออกจากกันได้อีก
- ทุกจุดที่แสดงแพลตฟอร์มของ content item ที่มีหลายแพลตฟอร์ม ต้องแสดงแยกทีละแพลตฟอร์มพร้อมสี/ไอคอนที่ถูกต้อง ไม่ตัดทอน (แสดงได้ครบตามจำนวนจริง สูงสุด 7 ตามแพลตฟอร์มที่ระบบรองรับ)
- ไม่ต้องแก้ import path ในไฟล์ที่ใช้ `PLATFORM_MAP`/`getPlatformColors` อยู่แล้ว (16+ ไฟล์) — เปลี่ยนแค่แหล่งข้อมูลข้างใน

**Non-Goals:**
- ไม่รวม `ContentVideoView.tsx`'s `PLATFORM_COLORS` เข้า catalog กลาง (เป็น variant ที่ตั้งใจแยก ไม่ใช่ความซ้ำซ้อน)
- ไม่เปลี่ยนโครงสร้างฐานข้อมูล (`content_items.platform`/`platforms` ยังเก็บรูปแบบเดิม) — เป็นการแก้เฉพาะฝั่งการแสดงผล
- ไม่เปลี่ยน business logic การเลือก/บันทึกแพลตฟอร์ม (`platforms.join(',')` ตอน save ยังเหมือนเดิม)
- ไม่แตะ backend (`api/`) — ปัญหาทั้งหมดอยู่ที่การตีความข้อมูลฝั่ง frontend

## Decisions

### 1. Catalog เดียวอยู่ที่ `src/lib/platformConfig.ts` ไม่ใช่ `types.ts`
`platformConfig.ts` เป็นไฟล์ lib เล็ก โฟกัสเฉพาะเรื่อง platform ไม่มี dependency อื่นพ่วง ส่วน `types.ts` เป็น barrel file ขนาดใหญ่ (500+ บรรทัด) รวมทุกอย่างตั้งแต่ `ContentItem`, SEO fields, ไปจนถึง status maps — ใส่ catalog หลักไว้ที่นั่นจะทำให้ยิ่งบวมและผูก concern ผิดที่

โครงสร้างใหม่: `platformConfig.ts` เก็บ `PLATFORM_CATALOG: Record<key, { label: string; hex: {bg,text,border}; colorClass: string /* รวม dark: แล้ว */ }>` เป็นแหล่งเดียว แล้ว export ฟังก์ชัน:
- `getPlatformColors(key)` — คืน hex object เหมือนเดิม (backward-compatible signature)
- `getPlatformColorClass(key)` — คืน Tailwind class string (ของใหม่ ทดแทนการอ่าน `.color` จาก `PLATFORM_MAP` ตรงๆ)
- `getPlatformLabel(key)` — คืน label (ของใหม่ เผื่ออยากเลิกพึ่ง `PLATFORM_MAP` ทั้งชุดในอนาคต)

`types.ts` ยังคง export `PLATFORM_MAP` เดิมไว้ (ไม่ลบ) แต่เปลี่ยนเป็นสร้างจาก `PLATFORM_CATALOG` แบบ derived (`Object.fromEntries` map เอา label+colorClass) เพื่อไม่ให้ import เดิม 16+ ไฟล์พัง

**ทางเลือกที่พิจารณา**: รวม catalog ไว้ใน `types.ts` แทน (`PLATFORM_MAP` เป็นของจริง, `platformConfig.ts` derived) — ปฏิเสธเพราะจะทำให้ `types.ts` ต้องรับผิดชอบข้อมูล hex/dark-mode ที่ไม่เกี่ยวกับ type definitions เลย และไฟล์ที่ import แค่ hex (`getPlatformColors`) จะต้องลาก dependency ของ `types.ts` ทั้งไฟล์ตามไปด้วยโดยไม่จำเป็น

### 2. เพิ่ม hex + dark-mode ให้ `getPlatformColors()` แทนที่จะยกเลิกมันไปใช้ Tailwind class ล้วน
จุดที่ใช้ `getPlatformColors()` อยู่ตอนนี้ (`ContentPlannerPage.tsx` filter toggle, `AnalyticsContentTab.tsx`, `ChannelManagementSection.tsx`) ต้องคำนวณสีแบบ dynamic ผ่าน `style={{...}}` (เช่น invert สีตอน active) ซึ่งทำด้วย raw hex ง่ายกว่า Tailwind class string มาก — เก็บ signature เดิมไว้ แค่ให้ค่าที่ถูกต้องตรงกับ `PLATFORM_MAP` เป๊ะ (ไม่ใช่ใกล้เคียง) และเพิ่มคู่สี dark-mode ให้ผู้เรียกเลือกใช้เมื่อจำเป็น (เดิมไม่มีเลย)

### 3. ดึง component กลางจาก pattern ที่ `ContentDetailView.tsx` ทำถูกอยู่แล้ว แทนเขียนใหม่
Component ใหม่ (ชั่วคราวเรียก `PlatformBadgeList`) รับ `platforms: string[]` (parse แล้ว, ยังไม่ normalize) ทำ normalize/dedupe/lowercase เดียวกับที่ `ContentDetailView` และ `ContentCardDialog`'s state hydration ทำอยู่แล้ว (สองที่นี้เขียน logic นี้ซ้ำกันเองอยู่แล้วด้วย) แล้ว render ตาม `variant`:
- `variant="pill"` — ไอคอน + label สี ต่อแพลตฟอร์ม (ใช้แทน badge เดี่ยวใน `ContentCardDialog` header, และแทน logic inline ใน `ContentDetailView`)
- `variant="icon-only"` — ไอคอนสีอย่างเดียว ไม่มี label ระยะห่างแคบกว่า (ใช้ใน `ContentPlannerCalendar` chip และคอลัมน์ `ContentItemList`)

ไม่ทำ truncation ("+N") ในทั้งสอง variant — แสดงครบทุกแพลตฟอร์มที่มีจริง (สูงสุด 7 ตามที่ระบบรองรับตอนนี้) ตามที่ตกลงไว้ตอน explore

**ทางเลือกที่พิจารณา**: ตัดที่ 3-4 ไอคอนแล้วโชว์ "+N" เหมือนที่ `ContentPlannerCalendar`'s day cell ทำกับจำนวน item — ปฏิเสธเพราะผู้ใช้ต้องการเห็นครบทุกแพลตฟอร์มโดยไม่ต้องคลิกเพิ่ม โดยยอมรับความเสี่ยงเรื่อง layout (ดู Risks)

### 4. ยุบเฉพาะ `AnalyticsSocialTab.tsx` เข้า catalog กลาง ไม่แตะ `ContentVideoView.tsx`
`AnalyticsSocialTab`'s `PLATFORM_LABELS` มีแค่ 2 entry ที่ค่าตรงกับ catalog หลักทุกตัวอักษร — ไม่มีเหตุผลทางดีไซน์ให้แยก จึงลบแล้วเรียก `getPlatformLabel()` จาก catalog กลางแทน ส่วน `ContentVideoView.tsx` ใช้โทนสีทึบเข้มโดยเจตนา (badge ทับวิดีโอต้องคมชัด ไม่ใช้โทนอ่อนแบบที่อื่นเพราะจะกลืนพื้นหลังวิดีโอ) — คงไว้เป็น local variant แยกต่างหาก ไม่ผสมเข้า catalog

## Risks / Trade-offs

- **[Risk]** คอลัมน์แพลตฟอร์มใน `ContentItemList.tsx` แคบมาก (`col-span-1` จาก grid 12 ช่อง) การใส่ไอคอนได้สูงสุด 7 อันแบบไม่ตัดทอนอาจทำให้แถวสูงขึ้นหรือไอคอน wrap เป็นหลายบรรทัดเมื่อ item เลือกไว้หลายแพลตฟอร์ม → **Mitigation**: `variant="icon-only"` ใช้ `flex-wrap` ให้ไอคอน wrap ได้ตามธรรมชาติแทนการ overflow ทะลุ column และยอมรับว่าแถวจะสูงไม่เท่ากันตามจำนวนแพลตฟอร์ม (เหมือนที่ column อื่นๆ ในตารางนี้ก็มีความสูงไม่คงที่อยู่แล้วจาก caption/topic ที่ยาวไม่เท่ากัน)
- **[Risk]** เปลี่ยนค่าสีที่ `getPlatformColors()` คืนให้ตรงกับ `PLATFORM_MAP` (แทนที่จะเป็นค่าเดิมของมันเอง) จะทำให้สีที่เคยเห็นในหน้าที่ใช้ `getPlatformColors()` อยู่แล้ว (filter toggle, analytics, channel management) **เปลี่ยนเฉดเล็กน้อย** (เช่น facebook bg จาก 50 เป็น 100) → **Mitigation**: เฉดใกล้เคียงกันมาก (hue เดียวกัน, ต่างแค่ 1 step ความเข้ม) ผลกระทบทางสายตาต่ำ และเป็นการแลกกับความถูกต้อง/สม่ำเสมอในระยะยาว
- **[Trade-off]** ต้อง refactor `ContentDetailView.tsx` ที่ทำงานถูกอยู่แล้วไปใช้ component กลาง แม้จะไม่มีบั๊กในตัวมันเอง — ทำเพื่อไม่ให้มี logic parse-and-render-per-platform ซ้ำกัน 2 ที่ (ที่นั่นกับที่ใหม่) ซึ่งจะดริฟท์ออกจากกันได้อีกในอนาคตถ้าไม่รวม

## Migration Plan

ไม่มี schema migration — เป็นการเปลี่ยนเฉพาะ frontend data source และ UI component ไม่มี breaking change ต่อ API หรือฐานข้อมูล deploy พร้อมกันได้ในรอบเดียว (data layer ต้องขึ้นก่อนหรือพร้อมกับ UI layer เพราะ UI layer เรียกใช้ accessor ใหม่)

Rollback: revert commit เดียวได้ทั้งหมด ไม่มี state ค้างต้อง cleanup เพราะไม่แตะฐานข้อมูล

## Open Questions

- ไม่มี — ขอบเขต (3 จุด UI + รวม catalog เต็มรูปแบบ), การจัดการ 2 map แคบ (ยุบ AnalyticsSocialTab, คง ContentVideoView), และนโยบายไม่ตัดทอนไอคอน (สูงสุด 7) ถูกตัดสินใจร่วมกับผู้ใช้แล้วในขั้น explore ก่อนเปิด change นี้
