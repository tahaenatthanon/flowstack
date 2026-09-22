## Why

ตอนนี้ระบบสร้างวิดีโอ (Phase 1 เดิม, `fix-kieai-video-generation-endpoint`) ใช้ `scenes[].visual_prompt` (คำอธิบาย "ภาพนิ่ง") เป็น prompt ส่งให้ Veo สร้างวิดีโอโดยตรง ทั้งที่ Veo ต้องการคำสั่ง "การเคลื่อนไหว/มุมกล้อง" ไม่ใช่คำบรรยายภาพซ้ำ — ทำให้วิดีโอที่ได้ไม่ตรงกับที่ตั้งใจ นอกจากนี้สถานะการสร้างภาพยังถูกเก็บแค่ระดับ content item เดียว (`content_items.image_gen_status`) ไม่ใช่ต่อ scene ทำให้เกิด toast "สำเร็จ" หลอกเมื่อบาง scene สร้างภาพไม่สำเร็จจริง และไม่มีทางแยกแยะ "ยังไม่เคยสร้างภาพ" กับ "สร้างภาพแล้วแต่ล้มเหลว" — ซึ่งจำเป็นสำหรับ Phase 2 ที่จะเลือกโหมด image-to-video/text-to-video ต่อ scene ให้ถูกต้อง

## What Changes

- เพิ่มฟิลด์ `video_prompt` ต่อ scene — AI เขียนคู่กับ `visual_prompt` ในการยิง generate content ครั้งเดียว (เปลี่ยน schema `visuals` จาก `string[]` เป็น `[{visual, motion}]` เฉพาะ content ประเภทวิดีโอ) และผู้ใช้แก้ไขเองได้ภายหลัง
- เพิ่มฟิลด์ `image_gen_status` (`none`/`done`/`failed`) และ `image_gen_error` เก็บจริงต่อ scene ใน `article_content.scenes[]` แทนที่จะอาศัยแค่ `image_url` ว่าง/ไม่ว่าง
- Fallback conversion จาก `visuals[]` → `scenes[]` (2 จุดในโค้ด) SHALL ตั้ง `image_gen_status: "none"` ให้ scene ใหม่เสมอ และ SHALL parse ได้ทั้ง object ใหม่ `{visual, motion}` และ string เก่า (backward compat กับ content ที่ generate ไว้ก่อนหน้านี้)
- Content เก่าที่ยังไม่มี key `image_gen_status` เลย SHALL ถูก derive ตอนอ่าน (ไม่ใช่เขียนทับ DB): มี `image_url` → ถือเป็น `done`, ไม่มี → `none`
- เพิ่ม API action ใหม่ `update-scene` (แก้ `video_prompt` รายฉาก) และ action สำหรับสร้างภาพใหม่เฉพาะ scene เดียว (retry รายฉาก แทนที่จะต้อง bulk ทั้งหมด)
- เพิ่ม UI "scene cards" ใน `ContentVideoView.tsx` (ไม่มีของเดิมมาก่อน) แสดงภาพ + สถานะ + error (ถ้ามี) + ช่องแก้ `video_prompt` พร้อมปุ่มบันทึกแยก (ไม่ auto-save) + ปุ่ม retry ต่อ scene + empty state เมื่อยังไม่มี scene
- แก้ `ContentCardDialog.tsx` ส่วน "ลำดับฉาก" ให้ render ได้ทั้ง object ใหม่และ string เก่าอย่างปลอดภัย

**ไม่รวมใน change นี้** (เป็น Phase ถัดไป): การเปลี่ยน logic ของ `generate-video` ให้เลือกโหมด image-to-video/text-to-video/error ตามสถานะ, การรองรับหลาย scene ต่อวิดีโอ, การต่อคลิป — สิ่งเหล่านี้ต้องพึ่งพาข้อมูลที่ change นี้สร้างขึ้น แต่ยังไม่ implement logic การใช้งานจริง

## Capabilities

### New Capabilities
- `video-scene-motion-prompt`: ฟิลด์ `video_prompt` ต่อ scene (AI-generated + user-editable), API สำหรับแก้/retry รายฉาก, และการเก็บ `image_gen_status`/`image_gen_error` ต่อ scene พร้อม backward-compat derive rule

### Modified Capabilities
- `scene-generation-from-visuals`: fallback conversion ต้องรองรับ object shape ใหม่ (`{visual, motion}`) ควบคู่ string เก่า และตั้ง `image_gen_status: "none"` ให้ scene ใหม่เสมอ; `generate-scene-images` ต้องเขียน `image_gen_status`/`image_gen_error` กลับต่อ scene จริง (ไม่ใช่แค่ `image_url`)
- `content-video-ui-section`: เพิ่ม requirement ส่วน scene cards (แสดง/แก้ไข/retry ต่อ scene) ใน `ContentVideoView`

## Impact

- `api/brand-content.php`: AI prompt schema ($isVideo branch), fallback conversion (2 จุด), `generate-scene-images`, action ใหม่ `update-scene` + retry-scene
- `src/components/content/SceneCards.tsx` (ใหม่): scene cards UI กลาง ใช้ร่วมกันระหว่าง 2 จุดด้านล่าง
- `src/components/content/views/ContentVideoView.tsx`: ใช้ `SceneCards` (หน้ารีวิว/อนุมัติ — จุดเดียวที่มีอยู่เดิมในแอป)
- `src/components/content/ContentCardDialog.tsx`: แก้ render ส่วน "ลำดับฉาก" ให้ปลอดภัยกับ object shape ใหม่ + เพิ่ม `SceneCards` เข้า section "วิดีโอ" (พบภายหลังว่าเป็นจุดที่ผู้ใช้เข้าถึงจริงในการทำงานประจำวัน ไม่ใช่ ContentVideoView อย่างเดียว)
- `src/components/content/types.ts`: type ของ scene เพิ่ม `video_prompt`, `image_gen_status`, `image_gen_error`
- Content เก่าที่มีอยู่ในระบบ: ไม่มีการ migrate ข้อมูล แต่ derive rule ต้องถูก apply ทุกจุดที่อ่านสถานะ scene
