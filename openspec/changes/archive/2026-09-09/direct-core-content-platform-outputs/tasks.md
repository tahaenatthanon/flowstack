## 1. Shared constant / pure function

- [x] 1.1 เพิ่ม `content_needs_script_sections(array $selectedPlatforms): bool` ใน `api/lib/content-plan-prompt.php` (pure function, คืน true เมื่อ platform ที่เลือกมี `tiktok` หรือ `youtube` อย่างน้อยหนึ่งรายการ) พร้อม constant `VIDEO_SCRIPT_PLATFORMS = ['tiktok', 'youtube']` ในไฟล์เดียวกัน
- [x] 1.2 เพิ่ม export `VIDEO_SCRIPT_PLATFORMS` และ helper `platformsNeedScriptSections(platforms: string[]): boolean` ใน `src/components/content/types.ts` (ค่าต้องตรงกับฝั่ง backend)

## 2. Backend — `generate-article` (`api/brand-content.php`)

- [x] 2.1 Video branch: เพิ่ม key เนื้อหา Core Article (เช่น `full_html`) ลงใน JSON schema ของ prompt แบบไม่มีเงื่อนไข (ขอเสมอ ไม่ว่า platform ที่เลือกจะมีอะไรบ้าง) ปรับคำอธิบายให้ AI เขียนแบบ "เนื้อหาประกอบ/สรุปวิดีโอ" ให้เหมาะกับ type=video (ไม่ใช่บทความยาวแบบ type=article)
- [x] 2.2 Video branch: เปลี่ยน key `script_sections` ใน JSON schema ให้ใส่แบบมีเงื่อนไข — เรียก `content_needs_script_sections($scriptPlatforms)` ก่อนต่อ string schema เข้า prompt (ถ้า false ไม่ใส่ key นี้ในสคีมาเลย)
- [x] 2.3 Article branch: เปลี่ยน key `script_sections` ใน JSON schema ให้มีเงื่อนไขเดียวกันกับ 2.2 (ปัจจุบันก็ไม่มีเงื่อนไขเหมือนกัน)
- [x] 2.4 แก้ fallback `$fullHtml` (จุดที่ `$aiHtml` ว่างเปล่า) — เลิกใช้ `$mainData['scripts']['facebook']` เป็นแหล่งเนื้อหา เปลี่ยนไปสร้างจาก `$mainData['excerpt']` + รายการ `$mainData['visuals']` แทน (ยังคง wrap ด้วย `<article>` เหมือนเดิม)
- [x] 2.5 ยืนยันว่า `$art['script_sections']` ที่ persist ยัง fallback เป็น `[]` เมื่อไม่ได้ขอ/ไม่ได้รับจาก AI — ตรวจแล้วทั้ง 3 จุด persist (initial + 2 repair-branch rebuild) ใช้ `$mainData['script_sections'] ?? []` ถูกต้องอยู่แล้ว ไม่ต้องแก้เพิ่ม
- [x] 2.6 Grep หา `$isVideo` ทั้งไฟล์ — พบเฉพาะจุดที่เกี่ยวกับ `tone`/`ciType`/prompt branch selection ที่ไม่เกี่ยวกับ script_sections; อีกสองจุดที่มีคอมเมนต์คล้ายกัน ("Fallback: convert visuals → scenes") อยู่ใน action `generate-scene-images`/`generate-video` คนละ action คนละฟีเจอร์ (สร้างไฟล์วิดีโอจริงจาก scene, นอกสโคปตาม design.md) ไม่ต้องแก้

## 3. Frontend — ปลดล็อก platform ใน `QuickCreateDialog.tsx`

- [x] 3.1 รวม `ARTICLE_PLATFORMS`/`VIDEO_PLATFORMS` เป็น list เดียว โดยอิง `Object.keys(PLATFORM_MAP)` (รูปแบบเดียวกับที่ `BatchGenerateDialog.tsx` ใช้อยู่แล้ว) แทนการมี 2 array แยก — เพิ่ม `lotusdomino` เข้ามาให้เลือกได้ด้วยเป็นผลพลอยได้ (เดิมหายไปจากทั้งสอง list เพราะ list แยกเก่าไม่ครบ `PLATFORM_MAP`)
- [x] 3.2 คง logic default preselection เดิมไว้ (`setSelPlatforms(type === 'video' ? ['tiktok'] : ['facebook'])` เมื่อสลับ Content Type) — ไม่ได้แตะ `handleSelectType()` เลย ยังทำงานเหมือนเดิมทุกประการ
- [x] 3.3 ตรวจ UI copy ทั้งไฟล์ (grep "เฉพาะ/จำกัด/ตามประเภท") ไม่พบข้อความที่สื่อว่า platform ถูกจำกัดตาม Content Type เลย (คำอธิบาย step เช่น "วีดีโอสคริปต์ · TikTok · YouTube · Instagram Reels" เป็นแค่ tagline บอกตัวอย่าง ไม่ใช่ข้อจำกัด) ไม่ต้องแก้

## 4. Frontend — Script Sections gating ใน `ContentCardDialog.tsx`

- [x] 4.1 import `platformsNeedScriptSections` จาก `types.ts`
- [x] 4.2 เปลี่ยนเงื่อนไขแสดง "โครงสร้างบท (Script Sections)" จาก `scriptSections && Object.keys(scriptSections).length > 0` เป็นเพิ่ม `&& platformsNeedScriptSections(platforms)` ด้วย

## 5. Tests

- [x] 5.1 เพิ่ม `api/tests/core-content-platform-output-test.php` ทดสอบ `content_needs_script_sections()` โดยตรง — 8 test case ครอบคลุม tiktok/youtube เดี่ยว, facebook เดี่ยว, ปนกับ web platform, ปนกับ video platform, ไม่เลือกเลย, case-insensitive, post-only ทั้งหมด — รันแล้ว 8/8 PASS
- [x] 5.2 เพิ่ม describe block ใหม่ใน `QuickCreateDialog.directMode.test.tsx` — 2 tests ยืนยันว่า Content Type=Video ยังเลือก WordPress+Facebook ได้ (ส่ง platforms รวม tiktok/wordpress/facebook) และ Content Type=Article ยังเลือก TikTok ได้ (ส่ง platforms รวม facebook/tiktok) — รันแล้วผ่านทั้งคู่ (169 tests รวม suite เดิม)
- [x] 5.3 เพิ่ม `scriptSections` param ใน `makeItem()` helper + TC10/TC11 ใน `ContentCardDialogScripts.test.tsx` — ยืนยัน Script Sections ไม่แสดงเมื่อเลือกแค่ Facebook (แม้มีข้อมูล script_sections ค้างอยู่) และแสดงเมื่อเลือก TikTok ร่วมด้วย — รันแล้วผ่านทั้งคู่ (171 tests รวม suite เดิม)

## 6. Verification

- [x] 6.1 `php -l api/brand-content.php api/lib/content-plan-prompt.php` — ผ่านทั้งคู่
- [x] 6.2 รัน `core-content-platform-output-test.php` (8/8 PASS), `publish-gate-test.php` (18/18 PASS), `seo-aeo-gate-test.php` (20/20 PASS) — ไม่มี regression
- [x] 6.3 `pnpm lint` — 0 errors (47 warning เดิมที่ไม่เกี่ยวข้อง)
- [x] 6.4 `pnpm test` — 24/24 files, 171/171 tests PASS
- [x] 6.5 `pnpm build` — สำเร็จ
- [x] 6.6 ทดสอบจริงในเบราว์เซอร์แบบครบวงจร (ใช้ JS ตรวจ DOM/svg class ยืนยันปุ่มก่อนคลิกทุกครั้ง ไม่พึ่งพิกัดเดา): เปิด QuickCreateDialog ตั้ง Content Type = Video → ยืนยัน platform picker แสดงครบ 11 platform (ไม่ถูกกรองแล้ว) → เลือก WordPress+Facebook+TikTok พร้อมกัน → generate จริงสำเร็จ ("สร้างวีดีโอสคริปต์สำเร็จ!") → ตรวจ DB ตรงๆ ยืนยัน `platforms=["tiktok","wordpress","facebook"]`, `html` ยาว 10,004 ตัวอักษรมีเนื้อหาจริง (ไม่ใช่ script facebook, ไม่ว่างเปล่า), `scripts` มีแค่ key tiktok/facebook (wordpress ไม่มี เพราะไม่ใช่ script-capable), `script_sections` มีข้อมูลครบ (opening/bridge/twist/ending) เพราะมี TikTok → เปิด ContentCardDialog ยืนยันซ้ำผ่าน UI: Core Article แสดงเนื้อหาจริง, "Scripts สำหรับ Platform ที่เลือก" มีแท็บ TikTok+Facebook เท่านั้น, "โครงสร้างบท (Script Sections)" แสดงครั้งเดียว (ไม่ซ้ำต่อ platform), ไม่มี Script SEO/AEO UI หลงเหลือ → ปิดด้วย "ยกเลิก" ไม่กระทบข้อมูล → เปิด content เก่า (draft ว่างเปล่า) ซ้ำเพื่อ regression check ไม่มี error/crash
