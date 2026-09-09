## Context

Direct Create (`QuickCreateDialog` + shared `generate-article` in `api/brand-content.php`, also used by `BatchGenerateDialog`) ปัจจุบันใช้ **ตัวแปรเดียว** (`content_items.type` = `article`/`video`, เรียกในโค้ดว่า `$isVideo`) ควบคุมพร้อมกัน 3 เรื่องที่ควรเป็นอิสระต่อกัน:

1. วิธีเขียน Core Article (บทความยาว vs โครงวิดีโอ)
2. รายชื่อ platform ที่เลือกได้ใน UI (`QuickCreateDialog.tsx:111-113`: `ARTICLE_PLATFORMS` กับ `VIDEO_PLATFORMS` ไม่ overlap กันเลย — เลือก Video แล้วเลือก WordPress/Facebook ไม่ได้)
3. ว่าจะขอ/แสดง `script_sections` หรือไม่ (ขอจาก AI แบบไม่มีเงื่อนไขทั้งสอง branch ที่ `brand-content.php:2417,2437`; UI แสดงแบบไม่มีเงื่อนไขที่ `ContentCardDialog.tsx:554`)

ผลคือ (ยืนยันจากโค้ดจริงระหว่าง explore):
- สร้าง Content ที่มีทั้ง Website + Facebook + TikTok ในการรันเดียวผ่าน QuickCreateDialog ไม่ได้เลย
- Content ที่เลือกแค่ platform ที่ไม่ใช่วิดีโอ ก็ยังได้ `script_sections` ที่ไม่มีประโยชน์ติดมาด้วย และ UI แสดงบล็อกที่ไม่มีความหมาย
- เมื่อ `type=video`, prompt schema ไม่มี key `full_html` เลย (`brand-content.php:2413-2420`) ทำให้ fallback ที่ `brand-content.php:2536-2545` ต้องพึ่ง `scripts['facebook']` เป็นเนื้อหา Core Article — ถ้าไม่ได้เลือก Facebook ด้วย Core Article จะไม่มีเนื้อหาเลยนอกจาก title/excerpt (สังเกตได้จาก spec `content-type-selection` เองที่ระบุพฤติกรรมนี้ไว้ตรงๆ ว่า "ไม่สร้าง full_html แบบบทความ" เมื่อ type=video — เป็น spec'd behavior ที่ต้องแก้ ไม่ใช่บั๊กที่ไม่มีคนตั้งใจ)

Batch (`BatchGenerateDialog.tsx`) ไม่มีปัญหาข้อ 2 อยู่แล้ว (เลือก platform จาก `Object.entries(PLATFORM_MAP)` ทั้งหมดอิสระ ไม่ผูกกับ contentType) แต่ยังโดนปัญหาข้อ 3 เหมือนกันเพราะใช้ `generate-article` ตัวเดียวกัน

## Goals / Non-Goals

**Goals:**
- แยก 3 เรื่องข้างต้นออกจากกัน: Content Type คุมแค่ (1) วิธีเขียน Core Article เท่านั้น
- (2) และ (3) ถูก derive จาก **ชนิดของ platform ที่เลือก** ผ่าน shared constant ตัวเดียว ไม่ผูกกับ Content Type
- Core Article ต้องมีเนื้อหาจริงเสมอ ไม่ว่า Content Type จะเป็นอะไร ไม่พึ่งพา platform ใดโดยเฉพาะเป็น source
- ไม่แตะ field name, JSON structure, หรือ DB schema ใดๆ ที่มีอยู่ — แก้แค่เงื่อนไข "เมื่อไหร่จะสร้าง/แสดง"
- Batch ไม่ต้องแก้โค้ดเลย ได้ผลดีขึ้นจาก backend fix โดยอัตโนมัติ

**Non-Goals:**
- ไม่ทำ LinkedIn Post-vs-Article configuration (ไม่มี infra รองรับอยู่แล้ว, deferred ตามที่ตกลงกับผู้ใช้)
- ไม่ restructure เป็น field ใหม่ (`social_outputs`/`video_outputs`) — เลือกทางเลือก "safe" ตามที่ผู้ใช้ยืนยัน
- ไม่แก้ `SCRIPT_PLATFORMS` ใน `publish-dispatch.php` (routing gate web vs social) — เป็นคนละแกนกับ "ต้องการ Script Sections หรือไม่" แม้จะใช้ platform list คล้ายกัน
- ไม่ retroactively แก้ content เก่าที่เคยถูกสร้างด้วย full_html ว่างเปล่า — ใช้ได้กับ generation ใหม่เท่านั้น
- ไม่แตะ feature "สร้างวิดีโอด้วย AI" (`generate-video`, video_url, video player ใน `content-video-ui-section` spec) — เป็นคนละฟีเจอร์ (สร้างไฟล์วิดีโอจริงจาก scene images) ไม่เกี่ยวกับ Core Article/Script text

## Decisions

### 1. Shared constant `VIDEO_SCRIPT_PLATFORMS = ['tiktok', 'youtube']` เป็น pure function ที่ทดสอบได้
กำหนด platform ที่ "ต้องการ Script + Script Sections เสมอไม่ว่า Content Type จะเป็นอะไร" ไว้ที่เดียว ใช้ทั้ง 2 ฝั่ง:
- Backend: เพิ่มใน `api/lib/content-plan-prompt.php` (ไฟล์นี้มี pure function อื่นๆ ของ generation pipeline อยู่แล้วตาม docblock เดิม "แยกออกมาเป็น pure function เพื่อให้ทดสอบได้") เป็น `content_needs_script_sections(array $selectedPlatforms): bool` — `brand-content.php` เรียกใช้แทนการเช็ค `$isVideo` ตรงๆ ข้อดี: ทดสอบ logic นี้แบบ unit test ได้โดยไม่ต้องพึ่ง DB/AI call เหมือน pure function อื่นในไฟล์เดียวกัน
- Frontend (`src/components/content/types.ts` — ที่เดียวกับ `PLATFORM_MAP`): export `VIDEO_SCRIPT_PLATFORMS` และ helper `platformsNeedScriptSections(platforms: string[]): boolean` ใช้ตัดสินว่าจะแสดงบล็อก "โครงสร้างบท (Script Sections)" ใน `ContentCardDialog.tsx` ไหม

**ทางเลือกที่ปฏิเสธ**: ใช้ `scriptCapablePlatforms`/`SCRIPT_PLATFORMS` เดิม (7 platform) แทน — ปฏิเสธเพราะ list นั้นปนกัน platform วิดีโอ (TikTok/YouTube) กับ platform ที่แค่ต้องการ Post/Caption (Facebook/Instagram/LinkedIn/Twitter/LineOA) ซึ่งเป็นสาเหตุของปัญหาที่กำลังแก้อยู่พอดี

### 2. คง `scripts[platform]` ไว้สำหรับทั้ง 7 platform เดิม ไม่แยก field ใหม่
Facebook/Instagram/LinkedIn/Twitter/LineOA ยังคงได้ text ที่ปรับให้เหมาะกับ platform (Post/Caption) เก็บใน `scripts[platform]` เหมือนเดิม — เปลี่ยนแค่ `script_sections` ให้มีเงื่อนไข ไม่แตะ `scripts`
**ทางเลือกที่ปฏิเสธ**: แยกเป็น `social_outputs`/`video_outputs` ใหม่ — ตรงกับ target architecture ในเอกสารต้นฉบับมากกว่า แต่ผู้ใช้ยืนยันเลือกทาง safe เพื่อเลี่ยงความเสี่ยง backward-compat กับ content เก่าและโค้ดที่อ่าน `scripts[platform]` อยู่หลายจุด (ContentCardDialog, ContentVideoView, publish-dispatch)

### 3. Core Article ต้องได้เนื้อหาเสมอ — ขอ body จาก AI ทั้งสอง branch, เลิก fallback ไปที่ script ของ Facebook
แก้ video-branch prompt schema ให้มี key เนื้อหาบทความ (เช่น `full_html` หรือ field ที่สื่อความหมายเดียวกัน) เสมอ ไม่ว่า platform ที่เลือกจะมีอะไรบ้าง โดยปรับคำสั่งให้ AI เขียนเป็น "สรุป/เนื้อหาประกอบวิดีโอ" แทนบทความยาวแบบ type=article (ยังคงความแตกต่างของโทน/ความยาวตาม Content Type ไว้) และแก้ fallback (กรณี AI ไม่ส่ง field นี้มาจริงๆ) ให้สร้างจาก `excerpt` + รายการ `visuals`/scene description แทนการไปหยิบ `scripts['facebook']` มาใช้ — Core Article ต้องไม่พึ่งพา platform ใดโดยเฉพาะเป็น source
**ทางเลือกที่ปฏิเสธ**: ปล่อย type=video ไม่มี full_html ต่อไป แล้วให้ UI render Core Article section จาก excerpt/scene ตรงๆ แทน — ปฏิเสธเพราะเพิ่ม code path แยกสองแบบใน UI (ArticleEditor คาดหวัง HTML string) และไม่แก้ปัญหาที่ต้นตอ (Core Article ยังคง "ไม่มีตัวตน" ของตัวเอง ต้องพึ่ง field อื่น)

### 4. ปลดล็อก platform list ใน QuickCreateDialog ให้ตรงแบบเดียวกับ Batch
รวม `ARTICLE_PLATFORMS`/`VIDEO_PLATFORMS` เป็น list เดียว (อิง `Object.keys(PLATFORM_MAP)` เหมือนที่ `BatchGenerateDialog.tsx` ทำอยู่แล้ว เพื่อความสอดคล้อง) Content Type ยังใช้กำหนด default preselected platform เมื่อผู้ใช้สลับ toggle (เช่น สลับเป็น Video → preselect TikTok) แต่ไม่ปิดกั้นตัวเลือกอื่นอีกต่อไป
**ทางเลือกที่ปฏิเสธ**: คง QuickCreateDialog behavior เดิมไว้ทั้งหมด (ไม่แก้ UX) — ปฏิเสธเพราะทำให้ Test Case ที่ requirement ต้องการ (Website+Facebook+TikTok ในการรันเดียว) เป็นไปไม่ได้ผ่าน Direct Create เลย ขัดกับเป้าหมายหลักของงานนี้ตรงๆ

### 5. UI gating: Script Sections แสดงเฉพาะเมื่อมี platform วิดีโอถูกเลือก
`ContentCardDialog.tsx` เปลี่ยนเงื่อนไขจาก `scriptSections && Object.keys(scriptSections).length > 0` เป็นเพิ่มเงื่อนไข `platforms.some(p => VIDEO_SCRIPT_PLATFORMS.includes(p))` ด้วย — ผลข้างเคียงที่ตั้งใจ: content เก่าที่มี `script_sections` ค้างอยู่แต่ไม่ได้เลือก platform วิดีโอ (เช่นถูกแก้ไข platform ภายหลัง) จะไม่แสดงบล็อกที่ไม่เกี่ยวข้องอีกต่อไป โดยไม่ต้องลบข้อมูลใดๆ ออกจาก DB (safe, non-destructive)

## Risks / Trade-offs

- **[Risk]** Content วิดีโอเก่าที่เคยถูกสร้างด้วย full_html ว่างเปล่า (หรือพึ่ง Facebook fallback) จะไม่ถูกแก้ย้อนหลังโดยอัตโนมัติ → **Mitigation**: อยู่นอกสโคป ผู้ใช้ที่เจอ content เก่าแบบนี้ใช้ปุ่ม "AI เขียนให้" (regenerate) ที่มีอยู่แล้วเพื่อสร้างใหม่ตาม logic ที่แก้แล้วได้
- **[Risk]** แม้จะขอ full_html จาก AI เสมอสำหรับ video type แต่ AI (LLM) อาจยังคงไม่ส่งกลับมาครบทุกครั้ง (ตามธรรมชาติของ generation) → **Mitigation**: fallback ใหม่สร้างจาก `excerpt`+`visuals` (ข้อมูลที่ Core Content มีอยู่แล้วเสมอ) แทนที่จะพึ่ง platform เฉพาะเจาะจงที่อาจไม่ถูกเลือก — รับประกันว่า Core Article จะไม่ว่างเปล่าอย่างสิ้นเชิงอีกต่อไป แม้ AI จะไม่ให้ full_html มา
- **[Trade-off]** Facebook/Instagram/LinkedIn/Twitter/LineOA ยังคงถูกเรียกว่า "Scripts" ใน UI label และ field เดิม (`scripts[platform]`) ทั้งที่จริงคือ Post/Caption — ยอมรับ trade-off นี้ตามการตัดสินใจเลือกทาง "safe" ของผู้ใช้ ไม่ใช่ bug ที่ต้องแก้ในงานนี้
- **[Trade-off]** ปลดล็อก platform list ใน QuickCreateDialog เปลี่ยน UX ที่ผู้ใช้เห็น (ตัวเลือกเยอะขึ้น ไม่ถูกกรองตาม Content Type) — ยอมรับเพราะจำเป็นต่อการรองรับ mixed-platform scenario ที่เป็นเป้าหมายหลัก และ Batch ก็ใช้แบบนี้อยู่แล้วโดยไม่มีปัญหา

## Migration Plan

ไม่มี database migration Deploy เป็นโค้ดล้วน — แนะนำ deploy backend (`brand-content.php`) พร้อมกับ frontend (`QuickCreateDialog.tsx`, `ContentCardDialog.tsx`, `types.ts`) ในรอบเดียวกัน เพื่อไม่ให้ UI ใหม่ (ที่คาดหวัง gating ตาม platform) ทำงานกับ backend เก่าที่ยังส่ง `script_sections` แบบไม่มีเงื่อนไข (หรือกลับกัน) Rollback ทำได้ด้วย revert commit เดียว ไม่ต้อง migration ย้อนกลับ

## Open Questions

ไม่มี — ตัดสินใจครบทั้ง 3 จุดจากการพูดคุยใน explore mode ก่อนหน้านี้แล้ว (ปลดล็อก platform / ข้าม LinkedIn config / แก้แบบ safe)
