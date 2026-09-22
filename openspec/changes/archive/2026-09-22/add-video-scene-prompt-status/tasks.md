## 1. AI generation schema (backend)

- [x] 1.1 แก้ AI prompt schema ใน `$isVideo` branch (`api/brand-content.php` ~line 2577) เปลี่ยน `visuals` จาก `["Scene 1: ..."]` เป็น `[{"visual": "...", "motion": "..."}]`
- [x] 1.2 ยืนยันว่า branch article/social (~line 2601) ไม่ถูกแก้ — `visuals` ยังเป็น `string[]` เหมือนเดิม

## 2. Fallback conversion + per-scene status (backend)

- [x] 2.1 แก้ fallback conversion ที่ `generate-scene-images` (~line 1612) ให้ parse ได้ทั้ง string (legacy) และ object `{visual, motion}` (ใหม่) — output เป็น `{visual_prompt, video_prompt, shot, image_gen_status: "none"}`
- [x] 2.2 แก้ fallback conversion ที่ `generate-video` (~line 3458) ด้วย logic เดียวกันกับ 2.1 (กันสถานะไม่ตรงกันระหว่าง 2 จุด) — ทำผ่าน shared helper `_visualsToScenes()` เพื่อกันการ drift ระหว่าง 2 จุดในอนาคต
- [x] 2.3 แก้ `generate-scene-images` ให้เขียน `image_gen_status: "done"`/`"failed"` และ `image_gen_error` (เมื่อ failed, null เมื่อ done) กลับเข้า `scenes[i]` แต่ละตัว ก่อน `json_encode`/`UPDATE content_items`
- [x] 2.4 เพิ่ม helper function (PHP) `_deriveSceneImageStatus()` สำหรับ derive `image_gen_status` ของ scene ที่ไม่มี key นี้ — หมายเหตุ: `content-items.php` (endpoint ที่ frontend ใช้ list/get content item จริง) ส่ง `article_content` เป็น raw JSON string ผ่านตรงๆ โดยไม่ decode/re-encode ทุกครั้งที่อ่าน (นอกขอบเขต Impact ของ proposal นี้ที่ระบุแค่ `api/brand-content.php`) ดังนั้น derive rule สำหรับ scene เก่าที่ frontend อ่านจริง ถูก apply ที่ฝั่ง frontend แทน (ดู task 6.3) ตรงกับ design.md decision #2 ที่ระบุว่า derive เกิดได้ทั้ง 2 ฝั่ง — helper ฝั่ง PHP นี้พร้อมใช้เมื่อ backend action ใน `brand-content.php` ต้องรายงานสถานะ scene ที่ไม่ได้เขียนเองในรอบนั้น

## 3. API ใหม่: update-scene + retry รายฉาก (backend)

- [x] 3.1 เพิ่ม action `update-scene` (`POST`): รับ `item_id`, `scene_index`, `video_prompt` — อ่าน `article_content` ทั้งก้อน, แก้เฉพาะ `scenes[scene_index].video_prompt`, เขียนกลับ
- [x] 3.2 Validate `scene_index` อยู่ในขอบเขตของ `scenes[]` จริง ก่อนแก้ (กัน index out of range) — ทั้ง `update-scene` และ `generate-scene-image`
- [x] 3.3 เพิ่ม action `generate-scene-image` รับ `item_id` + `scene_index` — สกัด logic การยิง AI ออกมาเป็น helper กลาง `_generateOneSceneImage()`/`_resolveSceneImageModel()` ที่ `generate-scene-images` (bulk) ก็เรียกใช้ร่วมกัน เพื่อไม่ให้ 2 endpoint drift กัน, อัปเดต `image_gen_status`/`image_gen_error`/`image_url` ของ scene นั้น

## 4. Frontend types

- [x] 4.1 เพิ่ม `video_prompt?`, `image_gen_status?`, `image_gen_error?` เข้า scene type ใน `src/components/content/types.ts` และเปลี่ยน `visuals?: string[]` เป็น `Array<string | {visual?, motion?}>` ให้ตรง schema ใหม่

## 5. ContentCardDialog.tsx — defensive rendering

- [x] 5.1 แก้ส่วน "ลำดับฉาก" ให้ render ได้ทั้ง `visuals[i]` เป็น string (เดิม) และ object `{visual, motion}` (ใหม่) โดยไม่ขึ้น `[object Object]` — เพิ่ม helper `visualText()`

## 6. ContentVideoView.tsx — scene cards ใหม่

- [x] 6.1 เพิ่ม section "ฉากวิดีโอ" ใหม่ทั้งหมด (ไม่มีของเดิม) แสดง scene card ต่อทุก `scenes[i]`
- [x] 6.2 Empty state: `scenes` ว่าง → แสดงข้อความ "ยังไม่มีฉาก กด 'สร้างภาพทุกฉาก' เพื่อเริ่มสร้าง" พร้อมปุ่ม (เชื่อมกับปุ่ม bulk เดิม)
- [x] 6.3 ต่อ scene card: แสดงภาพ (`image_url`), สถานะ (`deriveSceneImageStatus()` ฝั่ง frontend คู่กับ backend), `image_gen_error` เมื่อ failed
- [x] 6.4 ต่อ scene card: ช่อง textarea แก้ `video_prompt` + ปุ่ม "บันทึก Video Prompt" (explicit save, เรียก `update-scene` จาก 3.1) — ไม่มี auto-save/debounce
- [x] 6.5 ต่อ scene card ที่ status "failed": ปุ่ม "สร้างใหม่เฉพาะฉากนี้" เรียก action จาก 3.3 พร้อม loading state เฉพาะการ์ดนั้น (ไม่รบกวน scene อื่น)
- [x] 6.6 Invalidate React Query cache (`['content','items']`, `['content','plans']`) หลัง `update-scene`/retry สำเร็จ

## 6b. ContentCardDialog.tsx — scene cards (พบภายหลังว่า ContentVideoView ใช้จริงแค่ผ่านหน้า "รายการอนุมัติ" เท่านั้น ไม่ใช่หน้าแก้ไข content ทั่วไปที่ใช้งานทุกวัน)

- [x] 6b.1 สกัด scene cards UI ออกเป็น component กลาง `src/components/content/SceneCards.tsx` (รับ `itemId`, `scenes`, `readOnly`, `onGenerateAll`, `generatingAll`) เพื่อไม่ให้ `ContentVideoView.tsx` และ `ContentCardDialog.tsx` มี logic บันทึก/retry แยกกันคนละชุดแล้ว drift (เหมือนที่ทำกับ backend helper ในข้อ 3.3)
- [x] 6b.2 Refactor `ContentVideoView.tsx` ให้ใช้ `SceneCards` แทนโค้ด inline เดิม (ลบ state/handler ที่ซ้ำซ้อนออก)
- [x] 6b.3 เพิ่ม `<SceneCards>` เข้า section "วิดีโอ" ใน `ContentCardDialog.tsx` (ต่อจากปุ่ม "สร้างภาพทุกฉาก"/"สร้างวิดีโอด้วย AI" เดิม) — ยืนยันด้วยการทดสอบจริงผ่าน UI: พิมพ์ video_prompt ของ Scene 1 แล้วกดบันทึก เห็น toast "บันทึก Video Prompt แล้ว" (ทดสอบเสร็จแล้ว revert ค่าทดสอบกลับเป็นค่าว่าง)

## 7. Verification

- [x] 7.1 ยืนยัน AI prompt schema ใหม่ถูกต้องด้วย static review (`php -l` ผ่าน, `_visualsToScenes()` parse ทั้ง object/string ถูกต้อง) — ไม่ได้ยิง generate-content จริงเพราะต้องใช้ AI credit จริง หากต้องการยืนยันแบบ end-to-end ต้องขอ user ก่อนยิง
- [x] 7.2 CONFIRMED ด้วยข้อมูลจริงในระบบ (content item `149b941b-ddbb-418b-bad2-73ae91fd4df3`): scene ทุกตัวมี `image_url` แต่ไม่มี key `image_gen_status` เลย (legacy) — ตรงเงื่อนไข backward-compat พอดี, derive rule (`_deriveSceneImageStatus()` และ `deriveSceneImageStatus()` ฝั่ง frontend) resolve เป็น "done" ถูกต้องตาม logic ที่ตรวจสอบ
- [x] 7.3 CONFIRMED ด้วย live API call จริงผ่าน `update-scene`: แก้ scene index 0 และ 2 ของ item `149b941b-...` แยกกัน → ยืนยันด้วย GET `content-items.php` ว่า scene อื่น (1,3,4) ไม่ถูกแก้ตาม, `visual_prompt`/`shot`/`image_url` เดิมของ scene ที่แก้ก็ยังอยู่ครบ (ไม่ถูกเขียนทับ)
- [x] 7.4 บางส่วน: ยืนยัน validation (`scene_index` นอกขอบเขต → error ก่อนยิง AI, ไม่มี `visual_prompt` → error) ด้วย live call จริงโดยไม่เสีย credit — ไม่ได้ยิง success-path จริงเพราะจะเสีย AI credit ของ provider ที่ตั้งค่าไว้ (OpenRouter GPT-5 Image Mini); logic ที่ใช้เป็น helper เดียวกับ `generate-scene-images` (bulk) ที่เคยยืนยันทำงานจริงแล้วก่อนหน้านี้ในเซสชันนี้
- [x] 7.5 รัน `pnpm lint` และ `pnpm build` ให้ผ่านก่อนถือว่าเสร็จ — ผ่านทั้งคู่ (lint: 0 errors, มีแค่ warning เดิมที่ไม่เกี่ยวกับ change นี้; build: succeeded)
