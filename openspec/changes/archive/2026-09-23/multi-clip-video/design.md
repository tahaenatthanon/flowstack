## Context

- หลัง A1 (`video-creation-options`) คอนเทนต์วิดีโอมี `article_content.scenes[]` ครบ N ฉาก (ฉากละ 8 วินาที, `video_prompt`, `narration`, ภาพตามอัตราส่วน) แต่ `generate-video` ยังยิงแค่ `scenes[0]` และเก็บผลไว้บน `content_items` (`video_job_id`, `video_url`, `video_gen_status`, `video_model_id`)
- adapter `api/lib/kie-video.php` (A2) รองรับ 2 ตระกูล (`veo`, `market`) ทั้ง submit/poll/download พร้อม lock และ `.part` อยู่แล้ว
- `article_content` ถูกเขียนทั้งก้อนจากหลายจุด (ปุ่ม "บันทึก" ของ dialog, `generate-article`, `generate-scene-images`, `update-scene` ฯลฯ) — เก็บสถานะงาน async ไว้ในนี้ไม่ได้เพราะจะถูกเขียนทับ
- ฉากทุกฉากเกิดจาก `_visualsToScenes()` ([brand-content.php:148](api/brand-content.php:148)) ที่เดียว — ภาพฉากที่สร้างใหม่ได้ชื่อไฟล์ใหม่เสมอ (`{itemId}_scene{idx}_{YmdHis}.jpg`) จึงเทียบ `image_url` เพื่อรู้ว่าภาพเปลี่ยนได้
- cron: `api/cron/tick.php` (Task Scheduler ทุก 1 นาที) include งาน `type='include'` ทุกงาน**ต่อกันในโปรเซสเดียว** — งานที่ค้างนานทำให้งานอื่น (เช่น `publish-scheduler`) ช้าตาม
- ffmpeg 9.0.2 (full build) ติดตั้งบน local แล้ว — ทดสอบจาก PHP CLI: `exec` ใช้ได้ (`disable_functions` ว่าง), ต่อคลิป Veo 720×1280 24fps AAC 48kHz ได้ทั้งแบบ copy ภาพ + ปรับเสียง, ใส่เสียงเงียบได้, เสียงเกินภาพคงที่ 0.021 วินาที (ไม่สะสม), `+faststart` ย้าย `moov` ไว้ต้นไฟล์ — production ยังไม่รู้ว่ามี ffmpeg หรือไม่
- ข้อมูลวิดีโอเดิมมีแค่ 2 item บน local (production ยังไม่เคย deploy)

## Goals / Non-Goals

**Goals:**
- สร้างคลิปได้ทุกฉากด้วย 2 จังหวะ (สร้างคลิปรายฉาก → ผู้ใช้กดรวม) โดยไม่เสีย credit ซ้ำจากการกดซ้ำ, หลายแท็บ, หรือข้อมูลถูกเขียนทับ
- ผู้ใช้รู้เสมอว่าคลิป/วิดีโอรวมตรงกับข้อมูลปัจจุบันหรือไม่ และเพราะอะไร
- งานไม่ค้างเมื่อผู้ใช้ปิดแท็บ และไม่ถ่วง cron อื่น
- ถ้าไม่มี ffmpeg ระบบยังใช้งานได้ (ดูคลิปต่อกันบนหน้าเว็บ)

**Non-Goals:**
- โพสต์วิดีโอไป platform (Phase 5), ลบไฟล์เก่า (Video File Cleanup), ยอด credit คงเหลือจริง, Seedance 2.0/2.5, จำกัดสิทธิ์การใช้ credit, transition/fade, หน้าจอแก้ราคา model, auto-combine

## Decisions

### 1. ตารางแยก 2 ตาราง แทนการเก็บใน `article_content`
```sql
content_video_clips (
  id CHAR(36) PK, tenant_id CHAR(36), item_id CHAR(36) FK→content_items ON DELETE CASCADE,
  scene_id VARCHAR(40), scene_index INT, model_id CHAR(36) FK→ai_models ON DELETE SET NULL,
  job_id VARCHAR(255) NULL, status ENUM('generating','done','failed'),
  clip_url VARCHAR(1000) NULL, error TEXT NULL, input_snapshot JSON,
  credits_estimated INT NULL, credits_actual INT NULL,
  created_at, completed_at NULL, updated_at,
  INDEX (item_id, scene_id, created_at), INDEX (status, created_at)
)
content_video_combines (
  id CHAR(36) PK, tenant_id, item_id FK→content_items ON DELETE CASCADE,
  status ENUM('combining','done','failed'), video_url VARCHAR(1000) NULL,
  source_clips JSON, error TEXT NULL, created_at, completed_at NULL, updated_at,
  INDEX (item_id, created_at)
)
```
- append-only ต่อ generation → มีประวัติ credit, poll ของงานเก่าไม่เขียนทับงานใหม่, `source_clips` อ้าง `clip_id` ได้ตรงๆ
- ทางเลือกที่ไม่เลือก: UNIQUE(item, scene) แล้วเขียนทับ (เสียประวัติ, race ระหว่าง generation), JSON ใน scenes (ถูก dialog เขียนทับ)
- `content_items.video_url` / `video_gen_status` คงไว้เป็น "วิดีโอรวมล่าสุดที่สำเร็จ" เพื่อให้จุดที่อ่านอยู่แล้ว (list, detail) ยังใช้ได้ — `video_job_id` เลิกใช้ (ไม่ลบคอลัมน์ใน change นี้)

### 2. `scene.id` = `"sc_" + 12 hex` จาก `random_bytes(6)`
- สั้นพอจะอ่านใน JSON/log, ไม่ซ้ำในทางปฏิบัติภายใน item เดียว (ตรวจซ้ำตอนแจกอีกชั้น)
- แจกใน `_visualsToScenes()` (ถ้า visual มี `id` อยู่แล้วใช้ต่อ) — จุดอื่นที่เขียน scenes ทำงานบน array ที่โหลดจาก DB จึงคง id โดยธรรมชาติ ยกเว้นฝั่ง dialog ที่ต้องตรวจว่า payload ตอนบันทึกส่ง `id` กลับครบ (task แยก + test)
- ฉากเก่าแจก id ด้วยสคริปต์ครั้งเดียว (ข้อ Migration Plan) ไม่แจกแบบ lazy ตอนอ่าน — lazy จะเกิด race กับ dialog ที่ถือสำเนาไม่มี id แล้วบันทึกทับ

### 3. Snapshot และการเทียบ (`api/lib/video-clips.php`)
- `videoClipSnapshot(item, scene, model)` → `{image_url, video_prompt, narration, model_id, duration_sec, aspect_ratio, resolution}` (ค่าข้อความผ่าน `trim`)
- `videoClipStaleReasons(snapshot, current)` คืน array เหตุผลไทยตามลำดับคงที่: ภาพฉากเปลี่ยน / Video Prompt เปลี่ยน / บทพากย์เปลี่ยน / model เปลี่ยน / ความยาวเปลี่ยน / อัตราส่วนเปลี่ยน / ความละเอียดเปลี่ยน — ว่าง = ไม่ล้าสมัย
- "current model" = ผลของ `videoResolveModel()` (ข้อ 4) แบบไม่เขียน DB — ถ้า model ของวิดีโอยังใช้ได้ ค่าเท่าเดิม คลิปไม่ล้าสมัย
- คำนวณตอนอ่านเท่านั้น (ไม่เก็บ flag) — snapshot ที่มี `migrated: true` เทียบแบบเดียวกัน (key `migrated` ไม่ถูกนำมาเทียบ)

### 4. เลือก model: `videoResolveModel(db, item, persist)`
1. `item.video_model_id` → `kieVideoLoadModel` สำเร็จและ `ai_models.status = 'active'` → ใช้
2. มิฉะนั้น `company_settings.ai_content_video_model_id` → ใช้ และถ้า `persist` บันทึกลง `item.video_model_id`
3. ไม่ได้ทั้งคู่ → RuntimeException ภาษาไทย
- `generate-clips` เรียกครั้งเดียวต่อคำขอ (persist) แล้วใช้ทุกฉาก — `video-state` เรียกแบบไม่ persist เพื่อคำนวณ stale และแสดงชื่อ model ใน dialog

### 5. Credit: คำนวณจาก `features.video.price_usd` ที่มีอยู่
- `credits = round(price_usd[res] × (price_unit = per_second ? duration : 1) / KIE_CREDIT_USD)` โดย `KIE_CREDIT_USD = 0.005` (ตรงกับที่ยืนยันแล้ว: Veo Lite 720p $0.15 = 30 credit, 1080p $0.175 = 35 credit)
- ทางเลือกที่ไม่เลือก: เพิ่มฟิลด์ `credits` แยกใน `features.video` (ข้อตกลงเดิมข้อ 4.1) — ข้อมูลซ้ำกับ `price_usd` ที่มีอยู่แล้วและจะ drift กันได้; แก้ราคาที่เดียว (migration ของ `price_usd`) ก็พอ — ยังคงเป้าหมายเดิมคือ "credit ต่อคลิปแยกตามความละเอียด" ครบ
- ไม่มี `price_usd` → `null` → UI แสดง "ไม่ทราบจำนวน credit"
- **ผลตรวจ (งาน 1.2, API ราคาสาธารณะ `POST https://api.kie.ai/client/v1/model-pricing/page`, 2026-09-23):** ตรงกับ DB ทุกตัว — Veo 3.1 image-to-video Lite 30/35, Fast 60/65, Quality 250/255 credit ต่อคลิป (720p/1080p); Seedance 1.5 Pro with audio 7/15 credit ต่อวินาที ($0.035/$0.075) → คลิป 8 วินาที = 56/120 credit — อัตรา $0.005/credit ยืนยันแล้ว ไม่ต้องมี migration แก้ราคา
- `credits_actual`: อ่าน `creditsConsumed` จาก poll ของ `market` ถ้ามี — `veo` ไม่มีข้อมูลนี้ → NULL

### 6. `generate-clips`: จองแบบ atomic แล้วยิงนอก transaction
```
ignore_user_abort(true); set_time_limit(0)
model = videoResolveModel(persist)          -- ครั้งเดียว
ตรวจ URL สาธารณะ (ไม่ใช่ localhost/127.x/10.x/172.16-31.x/192.168.x)
for scene_id in scene_ids (ตามลำดับฉาก):
  ถ้าเคยเจอ error ระดับบัญชี → skipped(เหตุผลเดิม); continue
  ถ้าไม่ใช่ Active Scene / ไม่พร้อม / ไม่ต้องสร้าง → skipped(เหตุผล); continue
  BEGIN; SELECT id FROM content_items WHERE id=? AND tenant_id=? FOR UPDATE
    latest = generation ล่าสุดของ scene_id; ถ้า generating → ROLLBACK; skipped("ฉากนี้กำลังสร้างอยู่")
    INSERT clip(status=generating, job_id=NULL, snapshot, credits_estimated)
  COMMIT
  try taskId = kieVideoSubmit(...) → UPDATE job_id
  catch → UPDATE failed, error, credits 0/0; ถ้าเป็นระดับบัญชี → จำเหตุผลไว้หยุดฉากที่เหลือ
```
- lock แถว `content_items` (ไม่ใช่ table lock) สั้นแค่ช่วงตรวจ+INSERT — kie ใช้เวลา 1–3 วินาทีอยู่นอก lock
- `kieVideoSubmit` ต้องคืนข้อมูลพอแยกประเภท error: เพิ่ม exception class `KieVideoAccountException` สำหรับ HTTP 401/402/429 หรือ `code` ใน body เป็น 401/402/429 (kie ใส่ `code` ใน body แม้ HTTP 200) — อย่างอื่นเป็น error ระดับฉาก
- คำขอฉากเดียว ("สร้างคลิปฉากนี้" / "ลองใหม่") ใช้ action เดียวกันด้วย `scene_ids` 1 รายการ
- **ผลตรวจ (งาน 1.3, เอกสาร docs.kie.ai/veo3-api/generate-veo-3-video):** kie ส่ง `code` ใน body — 401 key ไม่ถูกต้อง, 402 credit ไม่พอ, 429 ถูกจำกัดจำนวนคำขอ, 455 ปิดปรับปรุง, 505 ฟีเจอร์ถูกปิด, 400/422 prompt/พารามิเตอร์ไม่ผ่าน, 500/501 ล้มเหลว — กำหนด **ระดับบัญชี (หยุดฉากที่เหลือ) = `code` ใน body หรือ HTTP status ∈ {401, 402, 429, 455, 505}** (ทุกฉากที่เหลือจะล้มแบบเดียวกันแน่นอน) ส่วนที่เหลือเป็นระดับฉาก (ยิงฉากถัดไปต่อ)

### 7. API actions (ใน `api/brand-content.php`)
| action | method | หน้าที่ |
|---|---|---|
| `video-state` | GET `item_id` | ภาพรวมทั้งหมดที่ UI ต้องใช้: รายฉาก (`scene_id`, `index`, ความพร้อม + เหตุผล, คลิปที่ใช้งาน + stale reasons, generation ล่าสุด + error, คำแนะนำล้มซ้ำ, คำเตือนบทยาว), ตัวนับ, `can_generate_all` + เหตุผล, `estimate` (`model_name`, `resolution`, `credits_per_clip`), `combine` (`can_combine` + เหตุผล, `ffmpeg_ok`, `combining`, `latest` + stale reasons), `public_url_ok` |
| `generate-clips` | POST `{item_id, scene_ids}` | ข้อ 6 → `{results: [{scene_id, index, status, reason}], summary}` |
| `clip-status` | GET `item_id` | poll คลิป `generating` ของ Active Scene (งบเวลา ~20 วินาที/คำขอ) แล้วคืน `video-state` ชุดใหม่ |
| `combine-video` | POST `{item_id}` | ข้อ 8 → `{status, video_url}` หรือ 409/422 พร้อมเหตุผล |

- `generate-video` และ `video-status` ถูกลบ (BREAKING) — ไม่มี client อื่นนอกจาก 2 หน้าที่แก้ใน change นี้
- ตัวนับในรายการ: `content-items.php` query คลิปของ item ในหน้าเดียวครั้งเดียว (`WHERE item_id IN (...)`) แล้วคำนวณด้วยฟังก์ชันเดียวกับ `video-state` — ไม่ query ต่อ item

### 8. `combine-video` (`api/lib/video-combine.php`)
- `videoFfmpegBinaries()` → `[ffmpeg, ffprobe]` จาก `FFMPEG_PATH`/`FFPROBE_PATH` หรือชื่อเปล่า — `videoFfmpegAvailable()` ตรวจ `function_exists('exec')`, ไม่อยู่ใน `disable_functions`, และรัน `-version` ได้ rc=0 (ทุกครั้ง ไม่ cache)
- จอง: `BEGIN; SELECT ... FOR UPDATE content_items; ถ้ามี combines.status='combining' AND created_at > NOW()-10min → 409; INSERT combining(source_clips); COMMIT`
- รวม (คำสั่งที่ทดสอบแล้วบน local):
  1. ต่อคลิป: `ffprobe -select_streams v:0 -show_entries stream=duration` → `vd`; ตรวจแทร็กเสียงด้วย `-select_streams a`
  2. มีเสียง: `ffmpeg -i clip -map 0:v:0 -map 0:a:0 -c:v copy -af aresample=48000,apad -t vd -c:a aac -ar 48000 -ac 2 norm_i.mp4`
     ไม่มีเสียง: `ffmpeg -i clip -f lavfi -i anullsrc=r=48000:cl=stereo -map 0:v:0 -map 1:a:0 -c:v copy -t vd -c:a aac -ar 48000 -ac 2 norm_i.mp4`
  3. `ffmpeg -f concat -safe 0 -i list.txt -c copy -movflags +faststart {itemId}_combined_{YmdHis}_{rand}.mp4`
- ไฟล์ชั่วคราวอยู่ใน `sys_get_temp_dir()/flowstack-combine-{combineId}/` ลบใน `finally`
- สำเร็จ → UPDATE combine `done` + UPDATE `content_items.video_url`, `video_gen_status='done'` (conditional `WHERE status='combining'`) — ล้มเหลว → `failed` + error (stderr ส่วนท้าย), ไม่แตะ `video_url`
- ทำใน request (sync) เพราะ copy ภาพ + เข้ารหัสเสียงใช้ไม่กี่วินาทีต่อ 11 คลิป — ทางเลือก async ผ่าน cron ไม่คุ้มความซับซ้อน
- concat แบบ copy ภาพต้องการ codec/ขนาด/fps เดียวกัน — รับประกันโดยกติกา "ทุกคลิปไม่ล้าสมัย" (model/ความละเอียด/อัตราส่วนเดียวกัน) ถ้า ffmpeg ยังล้มเพราะ stream ไม่ตรง จะเป็น `failed` พร้อม error ให้เห็น ไม่ fallback ไป re-encode แบบเงียบ

### 9. ดาวน์โหลด: เพิ่ม resume + งบเวลาใน `kieVideoDownload`
- signature เพิ่ม `?int $maxSeconds` — curl `CURLOPT_TIMEOUT = maxSeconds`
- ถ้ามี `.part` และ CDN รองรับ Range → `CURLOPT_RANGE = "{size}-"` + เปิดไฟล์แบบ append; ตอบ 206 → ต่อท้าย, ตอบ 200 → เริ่มใหม่ (truncate), 416 → ถือว่าครบ
- งานแรกของ tasks คือทดสอบ Range กับ URL จริงของ kie (ฟรี) — ถ้าไม่รองรับ: ตัด resume ออก, บันทึกผลใน design แล้วตัดสินใจเรื่อง worker แยกก่อนทำ cron
- ขนาดไฟล์ปลายทางตรวจจาก `Content-Range`/`Content-Length` ก่อน rename `.part` → `.mp4`
- **ผลทดสอบ (งาน 1.1, 2026-09-23):** `tempfile.aiquickdraw.com` ตอบ `Accept-Ranges: bytes`; `-r 0-1023` → `206` + `content-range: bytes 0-1023/3542536`; `-r 1000000-` → `206` และ md5 ของไบต์ที่ได้ตรงกับไฟล์ที่ดาวน์โหลดไว้ → **รองรับ resume ใช้ `.part` ต่อไฟล์เดิม ไม่ต้องแยก download worker** (รอบทดสอบนี้ CDN เร็ว ~3.5MB/s)
- ข้อสังเกตเพิ่ม: task เก่า (`e9ce6de0…` อายุหลายวัน) poll ได้ `Record not found for taskId` → adapter แปลงเป็น `failed` อยู่แล้ว; URL ผลลัพธ์ของอีก task ยังดาวน์โหลดได้ — kie ลบ record ภายในไม่กี่วัน การดาวน์โหลดจึงต้องเสร็จก่อนนั้น (cron ทุก 1 นาทีครอบคลุม)

### 10. cron `video-clips-sync.php`
- งบเวลา 40 วินาที (วัดด้วย `microtime`) — poll ≤ 30 คลิป `generating` + มี `job_id` เรียง `created_at ASC` ข้ามทุก tenant แล้วดาวน์โหลดด้วยงบที่เหลือ
- ใช้ฟังก์ชัน `videoClipPollOne(db, clip, maxDownloadSeconds)` ตัวเดียวกับ `clip-status` — lock + conditional update อยู่ในฟังก์ชันนี้
- เก็บงานค้าง 3 แบบ (conditional UPDATE) ตาม spec `video-clips-sync-cron`
- ลงทะเบียนด้วย migration แบบ `content-metrics-sync` (ต้องตรวจคอลัมน์ `cron_jobs` ที่ใช้กำหนดความถี่จริงตอนเขียน migration)

### 11. Frontend
- ใหม่ `VideoClipsPanel` (query `['content','video-state',itemId]`) ใช้ใน `ContentCardDialog` และ `ContentVideoView` (`readOnly`) — `SceneCards` รับข้อมูลคลิปต่อฉากจาก panel ผ่าน prop (map ด้วย `scene.id`)
- `ClipCreditConfirmDialog` แสดงรายการฉากจาก `video-state` ที่ต้องสร้าง; ยืนยันส่ง `scene_ids` ชุดที่แสดง
- dirty-state ของ dialog (มีอยู่แล้ว) ส่งเข้า panel เป็น `blockedReason` → ปิดปุ่มที่ใช้ credit
- polling: `refetchInterval` 5000 เฉพาะเมื่อ state มีคลิป `generating` ผ่าน `clip-status`; หยุดเมื่อไม่มี
- "เล่นต่อกันทุกฉาก": `<video>` ตัวเดียวเปลี่ยน `src` ตาม `onEnded`
- ลบ polling `video-status` และปุ่ม "สร้างวิดีโอด้วย AI" เดิมใน dialog/view

### 12. prompt เสียงบรรยากาศ
- `kieVideoComposePrompt()` เมื่อ `narration` ว่าง → `"{video_prompt}. Ambient sound and natural background audio only — no speech, no dialogue, no narration."` — ตรงกับ snapshot เพราะ snapshot เก็บ `narration` ว่าง (ไม่ต้องเก็บ prompt ที่ประกอบแล้ว)

## Risks / Trade-offs

- [CDN ของ kie ไม่รองรับ Range] → คลิปที่ CDN ช้ามากอาจโหลดไม่เสร็จในงบ 40 วินาที → ทดสอบเป็นงานแรก; ถ้าไม่รองรับ ตัดสินใจเรื่อง download worker แยกก่อนทำ cron (ไม่ตัดสินใจล่วงหน้า)
- [Apache รันด้วยสิทธิ์/PATH ต่างจาก CLI] → ใช้ `FFMPEG_PATH`/`FFPROBE_PATH` แบบ path เต็ม และทดสอบ `combine-video` ผ่านหน้าเว็บจริง
- [kie จำกัดจำนวนงานพร้อมกัน (ยังไม่เคยยิงเกิน 1)] → 429 ถูกจัดเป็น error ระดับบัญชี: หยุดฉากที่เหลือ ผู้ใช้กดใหม่ภายหลัง; ยืนยันพฤติกรรมจริงตอนทดสอบ 4 คลิป
- [โปรเซสดับหลัง kie รับงานแต่ก่อนบันทึก `job_id`] → งานนั้นเสีย credit โดยระบบไม่รู้ — cron เปลี่ยนเป็น failed หลัง 10 นาที; ยอมรับได้เพราะช่วงเวลาสั้นมาก (หลัง response กลับ มีแค่ UPDATE เดียว)
- [Seedance เสียง 44.1kHz / ยังไม่ได้ทดสอบต่อจริง] → ขั้นปรับเสียงแปลงเป็น 48kHz ทุกคลิปอยู่แล้ว; เพิ่มเทสต์ด้วยไฟล์ 44.1kHz ที่สร้างจาก ffmpeg
- [ความต่อเนื่องของภาพระหว่างฉาก (หน้าตาคน/สินค้าเปลี่ยน)] → อยู่นอกการควบคุมของ change นี้ ดูผลจากการทดสอบจริง
- [ตัวนับในหน้ารายการต้องอ่าน `article_content` + คลิปทุก item] → query คลิปแบบ batch ครั้งเดียวต่อหน้า; ถ้าช้าค่อยพิจารณา cache ภายหลัง
- [ลบ `generate-video`/`video-status` (BREAKING)] → ผู้ใช้เดียวคือ 2 หน้าที่แก้ใน change นี้; ไม่มี mobile/integration อื่น
- [ไฟล์สะสมในดิสก์] → ตั้งใจไม่ลบใน change นี้; ประมาณ 2.5–3.5MB/คลิป — แยกงาน Video File Cleanup

## Migration Plan

1. SQL migration: สร้าง `content_video_clips`, `content_video_combines`; ลงทะเบียน cron `video-clips-sync` (INSERT IGNORE) — รันทันทีบน local ตามกติกาโปรเจกต์
2. สคริปต์ครั้งเดียว `scripts/migrate-multi-clip-video.php` (PHP เพราะต้องแก้ JSON ใน `article_content`) — backup `content_items` (`id, article_content, video_*`) ลงไฟล์ JSON ก่อน แล้ว (1) แจก `scene.id` ให้ฉากที่ไม่มี (2) สร้างคลิปฉาก 1 จาก `video_url`/`video_job_id` เดิม (`migrated: true`, credit NULL) (3) ล้าง `video_url`, `video_job_id`, `video_gen_status='none'` — idempotent (ข้าม item ที่มีคลิป `migrated` แล้ว / ฉากที่มี id แล้ว), มีโหมด `--dry-run`
3. deploy production: รัน SQL migrations ตามลำดับ → รันสคริปต์ข้อ 2 → ตั้ง `FFMPEG_PATH`/`FFPROBE_PATH` (ถ้ามี ffmpeg) → เปิดใช้งาน
4. Rollback: โค้ดเดิมใช้คอลัมน์บน `content_items` ที่ยังไม่ถูกลบ — คืนค่า `video_url`/`video_job_id`/`video_gen_status` จากไฟล์ backup ของข้อ 2 แล้ว revert โค้ด; ตารางใหม่และ `scene.id` ใน JSON ไม่กระทบโค้ดเดิม (key ที่ไม่รู้จักถูกเมิน)

## Open Questions

- CDN ของ kie (`tempfile.aiquickdraw.com`) รองรับ HTTP Range หรือไม่ → ทดสอบเป็นงานแรก
- kie ส่ง error ระดับบัญชีด้วย HTTP status หรือ `code` ใน body แบบใด (401/402/429) → ยืนยันจาก response จริงที่เคยได้ + เอกสาร kie ตอน implement
- ราคา Veo Fast/Quality และ Seedance 1.5 Pro ใน `price_usd` ตรงกับหน้าราคาปัจจุบันของ kie หรือไม่
- production มี ffmpeg หรือไม่ → ถามคนดูแล platform.ktnbs.com ตอนคุยเรื่อง deploy (ไม่บล็อก change นี้)
