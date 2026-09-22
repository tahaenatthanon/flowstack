## Why

`generate-video` (Phase 1) ใช้งานได้แต่ยังไม่สมบูรณ์: (1) ส่ง `visual_prompt` (คำบรรยายภาพนิ่ง) เป็น prompt ให้ Veo แทนที่จะเป็น `video_prompt` (คำสั่งการเคลื่อนไหว) ที่เพิ่งสร้างไว้ใน Phase ก่อนหน้า — ทำให้ field นี้ยังไม่มีผลอะไรกับวิดีโอที่ได้จริง (2) บังคับว่าทุก scene ต้องมีภาพก่อนถึงจะกดสร้างวิดีโอได้ (ทั้งฝั่ง backend และปุ่มบน frontend) ทั้งที่ระบบใช้จริงแค่ scene แรก และ kie.ai รองรับทั้ง image-to-video และ text-to-video อยู่แล้ว (3) สัดส่วนวิดีโอ fix เป็น `9:16` ตายตัว ทั้งที่ผู้ใช้โพสต์ได้หลาย platform ที่ต้องการสัดส่วนต่างกัน

## What Changes

- `generate-video` เปลี่ยน payload prompt จาก `visual_prompt` เป็น `video_prompt`
- เพิ่ม mode detection ตามสถานะของ scene แรก (`image_gen_status`): `done` → image-to-video, `none` → text-to-video (`generation_type: TEXT_2_VIDEO`, ไม่ส่ง `image_urls`), `failed` → คืน error พร้อมเหตุผล ไม่ fallback ไปโหมดอื่นเงียบๆ
- ลบ validation เดิมที่บังคับ "ทุก scene ต้องมีภาพ" (ทั้ง backend และเงื่อนไข disable ปุ่มฝั่ง frontend ใน `ContentVideoView.tsx` และ `ContentCardDialog.tsx`) — เปลี่ยนเป็นเช็คแค่ `scene[0].video_prompt` ต้องไม่ว่างเท่านั้น
- เพิ่ม aspect ratio selector (`9:16` / `16:9` / `Auto`) ให้ผู้ใช้เลือกตอนกดสร้างวิดีโอ แทนค่า fix เดิม — เลือกได้ทีละค่า การสร้างวิดีโอใหม่เขียนทับของเดิม (ไม่เก็บหลายเวอร์ชันพร้อมกัน)
- เพิ่มปุ่ม "AI เขียน Video Prompt" ย้อนหลังในทุก scene card ที่ `video_prompt` ยังว่าง — เรียก action ใหม่ที่ใช้ text model (ไม่ใช่ image model) เขียนคำสั่งการเคลื่อนไหวจาก `visual_prompt` + หัวข้อ + สไตล์ภาพที่เลือกไว้

**ไม่รวมใน change นี้**: การรองรับหลาย scene ต่อวิดีโอ, การต่อคลิป, การเก็บวิดีโอหลายสัดส่วนพร้อมกัน (ทั้งหมดนี้คือ Phase 3 ที่ต้องมี video-editing layer ใหม่)

## Capabilities

### New Capabilities
- `video-prompt-backfill`: ปุ่ม "AI เขียน Video Prompt" ย้อนหลังต่อ scene, action `generate-scene-video-prompt`, helper `_generateOneSceneVideoPrompt()`

### Modified Capabilities
- `video-generation-provider-contract`: payload ของ `generate-video` เปลี่ยนจาก `visual_prompt`→`video_prompt`, เพิ่ม mode detection (image-to-video/text-to-video/error), เพิ่ม aspect_ratio ที่เลือกได้
- `scene-generation-from-visuals`: requirement "Video generation disabled until all scenes have images" เปลี่ยนเป็นเช็คแค่ scene แรกต้องมี `video_prompt`
- `content-video-ui-section`: เงื่อนไข disable ปุ่ม "สร้างวิดีโอ" เปลี่ยนจาก `allScenesHaveImages` เป็นเช็ค `scene[0].video_prompt`, เพิ่ม aspect ratio selector ใน UI

## Impact

- `api/brand-content.php`: แก้ `generate-video` (payload, mode detection, validation, aspect_ratio param), เพิ่ม action `generate-scene-video-prompt` + helper `_generateOneSceneVideoPrompt()`
- `src/components/content/views/ContentVideoView.tsx`: แก้เงื่อนไข disable ปุ่ม, เพิ่ม aspect ratio selector, ส่งค่าไป `generate-video`
- `src/components/content/ContentCardDialog.tsx`: แก้เงื่อนไข disable ปุ่มเดียวกัน
- `src/components/content/SceneCards.tsx`: เพิ่มปุ่ม "AI เขียน Video Prompt" ต่อ scene ที่ `video_prompt` ว่าง
- ไม่มี DB schema เปลี่ยนแปลง (ใช้ field ที่มีอยู่แล้วจาก Phase ก่อนหน้า: `video_prompt`, `image_gen_status`, `image_gen_error`)
