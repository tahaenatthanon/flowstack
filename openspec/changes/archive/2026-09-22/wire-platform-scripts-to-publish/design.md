## Context

`article_content.scripts` ถูกสร้างโดย `generate-article`/`generate-plan` (`api/brand-content.php`) แยกเนื้อหาต่อ platform ไว้แล้วตามที่ `platformScriptGuidance` (`api/lib/content-plan-prompt.php`) สั่ง AI ไว้ — key คือชื่อ platform (`facebook`, `instagram`, `tiktok`, `youtube`, `lineoa`, `linkedin`, `twitter`) ที่อยู่ใน `$scriptCapablePlatforms` เท่านั้น และถูก filter ด้วย `array_intersect_key(..., array_flip($scriptPlatforms))` ก่อนบันทึกเสมอ (4 จุดใน `brand-content.php`) — เพราะงั้นข้อมูลที่มีอยู่ใน DB วันนี้ **ถูกต้องอยู่แล้ว** ปัญหาทั้งหมดอยู่ที่ฝั่งใช้งาน (consumption) ไม่ใช่ฝั่งสร้าง

จุดที่เนื้อหาถูกเผยแพร่จริงมี 2 เส้นทาง ทั้งคู่ลงเอยที่ `publish_via_central_flow()` (`api/lib/publish-dispatch.php:388`):
- `content-publish.php?action=send_now` — ส่งทันที
- `api/cron/publish-scheduler.php` — ตั้งเวลาแล้ว cron มาส่งภายหลัง

ทั้งสองเส้นทางรับ `$contentOverride` (ต่อ channel) เป็น parameter อยู่แล้ว และถ้าไม่ว่าง จะ**ทับ** `$content['caption']` และ `$content['article_content']['html']` ก่อนส่งต่อให้ `dispatch_content()` (บรรทัด 442-447) — กลไกนี้สมบูรณ์แล้ว ไม่ต้องแก้ backend เลย

ปัญหาอยู่ที่ `SchedulePublishDialog.tsx` (จุดเดียวที่สร้างค่า `channel_overrides` ส่งเข้ากลไกนี้): มี state `socialCaption` ตัวเดียว และ `buildOverrides()` วน assign ค่าเดียวกันให้ **ทุก** social channel ที่เลือก ไม่ว่าจะเป็น platform ไหน — เท่ากับ override ที่ควรจะต่างกันต่อ platform กลับเป็นค่าเดียวกันหมดอยู่ดี

## Goals / Non-Goals

**Goals:**
- ค่าเริ่มต้นของข้อความที่จะเผยแพร่ต่อ social channel มาจาก `scripts[platform]` ของ platform นั้นโดยเฉพาะ
- ผู้ใช้ยังแก้ไขข้อความต่อ channel ได้ก่อนกดส่งเหมือนเดิมทุกประการ (ไม่ลด flexibility เดิม)
- Fallback ไป `caption` เดิมทันทีเมื่อไม่มี script ของ platform นั้น — ไม่ error ไม่ค้าง
- แก้ `ContentVideoView.tsx` ให้ sub-tab ตรงกับ platform ที่เลือกไว้จริงเท่านั้น

**Non-Goals:**
- ไม่แก้ backend (`dispatch_content`, `publish_via_central_flow`, `content-publish.php`, `publish-scheduler.php`) — ใช้กลไก `content_override` เดิมทั้งหมด
- ไม่แก้การสร้าง `scripts[platform]` (prompt/schema ฝั่ง AI) — ข้อมูลถูกต้องอยู่แล้ว
- ไม่แก้ platform ที่ไม่มี script (`wordpress`, `wix`, `lotusdomino`, `custom`) — ยังใช้ `articleBody` เหมือนเดิม
- ไม่แก้บั๊กอื่นที่พบระหว่างตรวจโค้ด (YouTube ไม่มี dispatch, TikTok ไม่แนบ video, LINE OA ไม่แนบรูป, WordPress ไม่มี featured image, Instagram บังคับต้องมีรูป) — เก็บเป็นงานแยกตามที่ตกลงไว้

## Decisions

### 1. Prefill ต่อ platform ไม่ใช่ต่อ channel id

แม้ `channel_overrides` จะ key ด้วย `channel.id` (เผื่อ 1 platform มีได้หลาย channel ในอนาคต) แต่ dialog ปัจจุบัน**ล็อกให้เลือกได้แค่ 1 channel ต่อ 1 platform ในการส่งครั้งเดียว** (`samePlatformSelected` lock ที่ `toggleChannel`) — เพราะงั้น derive ค่า default จาก `ch.platform` (lowercase) แล้ว map เข้า `channel.id` ตอนสร้าง override ก็เพียงพอ ไม่ต้องเปลี่ยนโครง `channel_overrides` ที่ backend รับอยู่แล้ว

**ทางเลือกที่ไม่เลือก**: เปลี่ยน `content_override` ให้ key ด้วย platform แทน channel id — ต้องแก้ backend/DB schema โดยไม่จำเป็น เพราะข้อจำกัด "1 channel ต่อ 1 platform" มีอยู่แล้วในระดับ UI

### 2. ตัดคำกำกับฉากด้วย regex ฝั่ง frontend ตอน prefill เท่านั้น

`scripts['tiktok']`/`scripts['youtube']` มีรูปแบบตายตัวจาก prompt schema (`api/brand-content.php`):
```
tiktok:  "Hook 3 วิ: ...\nScene 1: ...\nScene 2: ...\nCTA: ..."
youtube: "Intro: ...\nSection 1: ...\nSection 2: ...\nOutro: ..."
```
ใช้ regex ตัดคำกำกับต้นบรรทัดแบบ `/^(Hook\s*\d*\s*วิ|Scene\s*\d+|Intro|Outro|Section\s*\d+|CTA)\s*:\s*/gim` ทีละบรรทัด ก่อนต่อบรรทัดกลับด้วย `\n` เดิม — เก็บเนื้อความจริงไว้ครบ ตัดแค่ label

Platform อื่น (`facebook`, `instagram`, `lineoa`, `linkedin`, `twitter`) format จาก schema ไม่มีคำกำกับฉากแบบนี้อยู่แล้ว (เช่น `"Post caption: ...\nCTA: ..."` — "Post caption:"/"CTA:" เป็นส่วนหนึ่งของโครงสร้างโพสต์ปกติ ไม่ใช่คำกำกับฉากถ่ายทำ) จึงใช้ตรงได้โดยไม่ต้อง clean

**ทางเลือกที่ไม่เลือก**: ให้ backend clean แล้วเก็บเป็น field แยก (เช่น `scripts_clean`) — เพิ่ม field ใหม่โดยไม่จำเป็น เพราะ cleaning เป็น pure text transform ที่ทำตอน prefill (runtime) ได้พอ ไม่ต้อง persist

### 3. แก้ 3 จุดเรียก `<SchedulePublishDialog>` ให้ parse `scripts` เหมือนที่ parse `.html` อยู่แล้ว

ทั้ง `ContentArticleView.tsx`, `ContentDetailView.tsx`, `ContentListTab.tsx` มี `try { JSON.parse(item.article_content) }` เพื่อดึง `.html` มาเป็น `defaultBody` อยู่แล้วทั้ง 3 จุด — เพิ่มการดึง `.scripts` ในจุดเดียวกัน ส่งเป็น prop ใหม่ `scripts` (type `Record<string, string>`) เข้า `SchedulePublishDialog`

### 4. `ContentVideoView.tsx` sub-tab ใช้ `Object.keys(art.scripts ?? {})` แทน hardcode array

เปลี่ยนจาก `(['tiktok','youtube','instagram','facebook'] as const).map(p => ...)` เป็นวนตาม key จริงใน `art.scripts` — ให้ตรงกับวิธีที่ `ContentCardDialog.tsx` (`Object.entries(scripts)`) ทำอยู่แล้ว ผลคือถ้าไม่มี key นั้นใน `scripts` จะไม่มีแท็บให้กดเลย (ไม่ใช่มีแท็บแต่กดแล้วว่าง)

## Risks / Trade-offs

- **[Risk]** Content เก่าที่สร้างก่อน field `scripts` มีอยู่ (หรือ AI ไม่ได้เขียน key ของ platform ที่เลือกไว้) จะไม่มีอะไรให้ prefill เลย → **Mitigation**: fallback ไป `caption` ทันที (เหมือนพฤติกรรมปัจจุบัน) ไม่แสดง textarea ว่างเปล่าโดยไม่มีคำอธิบาย
- **[Risk]** Regex ตัดคำกำกับฉากอาจพลาดรูปแบบที่ AI เขียนไม่ตรง pattern เป๊ะ (เช่น "ฉากที่ 1:" แทน "Scene 1:") → **Mitigation**: regex เป็น best-effort ไม่ error ถ้าไม่ match (แค่ไม่ตัดบรรทัดนั้น) ผู้ใช้ยังแก้ไขข้อความได้เองก่อนส่งอยู่ดี ไม่ใช่ hard requirement ที่ต้องสมบูรณ์แบบ 100%
- **[Trade-off]** ผู้ใช้ที่เคยพิมพ์ `socialCaption` เดียวคลุมทุก platform (workflow เดิม) จะเจอ textarea แยกต่อ platform เพิ่มขึ้น (ต้องเช็ค/แก้หลายกล่องแทนกล่องเดียว) — ยอมรับ trade-off นี้เพราะเป็นเป้าหมายของงานนี้โดยตรง (เนื้อหาต้องต่างกันต่อ platform)

## Migration Plan

ไม่มี migration ฐานข้อมูล — เป็นการเปลี่ยน default value ที่ prefill ในฟอร์มเท่านั้น ไม่มีการย้ายข้อมูลเก่า Rollback คือ revert commit ของ frontend เพียงอย่างเดียว

## Open Questions

- ถ้าเลือกหลาย social platform พร้อมกันในการส่งครั้งเดียว ต้องแสดง textarea แยกกี่กล่อง (1 ต่อ platform ที่เลือก) — ต้องยืนยัน UI ตอนเขียน tasks ว่าจะวางเป็น list ต่อ platform หรือ tab เหมือน `ContentVideoView`
