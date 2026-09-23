## 1. ทดสอบก่อนเริ่ม (ข้อสมมติหลัก)

- [x] 1.1 เติม credit kie.ai (key หลักเหลือ 23.95 — ต้องใช้ ≥ 30) แล้วยิง `veo3_lite` 720p 9:16 text-to-video 1 คลิปผ่านสคริปต์ใน scratchpad ด้วย prompt รูปแบบเดียวกับ `kieVideoComposePrompt` (`video_prompt` + คำสั่งผู้บรรยายพูดไทย + บทพากย์ ~100 ตัวอักษร) — ฟังว่าพูดไทยชัด ครบบท และจบใน 8 วินาทีหรือไม่ บันทึกผลลง design.md; ถ้าไม่ผ่าน หยุดและตัดสินใจกับผู้ใช้ก่อนทำข้อ 5.2
- [x] 1.2 ยิง OpenRouter Image API `POST /api/v1/images` ด้วย `google/gemini-2.5-flash-image` + `aspect_ratio: "9:16"` 1 ภาพ (~$0.04) ยืนยันรูปแบบ response (`data[0].b64_json`) และขนาดภาพจริง; ยิง `openai/gpt-5-image-mini` + `9:16` 1 ครั้งเพื่อยืนยันข้อความ error 400

## 2. ฐานข้อมูล

- [x] 2.1 สร้าง migration `database/migrations/YYYY_MM_DD_HHMMSS_add_video_aspect_resolution.sql`: เพิ่ม `content_items.video_aspect_ratio VARCHAR(8) NULL` และ `video_resolution VARCHAR(8) NULL` (idempotent ผ่าน `information_schema`), แปลง `duration_sec` ของ `type='video'` (15→30, 180/600→90), ตั้ง `9:16`/`720p` ให้วิดีโอเดิมที่เป็น NULL
- [x] 2.2 รันกับ DB local สองรอบ ตรวจ `SHOW COLUMNS FROM content_items LIKE 'video_%'` และ `SELECT duration_sec, COUNT(*) FROM content_items WHERE type='video' GROUP BY duration_sec` (ต้องเหลือแค่ 30/45/60/90/NULL)

## 3. Backend: ความยาว สัดส่วน ความละเอียด

- [x] 3.1 (ย้ายไป `api/lib/kie-video.php` เพื่อให้เทสต์ได้และ 3a ใช้ต่อได้) `normalizeVideoDuration` รับ 30/45/60/90 (อื่นๆ → 60) และเพิ่ม `videoSceneCount(int $duration): int` (= round(duration/8) ปัดลงเมื่อห่างเท่ากัน → 4/6/7/11)
- [x] 3.2 `generate-plan`: รับ `aspect_ratio`/`resolution` (normalize ด้วย `kieVideoNormalizeAspect/Resolution`) และบันทึกลง INSERT `content_items` เฉพาะ `type='video'` (อื่นๆ NULL)
- [x] 3.3 `api/content-items.php` (list): เพิ่ม `ci.video_aspect_ratio`, `ci.video_resolution` ใน SELECT; ยืนยันว่า PUT whitelist ไม่มีสองฟิลด์นี้ (ล็อกโดยไม่ต้องแก้) และ detail (`ci.*`) ส่งกลับอยู่แล้ว

## 4. Backend: สคริปต์ฉากและบทพากย์

- [x] 4.1 `videoDurationInstruction()` สั่ง AI ให้เขียน `visuals` จำนวน `videoSceneCount()` ฉาก ฉากละ 8 วินาที (เดิมใช้ร่วมใน `generate-plan` และ `generate-article` — ภายหลังถอดออกจาก `generate-plan` ในงาน 8.3 เพราะทำให้สคริปต์ปนในแคปชั่น)
- [x] 4.2 `generate-article` (prompt วิดีโอ): schema `visuals` เป็น `{visual, motion, narration, duration_sec: 8}`, บอกสัดส่วนแนวตั้ง/แนวนอนตาม `video_aspect_ratio`, กำหนด `narration` ภาษาไทย ≤ 100 ตัวอักษร เล่าเรื่องต่อเนื่อง — ใส่เฉพาะฉากที่ควรพูด (ฉากโชว์ภาพเป็น "" ได้) แต่ฉากแรก (Hook) และฉากสุดท้าย (CTA) ต้องมีเสมอ
- [x] 4.3 `_visualsToScenes`: คัดลอก `narration` (ไม่มี → `''`) และ `duration_sec` (ไม่มี → 8) ลง scene
- [x] 4.4 `update-scene`: รับ `narration` แบบ partial เหมือน `video_prompt`/`visual_prompt`

## 5. Backend: ภาพฉากและวิดีโอ

- [x] 5.1 `_generateOneSceneImage` รับ `$aspectRatio`: OpenRouter → `POST {baseUrl}/images` `{model, prompt, aspect_ratio, n: 1}` อ่าน `data[0].b64_json`; Kilo → เติมคำกำหนดสัดส่วนใน prompt; อื่นๆ → `/images/generations` + `size` ตามสัดส่วน; error จาก provider → `image_gen_error`; ส่งค่าจาก `generate-scene-images` และ `generate-scene-image` (อ่าน `video_aspect_ratio` ของ item)
- [x] 5.2 `api/lib/kie-video.php`: เพิ่ม `kieVideoComposePrompt(string $videoPrompt, string $narration): string` (narration ว่าง → คืน video_prompt เดิม)
- [x] 5.3 `generate-video`: อ่าน `video_aspect_ratio`/`video_resolution` จาก content item (เลิกอ่านจาก request) และใช้ `kieVideoComposePrompt` กับ scene แรก
- [x] 5.4 เพิ่มเคสใน `api/tests/kie-video-adapter-test.php`: `kieVideoComposePrompt` (มี/ไม่มีบท, บทมีเครื่องหมายคำพูด) และ `videoSceneCount` / `normalizeVideoDuration` (30/45/60/90/180)

## 6. Frontend

- [x] 6.1 `src/components/content/types.ts`: `VIDEO_DURATION_OPTIONS` = `30s/45s/60s/90s` + `VIDEO_DURATION_SECONDS`, ฟังก์ชัน `videoSceneCount()`, เพิ่ม `video_aspect_ratio`/`video_resolution` ใน `ContentItem` และ `PlanItem`, `narration`/`duration_sec` ใน `Scene`
- [x] 6.2a สร้าง component `AspectRatioShape` (วาดกรอบเส้นขอบตามอัตราส่วนจริงด้วย CSS, รับ `ratio` และ `size`) และ `AspectRatioPicker` (กล่องรูปทรง + ข้อความ เช่น ▭ 16:9 / ▯ 9:16, tooltip แนวนอน/แนวตั้ง, เน้นกล่องที่เลือกด้วยสี primary, มีขนาดปกติ/กะทัดรัด) ใน `src/components/content/`
- [x] 6.2 `QuickCreateDialog.tsx` (เฉพาะวิดีโอ): หัวข้อ "ความยาววิดีโอ" (30s/45s/60s/90s พร้อม "≈N วิ · M ฉาก"), "อัตราส่วนวิดีโอ" (ใช้ `AspectRatioPicker`) และ "ความละเอียดวิดีโอ" (720p / 1080p) ส่งไปกับ `generate-plan`
- [x] 6.3 `BatchGenerateDialog.tsx`: ตัวเลือกเดียวกัน (ชื่อ "ความยาววิดีโอ" / "อัตราส่วนวิดีโอ" / "ความละเอียดวิดีโอ") แบบต่อหัวข้อ (`AspectRatioPicker` ขนาดกะทัดรัด) และสรุปในแถวหัวข้อ
- [x] 6.4 `ContentListTab.asPlanItem()` และ `ContentDetailView`: ส่ง `video_aspect_ratio`/`video_resolution` เข้า dialog
- [x] 6.5 `ContentCardDialog.tsx` และ `ContentVideoView.tsx`: ลบ selector สัดส่วน/ความละเอียด แทนด้วย badge `9:16 · 720p` ที่มี `AspectRatioShape` ขนาดเล็กนำหน้า (ค่าจาก item, NULL → 9:16 · 720p) พร้อม tooltip "อัตราส่วนวิดีโอ · ความละเอียดวิดีโอ (กำหนดตอนสร้างคอนเทนต์)" และส่งแค่ `item_id` กับ `generate-video`; ลบ `VIDEO_ASPECT_RATIO_OPTIONS`/`VIDEO_RESOLUTION_OPTIONS` ที่ไม่ใช้แล้วออกจากสองไฟล์นี้
- [x] 6.6 `SceneCards.tsx`: ช่อง "บทพากย์" แก้ไขได้ + ตัวนับตัวอักษร + คำเตือนเมื่อเกิน 100; ContentCardDialog เก็บ draft และบันทึกผ่าน `update-scene` พร้อมปุ่ม "บันทึก" หลัก (แบบเดียวกับ `video_prompt`)

## 7. Tests และตรวจสอบ

- [x] 7.1 อัปเดต tests ที่คาดหวัง `180`/`3min` (`BatchGenerateDialog.test.tsx`, `QuickCreateDialog.directMode.test.tsx`) และเพิ่มเคส: ส่ง `aspect_ratio`/`resolution` ไปกับ `generate-plan`, ตัวเลือกความยาวมีแค่ 4 ค่า
- [x] 7.2 อัปเดต `ContentVideoView.test.tsx` (ไม่มี selector, มี badge, คำขอมีแค่ `item_id`) และเพิ่มเทสต์ SceneCards ช่องบทพากย์ + คำเตือนเกิน 100 ตัวอักษร
- [x] 7.3 รัน `php api/tests/kie-video-adapter-test.php`, `pnpm lint`, `pnpm test`, `pnpm build` (8 tests ที่ fail อยู่แล้วบน HEAD ให้ระบุแยก ถ้ายังไม่ถูกแก้)
- [x] 7.4 ทดสอบผ่านหน้าเว็บจริง: สร้างคอนเทนต์วิดีโอ 30s 9:16 720p → AI เขียนสคริปต์ได้ 4 ฉาก (ฉากแรก/สุดท้ายมีบทพากย์) → สร้างภาพฉาก (Nano Banana) ได้ภาพแนวตั้ง → สร้างวิดีโอ (ต้องใช้ ngrok + ~30 credit) ได้คลิป 9:16 ที่พูดบทพากย์ฉากแรก → badge แสดง `9:16 · 720p` — ผ่าน (2026-09-23): QuickCreate 30s·9:16·720p → content item 30/9:16/720p → AI เขียน 4 ฉาก ฉากละ 8 วิ บทพากย์ 68–78 ตัวอักษร (Hook/CTA ครบ) → Nano Banana ภาพ 768×1344 ครบ 4 ภาพ → kie ดึงภาพผ่าน ngrok → Veo Lite คลิป 720×1280 8 วิ มีเสียง, dialog poll แล้วแสดง player เอง, badge 9:16 · 720p
- [x] 7.5 คืนค่าที่เปลี่ยนเพื่อทดสอบ (`.env`, ngrok, API key/model ภาพ ถ้าเปลี่ยนชั่วคราว) — คืน `.env` และปิด server 8099 แล้ว; model ภาพของ tenant-default ตั้งเป็น `google/gemini-2.5-flash-image` ถาวร (ผู้ใช้ตั้งผ่านหน้าตั้งค่า AI); ngrok ผู้ใช้ปิดเอง

## 8. ปรับหลังทดสอบจริง (ผู้ใช้ขอเพิ่ม 2026-09-23)

- [x] 8.1 `NarrationField` (ช่องบทพากย์ + ตัวนับ + คำเตือนเกิน 100) เป็น component กลางใน `SceneCards.tsx`; `SceneCards` รับ prop `showNarration` (ค่าเริ่มต้น true — `ContentVideoView` ยังแสดง)
- [x] 8.2 `ContentCardDialog`: ย้ายช่องบทพากย์ไปใต้แต่ละฉากใน "ลำดับฉาก" ทั้งก่อนมี scenes (draft ใหม่ `visualsNarrationDraft` → บันทึกลง `article_content.visuals[i].narration` ผ่านปุ่มบันทึกหลัก, string entry แปลงเป็น object เมื่อมีบท, รวมใน isDirty snapshot) และหลังมี scenes (ใช้ `scenesNarrationDraft` เดิม → `update-scene`); ส่ง `showNarration={false}` ให้ SceneCards ใน dialog
- [x] 8.3 `generate-plan`: ไม่ส่ง `videoDurationInstruction` ใน Video Configuration, แก้ข้อความ "must affect the generated script" และเพิ่มกฎห้ามใส่สคริปต์/ฉาก/Visual/Voiceover ใน caption
- [x] 8.4 เทสต์ dialog: บทพากย์อยู่ใต้ลำดับฉาก (ก่อน/หลังมี scenes), บันทึกก่อนมี scenes ได้ `visuals[i].narration`, หลังมี scenes เรียก `update-scene` พร้อม `narration`, scene card ใน dialog ไม่มีช่องบทพากย์
- [x] 8.5 รัน tests/lint/build และทดสอบ generate-plan จริง 1 ครั้งว่าแคปชั่นไม่มีสคริปต์ปน — ผ่าน: tests 270/278 (8 ตัวเดิมที่ fail บน HEAD), lint 0 error, build ผ่าน, PHP 27/27; generate-plan จริง (วิดีโอ 30s) ได้แคปชั่นโพสต์ปกติ ไม่มีฉาก/Visual/Voiceover/เวลา; dialog จริงแสดงบทพากย์ 4 ช่องใต้ลำดับฉาก ไม่ซ้ำใน scene card
