## Why

หลัง A1 สคริปต์วิดีโอมีครบ N ฉาก (ฉากละ 8 วินาที พร้อมบทพากย์) แต่ `generate-video` ยังยิงแค่ฉากแรก ได้วิดีโอยาว 8 วินาทีเสมอ ไม่ว่าผู้ใช้จะเลือก 30/45/60/90 วินาที — change นี้ (Phase 3a+3b รวมกัน) ทำให้สร้างคลิปได้ทุกฉากแล้วต่อเป็นวิดีโอไฟล์เดียว โดยรวมสองส่วนไว้ใน change เดียวเพื่อทดสอบจริงกับ kie.ai รอบเดียว (credit มาจากการยิงคลิปเท่านั้น การต่อคลิปด้วย ffmpeg ไม่เสีย credit)

## What Changes

- **BREAKING (UI/API)**: เลิกใช้ปุ่ม "สร้างวิดีโอด้วย AI" ที่ยิงแค่ฉากแรก และ action `generate-video` / `video-status` เดิม — แทนด้วยการทำงาน 2 จังหวะ:
  1. **สร้างคลิปรายฉาก** (เสีย credit): ปุ่ม "สร้างคลิปทุกฉาก" และ "สร้างคลิปฉากนี้" / "ลองใหม่" ในการ์ดของแต่ละฉาก
  2. **สร้างวิดีโอรวม** (ไม่เสีย credit): ผู้ใช้กดเองเมื่อทุก Active Scene มีคลิปพร้อมใช้และไม่ล้าสมัย
- ตารางใหม่ `content_video_clips` — 1 แถวต่อ 1 generation ของคลิป (ไม่เขียนทับ) เก็บ `scene_id`, `input_snapshot`, สถานะ, ไฟล์, `credits_estimated` / `credits_actual` — คลิปที่ใช้งานของฉาก = generation ล่าสุดที่ `done`
- ตารางใหม่ `content_video_combines` — 1 แถวต่อวิดีโอรวม 1 ไฟล์ เก็บ `source_clips` (clip generation ที่ใช้ของแต่ละฉาก) — `content_items.video_url` ชี้ไฟล์รวมล่าสุดที่สำเร็จ
- แต่ละฉากมี **`scene.id` ถาวร** เป็น identity หลัก (`scene_index` ใช้แสดงลำดับเท่านั้น) — `_visualsToScenes()` แจก id ให้ฉากใหม่ และสคริปต์ครั้งเดียวแจก id ให้ฉากเดิมก่อนเปิดใช้
- **คลิปล้าสมัย**: เทียบ `input_snapshot` (ภาพ, Video Prompt, บทพากย์, model, duration, อัตราส่วน, ความละเอียด) กับค่าปัจจุบันที่บันทึกแล้ว คำนวณทุกครั้งที่อ่าน พร้อมบอกว่าอะไรเปลี่ยน — วิดีโอรวมล้าสมัยเมื่อชุดฉากเปลี่ยน ฉากมีคลิปใหม่ที่ done หรือคลิปที่ใช้รวมล้าสมัย
- **model ของวิดีโอ**: ใช้ `content_items.video_model_id` เดิมเป็นหลัก ถ้าถูกปิดจึง fallback ไป model ปัจจุบันของระบบ — เปลี่ยน default model ไม่ทำให้คลิปล้าสมัย
- **dialog ยืนยัน credit** ก่อนยิง แสดงจำนวนคลิป ฉากที่จะยิง และ credit ประมาณการ (คำนวณจาก `features.video.price_usd` ที่มีอยู่) — backend ยิงเฉพาะฉากที่ผู้ใช้ยืนยันและยังพร้อมอยู่ ไม่เกินรายการนั้น
- **การจองฉากแบบ atomic** กันยิงซ้ำจากหลายแท็บ, แยก error ระดับฉาก (ยิงต่อ) กับระดับบัญชี (หยุดทันที)
- ฉากที่ไม่มีบทพากย์: prompt ขอเสียงบรรยากาศและห้ามมีเสียงพูด
- **รวมคลิปด้วย ffmpeg**: ปรับเสียงทุกคลิปให้เป็นรูปแบบเดียวกัน (ใส่เสียงเงียบเมื่อไม่มีแทร็กเสียง) ตัดเสียงให้ยาวเท่าภาพของแต่ละคลิป ต่อภาพแบบ copy และ `+faststart` — กันรวมซ้อนที่ backend, สร้างไฟล์ใหม่ทุกครั้ง, รวมไม่สำเร็จไฟล์เดิมยังอยู่
- ไม่มี ffmpeg บนเซิร์ฟเวอร์ → ปุ่มรวมกดไม่ได้พร้อมเหตุผล และมี "เล่นต่อกันทุกฉาก" บนหน้าเว็บแทน — ตั้ง `FFMPEG_PATH` / `FFPROBE_PATH` ใน `.env` ได้
- cron ใหม่ `video-clips-sync` (ทุก 1 นาที) poll + ดาวน์โหลดคลิปที่ค้างเมื่อผู้ใช้ปิดแท็บ และเก็บงานค้าง (จองแล้วไม่มี job_id > 10 นาที, kie ไม่เสร็จ > 2 ชั่วโมง)
- ดาวน์โหลดคลิปแบบต่อจาก `.part` เดิม (HTTP Range) ถ้า CDN ของ kie รองรับ — ต้องทดสอบก่อน
- `ContentVideoView` (หน้ารีวิว) ดูได้อย่างเดียว — ไม่มีปุ่มที่ยิง kie และไม่มีปุ่มรวม
- ย้ายวิดีโอเดิมที่สร้างจากฉากแรกไปเป็นคลิปของฉาก 1 (`input_snapshot` จากค่าปัจจุบัน + `migrated: true`)

## Capabilities

### New Capabilities
- `video-clip-generation`: สร้างคลิปรายฉาก — ตาราง `content_video_clips`, `scene.id`, เงื่อนไขก่อนสร้าง, การจองแบบ atomic, การยิงหลายฉากใน request เดียว, `input_snapshot` และการตรวจคลิปล้าสมัย, การเลือก model, credit ประมาณการ/จริง, prompt เสียงบรรยากาศ, การย้ายวิดีโอเดิม
- `video-combine`: รวมคลิปเป็นวิดีโอเดียว — ตาราง `content_video_combines`, เงื่อนไขการรวม, การตรวจ ffmpeg, การปรับเสียงและต่อคลิป, การกันรวมซ้อน, วิดีโอรวมล้าสมัย, fallback เมื่อไม่มี ffmpeg
- `video-clips-sync-cron`: cron `video-clips-sync` — poll + ดาวน์โหลดคลิป, จำกัดจำนวนและเวลาต่อรอบ, เก็บงานค้าง, ใช้ lock/conditional update ร่วมกับการ poll จากหน้าเว็บ
- `video-clips-ui`: หน้าจอ 2 จังหวะ — คลิปในการ์ดฉาก, dialog ยืนยัน credit, ส่วนวิดีโอรวม, เหตุผลที่ปุ่มกดไม่ได้, polling, ป้ายในรายการคอนเทนต์, หน้ารีวิวแบบดูอย่างเดียว

### Modified Capabilities
- `video-generation-provider-contract`: เลิกใช้ `generate-video` / `video-status` แบบฉากแรก — payload ต่อตระกูล model และการ poll ต่อ adapter ใช้ต่อกับคลิปรายฉาก, model มาจาก `video_model_id` พร้อม fallback, prompt ของฉากที่ไม่มีบทพากย์ขอเสียงบรรยากาศ
- `video-result-local-storage`: ไฟล์ที่ดาวน์โหลดเป็นคลิปรายฉากบันทึกลง `content_video_clips.clip_url` (ไม่ใช่ `content_items.video_url`), รองรับการดาวน์โหลดต่อจาก `.part` และจำกัดเวลาดาวน์โหลดต่อครั้ง
- `content-video-ui-section`: ตัดปุ่ม "สร้างวิดีโอด้วย AI", การแสดงสถานะวิดีโอเดิม และ polling `video-status` ของ dialog — แทนด้วย capability `video-clips-ui`; หน้าจอยังต้องเก็บ `scene.id` เมื่อบันทึก
- `video-scene-motion-prompt`: `_visualsToScenes()` แจก `scene.id` และ `update-scene` / ทุกจุดที่เขียน scenes SHALL คง `scene.id` ไว้

## Impact

- **Database**: migration ใหม่ — ตาราง `content_video_clips`, `content_video_combines`, ลงทะเบียน cron `video-clips-sync` และสคริปต์ครั้งเดียว (แจก `scene.id` → ย้ายวิดีโอเดิมเป็นคลิปฉาก 1 → ล้างค่าวิดีโอบน item)
- **Backend**: `api/lib/kie-video.php` (prompt เสียงบรรยากาศ, ดาวน์โหลดต่อ/จำกัดเวลา), ใหม่ `api/lib/video-clips.php`, ใหม่ `api/lib/video-combine.php`, `api/brand-content.php` (`_visualsToScenes`, `update-scene`, เอา `generate-video`/`video-status` ออก, action ใหม่ `generate-clips` / `clip-status` / `combine-video` / `video-state`), `api/content-items.php` (ตัวนับคลิป/สถานะวิดีโอรวมในรายการ), ใหม่ `api/cron/video-clips-sync.php`, `.env.example`
- **Frontend**: `SceneCards.tsx`, ใหม่ `VideoClipsPanel.tsx`, ใหม่ `ClipCreditConfirmDialog.tsx`, `ContentCardDialog.tsx`, `views/ContentVideoView.tsx`, `tabs/ContentListTab.tsx`, `types.ts` และ tests ที่อ้าง `generate-video` / `video-status`
- **ภายนอก**: ffmpeg + ffprobe บนเซิร์ฟเวอร์ (local ติดตั้งแล้ว 9.0.2; production ต้องถามคนดูแล platform.ktnbs.com), kie.ai — ทดสอบ Range ของ CDN (ฟรี) และทดสอบจริงวิดีโอ 30 วินาที 4 คลิป (≈120 credit)
- **ไม่อยู่ในขอบเขต**: การโพสต์วิดีโอไป platform (Phase 5), ลบไฟล์วิดีโอเก่า/orphan (Video File Cleanup), ยอด credit คงเหลือจริงใน dialog, ทดสอบ/เปิดใช้ Seedance 2.0/2.5, จำกัดสิทธิ์การใช้ credit, fade ระหว่างฉาก, หน้าจอแอดมินแก้ราคา model
