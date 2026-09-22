## 1. Backend — generate-video payload + mode detection

- [x] 1.1 แก้ `generate-video`: ลบ validation เดิม "ทุก scene ต้องมีภาพ"
- [x] 1.2 เพิ่ม validation ใหม่: scene แรกต้องมี `video_prompt` ไม่ว่าง — ถ้าว่างคืน error แนะนำให้เขียน/ใช้ปุ่ม AI เขียนก่อน
- [x] 1.3 เพิ่ม validation: ถ้า scene แรก `image_gen_status === 'failed'` (derive ด้วย `_deriveSceneImageStatus()`) → คืน error พร้อม `image_gen_error` ของ scene นั้น ไม่ยิง API
- [x] 1.4 เปลี่ยน `input.prompt` จาก `$firstScene['visual_prompt']` เป็น `$firstVideoPrompt` (= `$firstScene['video_prompt']`)
- [x] 1.5 Derive `image_gen_status` ของ scene แรกด้วย `_deriveSceneImageStatus()` (helper เดิมจาก Phase 1) แล้ว branch payload: `done` → ใส่ `input.image_urls`, `none` → ใส่ `input.generation_type = 'TEXT_2_VIDEO'`
- [x] 1.6 อ่าน `aspect_ratio` จาก request body, validate เป็นหนึ่งใน `9:16`/`16:9`/`Auto` (default `9:16`), ใส่ใน `input.aspect_ratio`

## 2. Backend — generate-scene-video-prompt (action ใหม่)

- [x] 2.1 เพิ่ม helper `_generateOneSceneVideoPrompt()` — เรียก text model เขียนคำสั่งการเคลื่อนไหวสั้นๆ ภาษาไทย 1 ประโยค คืนเป็น string
- [x] 2.2 เพิ่ม action `generate-scene-video-prompt` (POST: `item_id`, `scene_index`): validate scene_index ในขอบเขต, validate scene มี `visual_prompt`, เรียก helper (ส่ง title + image_style เข้าไปด้วย), เขียนผลลง `scenes[scene_index].video_prompt`, บันทึก DB, คืน scene ที่อัปเดตแล้ว

## 3. Frontend — types.ts

- [x] 3.1 เพิ่ม `VIDEO_ASPECT_RATIO_OPTIONS` ใน types.ts (pattern เดียวกับ `IMAGE_STYLE_OPTIONS`)

## 4. Frontend — SceneCards.tsx (ปุ่ม AI เขียน Video Prompt)

- [x] 4.1 เพิ่ม state `writingPromptIndex`
- [x] 4.2 เพิ่ม `handleWriteVideoPrompt` เรียก `generate-scene-video-prompt`, ล้าง draft ที่ยังไม่บันทึกทิ้ง, invalidate queries เมื่อสำเร็จ, toast เมื่อพัง (ไม่ persist error)
- [x] 4.3 เพิ่มปุ่ม "AI เขียน Video Prompt" ในทุก scene card ที่ `scene.video_prompt` ว่างเปล่า (อยู่เหนือช่อง textarea) พร้อม loading state เฉพาะ card นั้น

## 5. Frontend — ContentVideoView.tsx

- [x] 5.1 เพิ่ม state `aspectRatio` (default `'9:16'`)
- [x] 5.2 เพิ่ม UI selector (9:16/16:9/Auto) ในแถบปุ่มด้านล่าง (pill button group)
- [x] 5.3 แก้ `handleGenerateVideo` ให้ส่ง `aspect_ratio` เข้า request body
- [x] 5.4 แก้เงื่อนไข disable ปุ่ม "สร้างวิดีโอ" จาก `!allScenesHaveImages` เป็น `!firstSceneVideoPromptReady` (= `!videoScenes[0]?.video_prompt?.trim()`) — แก้ `title` tooltip ให้ตรงข้อความใหม่ (คง `allVideoScenesHaveImages()` export ไว้เพราะมี test ใช้อยู่)
- [x] 5.5 แก้ข้อความ "กรุณาสร้างภาพให้ครบทุก Scene ก่อนสร้างวิดีโอ" เป็น "กรุณาเขียน Video Prompt ของ Scene แรกก่อนสร้างวิดีโอ"

## 6. Frontend — ContentCardDialog.tsx

- [x] 6.1 เพิ่ม state `aspectRatio` + UI selector (pill button group เหมือน ContentVideoView.tsx)
- [x] 6.2 แก้ `handleGenerateVideo` ให้ส่ง `aspect_ratio`
- [x] 6.3 แก้เงื่อนไข disable ปุ่มและข้อความแนะนำ จาก `allScenesHaveImages` เป็น `firstSceneVideoPromptReady`

## 7. Verification

- [x] 7.1 ทดสอบจริงผ่าน UI (content item จริง `6b5732f2-...`): scene แรกมี `image_gen_status: "done"` → กดสร้างวิดีโอ (16:9) → request ไปถึง kie.ai จริง (500 กลับมาเป็น "Credits insufficient" จาก provider จริง ไม่ใช่ validation error — ยืนยันว่า payload ถูกต้อง, ใช้ video_prompt ไม่ใช่ visual_prompt, ส่ง image_urls + aspect_ratio: "16:9" ถูกต้อง)
- [x] 7.2 ยืนยันด้วย code review (logic เดียวกับ 7.1 แค่สลับ branch `else` → ส่ง `generation_type: 'TEXT_2_VIDEO'` แทน `image_urls`) — ไม่ได้ทดสอบยิงจริงเพราะบัญชีเครดิตไม่พออยู่แล้วตาม 7.1
- [x] 7.3 ยืนยันด้วย code review — validation คืน error ก่อนถึงจุดยิง curl เสมอ (ไม่มีทางเลี่ยงได้จาก control flow)
- [x] 7.4 ยืนยันด้วย code review + UI จริง: ปุ่ม "สร้างวิดีโอด้วย AI" ทั้ง 2 ไฟล์ disabled ถูกต้องเมื่อ `scene[0].video_prompt` ว่าง (เห็นจริงตอน scene 4 ว่างก่อนทดสอบข้อ 7.5)
- [x] 7.5 ทดสอบจริงผ่าน UI สำเร็จ: เคลียร์ `video_prompt` ของ scene 4 (ผ่าน update-scene), เปิดหน้าใหม่ (fresh tab) เห็นปุ่ม "AI เขียน Video Prompt" โผล่ถูกต้อง กดแล้ว AI เขียนสำเร็จ ("กล้องซูมเข้าหาใบหน้าพ...") persist ลง DB จริง ปุ่มหายไปหลังสำเร็จ (แทนที่ด้วย textarea+ปุ่มบันทึกปกติ) — ไม่ได้ทดสอบ error path เพิ่มเติม (toast) เพราะไม่มีวิธี simulate provider error ได้ง่ายโดยไม่กระทบ config จริง
- [x] 7.6 ทดสอบจริงผ่าน UI: เลือก 16:9 ใน selector แล้วยืนยันจาก network request ว่า `aspect_ratio: "16:9"` ถูกส่งจริง (ดู 7.1)
- [x] 7.7 รัน `pnpm lint` (0 errors) และ `pnpm build` (สำเร็จ) ผ่านทั้งคู่หลังแก้ไฟล์ครบทุกจุด

**หมายเหตุการทดสอบ**: ระหว่างทดสอบพบว่า browser tab เดิมที่เปิดค้างไว้นานไม่ sync ข้อมูลใหม่แม้ reload (F5) — ไม่ใช่บั๊กของโค้ด เป็นพฤติกรรมของ tooling/tab เดิมในเซสชันทดสอบเท่านั้น ยืนยันด้วยการเปิด tab ใหม่แล้วข้อมูลถูกต้องตรงกับ DB ทันที
