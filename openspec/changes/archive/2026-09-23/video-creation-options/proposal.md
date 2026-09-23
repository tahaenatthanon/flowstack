## Why

ตอนนี้ผู้ใช้เลือกสัดส่วนและความละเอียดวิดีโอตอนกดสร้างวิดีโอ ซึ่งช้าเกินไป เพราะภาพประจำฉากถูกสร้างเป็นสี่เหลี่ยมจัตุรัส 1024×1024 ไปแล้ว และ AI เขียนสคริปต์โดยไม่รู้ว่าจะได้วิดีโอแนวตั้งหรือแนวนอน นอกจากนี้ความยาวที่เลือกได้ (15s/30s/60s/3min/10min+) ไม่สัมพันธ์กับคลิป 8 วินาทีของ Veo และฉากไม่มีบทพากย์ ทำให้วิดีโอที่ได้ไม่มีเสียงบรรยาย — change นี้ (A1 ใน Phase 3) ย้ายการตั้งค่าวิดีโอไปไว้ตอนสร้างคอนเทนต์ และทำให้สคริปต์/ภาพ/วิดีโอพร้อมสำหรับวิดีโอหลายฉากใน Phase 3a

## What Changes

- **BREAKING (ตัวเลือก)**: ความยาววิดีโอเปลี่ยนเป็น `30s / 45s / 60s / 90s` (ตัด 15s, 3min, 10min+) ใน QuickCreate และ BatchGenerate (ตั้งค่าต่อหัวข้อ)
- เพิ่มตัวเลือกสัดส่วน (`9:16` | `16:9`) และความละเอียด (`720p` | `1080p`) ในหน้าสร้างคอนเทนต์ บันทึกลง `content_items.video_aspect_ratio` / `video_resolution` แล้ว**ล็อก** — แก้ไขภายหลังไม่ได้
- **BREAKING (UI)**: ตัด selector สัดส่วน/ความละเอียดในหัวข้อ "วิดีโอ" (`ContentCardDialog`, `ContentVideoView`) ที่เพิ่มใน `kie-video-adapter` แทนด้วย badge อ่านอย่างเดียว เช่น `9:16 · 1080p`; `generate-video` อ่านค่าจาก content item และเลิกรับจาก request
- AI เขียนสคริปต์เป็น **N ฉาก ฉากละ 8 วินาทีเสมอ** (30→4, 45→6, 60→7, 90→11 ฉาก) — ทุก model วิดีโอที่เปิดใช้ทำ 8 วินาทีได้ จึงไม่พังเมื่อแอดมินเปลี่ยน model
- แต่ละฉากมี `duration_sec` (= 8) และ **`narration` (บทพากย์ภาษาไทย ≤ 100 ตัวอักษร)** ที่ AI เขียนมาพร้อม `visual_prompt`/`video_prompt` และผู้ใช้แก้ไขได้ใน scene card
- `generate-video` เติมบทพากย์ของฉากลงใน prompt เพื่อให้ Veo/Seedance **พูดบทพากย์ในคลิปเอง** — ไม่มีขั้นตอน TTS แยก
- ภาพประจำฉากสร้างตามสัดส่วน: provider OpenRouter เปลี่ยนไปใช้ Image API (`POST /api/v1/images`) พร้อม `aspect_ratio`; provider Kilo (chat completions ไม่มีช่องขนาด) บอกสัดส่วนใน prompt — ไม่ครอปภาพ
- migration: เพิ่ม `video_aspect_ratio`, `video_resolution`; แปลง `duration_sec` เดิมเป็นค่าที่ใกล้ที่สุด (15→30, 180/600→90); คอนเทนต์เดิมได้ `9:16` / `720p`
- แนะนำให้แอดมินตั้ง model ภาพเป็น `google/gemini-2.5-flash-image` (Nano Banana) บน OpenRouter ซึ่งรองรับ 9:16/16:9 ตรง (model เดิม `openai/gpt-5-image-mini` รองรับแค่ 1:1/2:3/3:2)

## Capabilities

### New Capabilities
- `video-creation-options`: ตัวเลือกความยาว/สัดส่วน/ความละเอียดตอนสร้างคอนเทนต์วิดีโอ การเก็บลง content item การล็อกค่า และการแปลงข้อมูลเดิม
- `scene-image-aspect-ratio`: สร้างภาพประจำฉากตามสัดส่วนของ content item แยกตาม provider ของ model ภาพ (OpenRouter Image API / Kilo prompt)

### Modified Capabilities
- `video-scene-motion-prompt`: AI เขียน `narration` และ `duration_sec` คู่กับ `visual_prompt`/`video_prompt` ตามจำนวนฉากที่คำนวณจากความยาว และ `update-scene` แก้ `narration` ได้
- `video-generation-provider-contract`: `aspect_ratio`/`resolution` มาจาก content item แทน request และ prompt ที่ส่งให้ model มีบทพากย์ของฉาก
- `content-video-ui-section`: selector สัดส่วน/ความละเอียดในหัวข้อวิดีโอกลายเป็น badge อ่านอย่างเดียว และ scene card มีช่องแก้ไขบทพากย์

## Impact

- **Backend**: `api/brand-content.php` (`generate-plan`, `generate-article` — prompt สคริปต์วิดีโอ; `_visualsToScenes`; `_generateOneSceneImage` + `generate-scene-images`/`generate-scene-image`; `update-scene`; `generate-video`), `api/content-items.php` (list/detail ส่งฟิลด์ใหม่), `api/lib/kie-video.php` (รับ prompt ที่มีบทพากย์)
- **Frontend**: `src/components/content/types.ts`, `dialogs/QuickCreateDialog.tsx`, `dialogs/BatchGenerateDialog.tsx`, `ContentCardDialog.tsx`, `views/ContentVideoView.tsx`, `SceneCards.tsx`, `tabs/ContentListTab.tsx`, `views/ContentDetailView.tsx` และ tests ที่คาดหวังค่า 180/`3min`
- **Database**: migration ใหม่ 1 ไฟล์ (คอลัมน์ 2 ตัว + แปลง `duration_sec`)
- **ภายนอก**: kie.ai — ต้องทดสอบว่า Veo พูดภาษาไทยได้ดีพอ (≈30 credit, ต้องเติม credit ก่อน — key หลักเหลือ 23.95); OpenRouter — ต้องทดสอบ Image API กับ Nano Banana (≈$0.04/ภาพ)
- **ไม่อยู่ในขอบเขต**: ยิงหลายคลิป (3a), ต่อคลิป/มิกซ์เสียง/TTS (3b), สัดส่วน 1:1, การเปลี่ยนสัดส่วน/ความละเอียดหลังสร้างคอนเทนต์, ส่งภาพสินค้าอ้างอิงเป็น `input_references` จริง (ยังส่งเป็นข้อความใน prompt แบบเดิม)
