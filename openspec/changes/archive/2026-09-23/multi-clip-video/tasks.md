## 1. ทดสอบก่อนเริ่ม (ข้อสมมติหลัก — ไม่เสีย credit)

- [x] 1.1 ทดสอบว่า CDN ของ kie.ai รองรับ HTTP Range: poll task เดิมของ 2 item ทดสอบ (`record-info`) เพื่อเอา URL ผลลัพธ์ (ถ้ายังไม่หมดอายุ) แล้วยิง `curl -r 0-1023 -I` / `-r 1024-` ตรวจ `206` + `Content-Range` — ถ้า URL หมดอายุแล้ว ให้ทดสอบในงาน 11.2 ตอนยิงจริงแทน และทำ resume แบบ fallback ได้ทั้งสองกรณี (206 ต่อท้าย / 200 เริ่มใหม่) — บันทึกผลลง design.md ข้อ 9; ถ้าไม่รองรับ หยุดตัดสินใจเรื่อง download worker กับผู้ใช้ก่อนทำกลุ่ม 7
- [x] 1.2 เทียบ `price_usd` ของ `veo3_fast`, `veo3`, `bytedance/seedance-1.5-pro` ใน `ai_models.features.video` กับหน้าราคาปัจจุบันของ kie.ai — ถ้าต่างให้เขียน migration แก้ `price_usd` (ใช้กับ credit ประมาณการ)
- [x] 1.3 ยืนยันรูปแบบ error ระดับบัญชีของ kie (HTTP status / `code` ใน body สำหรับ credit ไม่พอ, key ผิด, rate limit) จาก response ที่เคยได้และเอกสาร kie — บันทึกลง design.md ข้อ 6

## 2. ฐานข้อมูลและการย้ายข้อมูล

- [x] 2.1 migration `database/migrations/YYYY_MM_DD_HHMMSS_create_content_video_clips.sql`: ตาราง `content_video_clips` ตาม design ข้อ 1 (FK, index, `CREATE TABLE IF NOT EXISTS`)
- [x] 2.2 migration `..._create_content_video_combines.sql`: ตาราง `content_video_combines` ตาม design ข้อ 1
- [x] 2.3 migration `..._register_video_clips_sync_cron.sql`: `INSERT IGNORE` แถว `video-clips-sync` ใน `cron_jobs` แบบ `content-metrics-sync` (`type='include'`, `file_path='api/cron/video-clips-sync.php'`) ทุก 1 นาที — ตรวจคอลัมน์ความถี่ของ `cron_jobs` ก่อนเขียน
- [x] 2.4 รัน migration 2.1–2.3 กับ DB local สองรอบ ตรวจ `DESCRIBE content_video_clips`, `DESCRIBE content_video_combines`, `SELECT * FROM cron_jobs WHERE \`key\`='video-clips-sync'`
- [x] 2.5 สคริปต์ `scripts/migrate-multi-clip-video.php` (มี `--dry-run`): backup `content_items` (`id, article_content, video_*`) เป็นไฟล์ JSON → แจก `scene.id` ให้ฉากที่ไม่มี → สร้างคลิปฉาก 1 จาก `video_url`/`video_job_id` เดิม (`input_snapshot` จากค่าปัจจุบัน + `migrated: true`, credit NULL) → ล้าง `video_url`, `video_job_id`, `video_gen_status='none'` (คง `video_model_id`) — idempotent
- [x] 2.6 รันสคริปต์กับ local แบบ `--dry-run` แล้วรันจริงสองรอบ ตรวจว่า 2 item ทดสอบ (`5121176a`, `6b5732f2`) มีคลิปฉาก 1 `done` ชี้ไฟล์เดิม, ทุกฉากมี `id`, รอบสองไม่เกิดแถวใหม่

## 3. Backend: scene.id และ prompt

- [x] 3.1 `_visualsToScenes()` แจก `id` (`"sc_" + bin2hex(random_bytes(6))`, ใช้ `id` เดิมถ้า visual มี, กันซ้ำภายใน array)
- [x] 3.2 ตรวจทุก action ที่เขียน `article_content.scenes[]` (`generate-scene-images`, `generate-scene-image`, `update-scene`, `generate-scene-video-prompt`, `generate-article`, การบันทึกจาก dialog/`content-items.php` PUT) ว่าคง `id` ของฉากที่มีอยู่ — แก้จุดที่สร้าง scene ใหม่ทับ
- [x] 3.3 `kieVideoComposePrompt()`: `narration` ว่าง → ต่อท้ายคำสั่งเสียงบรรยากาศ ไม่มีเสียงพูด (design ข้อ 12)
- [x] 3.4 เพิ่มเคสใน `api/tests/kie-video-adapter-test.php`: prompt ไม่มีบทพากย์มีคำสั่งเสียงบรรยากาศ, `_visualsToScenes` ได้ `id` ไม่ซ้ำ และคง `id` เดิมของ visual

## 4. Backend: `api/lib/video-clips.php`

- [x] 4.1 `videoResolveModel(db, item, persist)` ตาม design ข้อ 4 (model ของวิดีโอ → fallback default → error ไทย)
- [x] 4.2 `videoClipCredits(model, resolution)` จาก `price_usd` / `price_unit` / `KIE_CREDIT_USD = 0.005` (ไม่มีราคา → null)
- [x] 4.3 `videoClipSnapshot(item, scene, model)` และ `videoClipStaleReasons(snapshot, current)` (trim, ลำดับเหตุผลคงที่, เมิน key `migrated`)
- [x] 4.4 `videoSceneReadiness(scene)` (ภาพ done + `video_prompt`) และ `videoPublicUrlOk()` (ปฏิเสธ localhost / 127.x / 10.x / 172.16–31.x / 192.168.x)
- [x] 4.5 `videoItemState(db, item)` — ประกอบข้อมูลของ `video-state`: Active Scene, คลิปที่ใช้งาน/generation ล่าสุดต่อ `scene_id`, stale reasons, ความพร้อม, คำแนะนำล้มซ้ำ (2 generation ล่าสุด failed + snapshot เท่ากันและเท่าค่าปัจจุบัน), คำเตือนบทยาว, ตัวนับ, `can_generate_all` + เหตุผล, `estimate`, ส่วน combine (ใช้ฟังก์ชันจากกลุ่ม 6)
- [x] 4.6 `videoReserveClip(db, item, sceneId, sceneIndex, snapshot, model, credits)` — transaction `FOR UPDATE` + ตรวจ generating + INSERT (design ข้อ 6)
- [x] 4.7 `KieVideoAccountException` ใน `kie-video.php` สำหรับ error ระดับบัญชี (ตามผลงาน 1.3) และให้ `kieVideoSubmit` โยนแยกประเภท
- [x] 4.8 `videoClipPollOne(db, clip, maxDownloadSeconds)` — poll ด้วย adapter ของ `clip.model_id`, ดาวน์โหลด, conditional UPDATE (`WHERE status='generating'`), เก็บ `credits_actual` จาก `creditsConsumed`
- [x] 4.9 เทสต์ `api/tests/video-clips-test.php`: stale reasons (แต่ละ field, แก้กลับ, ช่องว่าง, migrated), คลิปที่ใช้งาน (failed/generating ไม่แทน), credit (Veo Lite 720p = 30, 1080p = 35, Seedance 1.5 Pro 720p per_second × 8, ไม่มีราคา → null), readiness, public URL, resolve model (active / ถูกปิด → fallback + persist / ไม่มีทั้งคู่), การจองซ้อน (สองการเรียกติดกัน → ครั้งที่สองถูกปฏิเสธ), คำแนะนำล้มซ้ำ (นับใหม่เมื่อ snapshot เปลี่ยน)

## 5. Backend: ดาวน์โหลดต่อ

- [x] 5.1 `kieVideoDownload` รับ `?int $maxSeconds`, ทำ resume จาก `.part` ด้วย `CURLOPT_RANGE` (206 ต่อท้าย / 200 เริ่มใหม่ / 416 ครบ) และตรวจขนาดก่อน rename — ตามผลงาน 1.1
- [x] 5.2 เทสต์ใน `kie-video-adapter-test.php` ด้วย `php -S` ในเครื่องที่เสิร์ฟไฟล์พร้อม Range: ดาวน์โหลดครึ่งแรก หยุด แล้วต่อจนครบ ไฟล์ตรงต้นฉบับ (เทียบ hash) + เซิร์ฟเวอร์ที่ไม่รองรับ Range เริ่มใหม่ได้ถูกต้อง

## 6. Backend: `api/lib/video-combine.php`

- [x] 6.1 `videoFfmpegBinaries()` (`FFMPEG_PATH`/`FFPROBE_PATH` หรือชื่อเปล่า) และ `videoFfmpegAvailable()` (exec + disable_functions + `-version` rc=0 ทั้งสองตัว, ไม่ cache)
- [x] 6.2 `videoCombineState(db, item, activeScenes, activeClips)` — `can_combine` + เหตุผลรายฉาก, `combining` (ไม่หมดอายุ 10 นาที), วิดีโอรวมล่าสุด + stale reasons (ชุดฉากเปลี่ยน / ฉากมีคลิปใหม่ / คลิปใน `source_clips` ล้าสมัย)
- [x] 6.3 `videoCombineClips(ffmpeg, ffprobe, clipPaths, outPath)` — probe ความยาวภาพ, ปรับเสียง (AAC 48kHz stereo + `apad` + `-t`), ใส่ `anullsrc` เมื่อไม่มีเสียง, concat `-c copy -movflags +faststart`, `escapeshellarg` ทุก path, temp dir ลบใน `finally`, คืน stderr ท้ายเมื่อล้ม
- [x] 6.4 `videoReserveCombine` + `videoRunCombine(db, item)` — จอง (`FOR UPDATE`, 409 ถ้ามี combining ไม่หมดอายุ), รวม, UPDATE combine + `content_items.video_url`/`video_gen_status='done'` เมื่อสำเร็จ, `failed` + คง `video_url` เดิมเมื่อล้ม
- [x] 6.5 เทสต์ `api/tests/video-combine-test.php` (ข้ามพร้อมข้อความถ้าไม่มี ffmpeg): รวม 2 ไฟล์จริงใน `uploads/content/videos/` ลง temp, คลิปไม่มีเสียงกลางชุด, คลิปเสียง 44.1kHz (สร้างจากคลิปเดิมด้วย ffmpeg), ความต่างเสียง-ภาพ ≤ 0.1 วินาที, `moov` อยู่ก่อน `mdat`, ffmpeg ล้ม → `failed` และ `video_url` เดิมไม่เปลี่ยน, จองซ้อน → 409, stale ของวิดีโอรวม 3 แบบ + generation ใหม่ที่ failed ไม่ทำให้ล้าสมัย

## 7. Backend: API actions และ cron

- [x] 7.1 `api/brand-content.php`: เพิ่ม `video-state` (GET), `generate-clips` (POST `{item_id, scene_ids}` ตาม design ข้อ 6 — `ignore_user_abort`, model ครั้งเดียว, ตรวจซ้ำรายฉาก, หยุดเมื่อ error ระดับบัญชี, ผลรายฉาก), `clip-status` (GET, poll คลิป generating ของ Active Scene งบ ~20 วินาที แล้วคืน state), `combine-video` (POST)
- [x] 7.2 ลบ action `generate-video` และ `video-status` เดิม (และ helper ที่ไม่มีผู้ใช้แล้ว)
- [x] 7.3 `api/content-items.php` (list): query คลิป + combine ของ item วิดีโอในหน้าแบบ batch ครั้งเดียว แล้วส่ง `video_clips_ready`, `video_clips_total`, `video_combined_status` (`none` | `done` | `stale`)
- [x] 7.4 `api/cron/video-clips-sync.php`: งบ 40 วินาที, ≤ 30 คลิป `generating` + `job_id` เรียง `created_at ASC` ผ่าน `videoClipPollOne`, เก็บงานค้าง 3 แบบด้วย conditional UPDATE (จองไม่มี job_id > 10 นาที → failed "ส่งงานไม่สำเร็จ" credit 0/0; มี job_id > 2 ชั่วโมง → failed "หมดเวลา"; combining > 10 นาที → failed "รวมไม่สำเร็จ")
- [x] 7.5 `.env.example`: เพิ่ม `FFMPEG_PATH=` และ `FFPROBE_PATH=` พร้อมคำอธิบาย; ตั้งค่าใน `.env` local เป็น path ของ winget
  — หมายเหตุ: โปรเจกต์ไม่มี `.env.example` — ใส่ค่าพร้อมคำอธิบายใน `.env` local (path แบบ `/` ใช้ได้บน Windows) และบันทึกขั้นตอน deploy ใน design.md Migration Plan
- [x] 7.6 เทสต์ `api/tests/video-clips-api-test.php` (mock adapter ไม่ยิง kie จริง): `generate-clips` ยิงเฉพาะ `scene_ids` ที่ยังต้องสร้าง / ข้ามฉากที่ไม่ใช่ Active Scene / ข้ามฉากที่ไม่พร้อม / หยุดเมื่อ credit ไม่พอ / ยิงไม่ผ่าน credit 0/0, cron เก็บงานค้าง 3 แบบ, จำกัด 30 คลิป, conditional update ไม่ทับกัน
  — หมายเหตุ: รวมไว้ใน `api/tests/video-clips-test.php` (VC12–VC20) เพราะใช้ fixture ชุดเดียวกับกลุ่ม 4 — ทดสอบผ่าน `videoGenerateClips()` / `videoClipsSyncRun()` ที่ action/cron เรียก

## 8. Frontend

- [x] 8.1 `types.ts`: type `SceneClip`, `VideoSceneState`, `VideoItemState`, `VideoCombineState`, `id` ใน `Scene`, ฟิลด์ตัวนับใน `ContentItem`/`PlanItem`
- [x] 8.2 `ClipCreditConfirmDialog.tsx`: รายการฉากที่จะยิง, model/ความละเอียด, credit ต่อคลิปและรวม (หรือ "ไม่ทราบจำนวน credit"), คำเตือนบทยาว, ยืนยันส่ง `scene_ids` ชุดที่แสดง
- [x] 8.3 `VideoClipsPanel.tsx`: query `video-state`, ปุ่ม "สร้างคลิปทุกฉาก" + ตัวนับ + เหตุผลที่กดไม่ได้, ส่วนวิดีโอรวม (ปุ่ม + เหตุผล, player, ป้ายล้าสมัย, ไม่มี ffmpeg → "เล่นต่อกันทุกฉาก"), polling `clip-status` ทุก 5 วินาทีเฉพาะเมื่อมี generating แล้วหยุด, toast เมื่อคลิปเปลี่ยนสถานะ, prop `readOnly` และ `blockedReason`
- [x] 8.4 `SceneCards.tsx`: รับข้อมูลคลิปต่อฉาก (map ด้วย `scene.id`) — สถานะ, player แทนภาพ + ปุ่มสลับภาพ/คลิป (ไม่เรียก API), ป้ายล้าสมัยพร้อมเหตุผล, error, คำแนะนำล้มซ้ำ, ปุ่ม "สร้างคลิปฉากนี้"/"ลองใหม่" (ผ่าน dialog ยืนยัน), ซ่อนทุกปุ่มที่ใช้ kie เมื่อ `readOnly`
- [x] 8.5 `ContentCardDialog.tsx`: ใช้ `VideoClipsPanel`, เอาปุ่ม "สร้างวิดีโอด้วย AI" และ polling `video-status` เดิมออก, ส่ง dirty-state เป็น `blockedReason` "กรุณาบันทึกก่อนสร้างคลิป", ตรวจว่าการบันทึก `article_content`/`update-scene` คง `scene.id`
- [x] 8.6 `ContentVideoView.tsx`: ใช้ `VideoClipsPanel readOnly` — ไม่มีปุ่มสร้างคลิป/ลองใหม่/สร้างวิดีโอรวม, เอาปุ่มสร้างวิดีโอเดิมออก
- [x] 8.7 `ContentListTab.tsx`: ป้าย "คลิป X/N" และ "วิดีโอรวม ✓" / "วิดีโอรวม ⚠ ล้าสมัย"
- [x] 8.8 เทสต์ Vitest: แก้/ลบเทสต์เดิมที่อ้าง `generate-video`/`video-status` (`ContentVideoView.test.tsx`, `ContentCardDialogVideoPoll.test.tsx`), เพิ่ม `VideoClipsPanel.test.tsx` (ตัวนับ, เหตุผลปุ่ม, dialog ยืนยันส่ง `scene_ids` ถูกชุด, ยกเลิกไม่ยิง, polling หยุดและไม่เรียก `combine-video` เอง, ไม่มี ffmpeg → เล่นต่อกัน), `SceneCards` (สลับภาพ/คลิปไม่เรียก API, ป้ายล้าสมัย), `ContentVideoView` ไม่มีปุ่มที่เปลี่ยนข้อมูล, dialog ที่มีการแก้ไขค้าง → ปุ่มกดไม่ได้, การบันทึกคง `scene.id`

## 9. OpenSpec

- [x] 9.1 ตอน archive: อัปเดต Purpose ของ `video-generation-provider-contract` (เลิกอ้าง "scene แรกเท่านั้น") และ `video-result-local-storage` (บันทึกลงคลิป) ให้ตรงกับ requirement ใหม่

## 10. ตรวจสอบ

- [x] 10.1 `php -l` ทุกไฟล์ PHP ที่แก้/สร้าง และรันเทสต์ PHP ทั้งหมดของกลุ่ม 3–7 ผ่าน
- [x] 10.2 `pnpm lint`, `pnpm build`, `pnpm test` — เทียบกับ 8 เทสต์ที่ fail อยู่แล้วบน HEAD (ต้องไม่มี fail ใหม่)
- [x] 10.3 ตรวจผ่านหน้าเว็บ local (ไม่ยิง kie): item ทดสอบที่ย้ายมาแสดงคลิปฉาก 1, ตัวนับ "คลิป 1/N", ปุ่มรวมกดไม่ได้พร้อมเหตุผลของทุกฉาก, dialog ยืนยัน credit แสดงตัวเลขถูก, localhost → ปุ่มสร้างกดไม่ได้พร้อมเหตุผล, หน้ารีวิวไม่มีปุ่มที่เปลี่ยนข้อมูล
  — หมายเหตุ: ผ่านหน้าเว็บตรวจแล้ว: ป้าย "คลิป 1/4", "คลิป 1/5" ในรายการ, dialog แสดงคลิปฉาก 1 (player + "ดูภาพ"), ตัวนับ, localhost บล็อกปุ่มพร้อมเหตุผลทุกปุ่ม, ปุ่มรวมกดไม่ได้พร้อมเหตุผลฉาก 2–4 — dialog ยืนยัน credit เปิดในเบราว์เซอร์ไม่ได้เพราะ localhost บล็อก (ตรวจใน Vitest แทน และจะเห็นจริงในงาน 11.2) — หน้ารีวิวเปิดได้เฉพาะคอนเทนต์ที่รออนุมัติ ตรวจใน Vitest แทน
- [x] 10.4 ตรวจว่า Apache (ไม่ใช่ CLI) เรียก ffmpeg ได้: `video-state` รายงาน `ffmpeg_ok` เป็นจริงผ่านหน้าเว็บ
- [x] 10.5 ตรวจ cron จริง: `cron_runs` มีแถวของ `video-clips-sync` ทุกนาทีและไม่ error

## 11. ทดสอบจริงกับ kie.ai (ต้องมี credit ≥ 150 และ ngrok ชี้ port แยก)

- [ ] 11.1 สร้างคอนเทนต์วิดีโอ 30 วินาที 9:16 720p ผ่าน QuickCreate → สร้างภาพทุกฉาก → ตั้ง `VITE_APP_URL` เป็น URL ของ ngrok (ชี้เฉพาะ `php -S` port แยกที่เสิร์ฟภาพฉาก)
- [ ] 11.2 กด "สร้างคลิปทุกฉาก" ยืนยัน 4 คลิป (≈120 credit) — ปิดแท็บระหว่างรอเพื่อทดสอบ cron — เปิดกลับมาเห็นคลิปครบ (ทดสอบ Range กับ URL จริงถ้างาน 1.1 ทำไม่ได้)
- [ ] 11.3 กด "สร้างวิดีโอรวม" → เล่นไฟล์รวม ~32 วินาที ตรวจเสียงพากย์ต่อเนื่อง รอยต่อ และฉากที่ไม่มีบทพากย์มีแต่เสียงบรรยากาศ
- [ ] 11.4 แก้บทพากย์ 1 ฉาก บันทึก → คลิปฉากนั้นและวิดีโอรวมขึ้นล้าสมัยพร้อมเหตุผล → แก้กลับ → ป้ายหาย (ไม่ยิงใหม่เพื่อประหยัด credit เว้นแต่ผู้ใช้ต้องการ)
- [ ] 11.5 บันทึกผล (credit ที่ใช้จริง, เวลาที่ใช้, ปัญหาที่พบ) ลง design.md
