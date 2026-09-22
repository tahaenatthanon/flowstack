## Context

`generate-video`/`video-status` ([api/brand-content.php:3444-3642](api/brand-content.php:3444)) ถูกเขียนขึ้นตาม contract ที่สมมติเอาเอง (`POST {baseUrl}/video/generations` รับ `scenes[]` array, `GET {baseUrl}/video/generations/{jobId}` คืน `status`) ไม่เคยตรงกับ provider จริงเลยสักตัว — เช็คกับ kie.ai (provider เดียวที่ตั้งค่าไว้จริงในระบบ ผ่าน `tenant-default.ai_content_video_model_id → model_id=veo3 → provider-kieai → https://api.kie.ai/api/v1`) ยืนยันแล้วว่า:

- `POST /api/v1/veo/generate` มีอยู่จริง (ทดสอบยิงจริงด้วย credential ในระบบ ได้ `422 Please enter prompt` ไม่ใช่ 404) — เป็น endpoint รุ่นเก่า
- เอกสารทางการล่าสุด (`docs.kie.ai`) ระบุ endpoint ปัจจุบันคือ `POST /api/v1/jobs/createTask` (unified endpoint สำหรับหลายโมเดลใน Market category) และ poll ที่ `GET /api/v1/jobs/recordInfo?taskId=...`
- ตัวอย่าง payload จริง: `{"model": "veo-3-1", "callBackUrl": "...", "input": {"prompt": "...", "image_urls": [...สูงสุด 2 รูป], "aspect_ratio": "16:9", "generation_type": "..."}}` → response `{"code": 200, "msg": "success", "data": {"taskId": "veo_task_..."}}`
- poll response: `{"code", "msg", "data": {"taskId", "state": "waiting|queuing|generating|success|fail", "resultJson": "{\"resultUrls\":[...]}" (เป็น JSON string ซ้อนอีกชั้น), "failMsg", "creditsConsumed", ...}}`
- ไม่มี parameter คุมความยาววิดีโอเลย — ความยาวคลิปตายตัวตามโมเดล และรับภาพอ้างอิงได้สูงสุด 2 รูปต่อคำขอ (ไม่ใช่ multi-scene stitching)

เพราะ kie.ai ไม่รองรับ multi-scene ในคำขอเดียว งานนี้จึงจำกัดให้ Phase 1 ทำงานกับ **1 scene ต่อ content item** เท่านั้น (พิสูจน์ contract ให้ทำงานจริงก่อน) multi-scene + ต่อคลิปเป็นไฟล์เดียวเป็นงาน Phase 2 แยกต่างหากที่ต้องมี video-editing layer ใหม่ทั้งหมด (ยังไม่มีอยู่ในระบบเลย ไม่มี ffmpeg ติดตั้งด้วย)

## Goals / Non-Goals

**Goals:**
- `generate-video` ยิง `POST {baseUrl}/api/v1/jobs/createTask` ด้วย payload ที่ตรงกับ kie.ai จริง ใช้ scene แรกที่มี `image_url` (มีครบทุก scene อยู่แล้วเพราะผ่าน validation เดิมที่บังคับทุก scene ต้องมีภาพก่อน)
- `video-status` ยิง `GET {baseUrl}/api/v1/jobs/recordInfo?taskId=...` แปลง `state`/`resultJson.resultUrls[0]` กลับเป็น contract เดิมที่ frontend รู้จัก (`status: generating/done/failed`, `video_url`)
- Response ที่ frontend เห็นไม่เปลี่ยนแปลงเลย — คอลัมน์ DB เดิม (`video_gen_status`, `video_job_id`, `video_url`) ยังใช้ชื่อ/ความหมายเดิมทุกประการ (เก็บ `taskId` ไว้ในคอลัมน์ `video_job_id` เดิม ไม่เพิ่มคอลัมน์ใหม่)
- ยืนยัน `model` field ที่ถูกต้องด้วยการทดสอบยิงจริง 1 ครั้งก่อนปิดงาน

**Non-Goals:**
- ไม่ทำ multi-scene stitching (Phase 2)
- ไม่เพิ่ม UI ใดๆ — ปุ่ม/สถานะที่ `ContentVideoView.tsx`/`ContentCardDialog.tsx` แสดงอยู่ตอนนี้ใช้ต่อได้เลยไม่ต้องแก้
- ไม่แก้ `generate-scene-images` (Step 2) — ใช้ endpoint คนละตัว (`/images/generations`) ที่ยืนยันว่าทำงานถูกต้องอยู่แล้ว
- ไม่แก้ narration/duration_sec ต่อ scene (Phase 2)
- ไม่รองรับ `callBackUrl` แบบ webhook จริง — เครื่อง dev (XAMPP local) ไม่มี URL สาธารณะให้ kie.ai เรียกกลับได้ ส่ง `callBackUrl: null` แล้วพึ่ง polling อย่างเดียว (โค้ดมี pattern นี้อยู่แล้ว)

## Decisions

### 1. เลือก scene แรกที่มี `image_url` สำหรับ Phase 1 (ไม่ใช่ทุก scene)

`generate-video` ปัจจุบัน validate ว่าทุก scene ต้องมี `image_url` ก่อนอยู่แล้ว (บรรทัด 3474-3485) — เก็บ validation นี้ไว้เหมือนเดิม (ยังต้องกด "สร้างภาพทุกฉาก" ให้ครบก่อน เพื่อไม่ทำลาย UX เดิม) แต่ตอนสร้าง payload จริง ใช้แค่ `scenes[0]` (scene แรก) เป็น input เดียวที่ส่งไป kie.ai

**ทางเลือกที่ไม่เลือก**: ให้เลือก scene ที่ "สำคัญที่สุด" ด้วย heuristic บางอย่าง (เช่น scene ที่ยาวสุด) — เพิ่มความซับซ้อนโดยไม่จำเป็น เพราะ Phase 1 มีไว้แค่พิสูจน์ contract ไม่ใช่ production behavior สุดท้าย (Phase 2 จะเปลี่ยนพฤติกรรมนี้ทั้งหมดอยู่ดี)

### 2. Payload shape สำหรับ `createTask`

```php
$payload = [
    'model'       => $videoModelName,   // จาก DB — ต้องยืนยันค่าจริงก่อน (ดู Open Questions)
    'callBackUrl' => null,
    'input'       => [
        'prompt'          => $scene['visual_prompt'] ?? '',
        'image_urls'      => [$scene['image_url']],
        'aspect_ratio'    => '9:16',   // วิดีโอ social/vertical เป็นค่าเริ่มต้น — ไม่มี field นี้ในระบบตอนนี้
    ],
];
```

`generation_type` **ไม่ใส่ในรอบแรก** (ปล่อยให้ default ของ kie.ai ตัดสิน) เพราะเอกสารตัวอย่างที่เห็นใช้ `REFERENCE_2_VIDEO` คู่กับภาพ 2 รูป ซึ่งไม่ตรงกับเคสของเรา (มีแค่ 1 รูปอ้างอิง) — ค่าที่ถูกต้องสำหรับ "1 ภาพ → วิดีโอ" ต้องยืนยันจากการทดสอบยิงจริง ไม่เดาใส่ไปเฉยๆ

**อัปเดตหลังทดสอบยิงจริง (task 1.2)**: `model: "veo3"`, ไม่มี `generation_type`, `aspect_ratio: "9:16"` — ทั้งหมดผ่าน field validation ของ kie.ai จริง (ได้ `402 Credits insufficient` ไม่ใช่ `400`/`422`) ยืนยันว่า payload shape ด้านบนถูกต้อง ไม่ต้องปรับเพิ่ม

**พบเพิ่มระหว่าง implement (ไม่ได้คาดไว้ตอนแรก) — 2 จุดที่ต้อง normalize ก่อนใช้งานจริง**:
1. `$videoBaseUrl` จาก `ai_providers.api_base_url` ของ kie.ai เก็บเป็น `https://api.kie.ai/api/v1` (มี `/api/v1` ต่อท้ายอยู่แล้ว) — ต้อง `preg_replace('#/api/v1$#', '', $videoBaseUrl)` ก่อนต่อ `/api/v1/jobs/...` ไม่งั้น path จะซ้อนกันเป็น `/api/v1/api/v1/jobs/...` (404)
2. `scene['image_url']` ที่เก็บใน `article_content` เป็น relative path (`/uploads/content/...`) ไม่ใช่ URL เต็ม ต้องแปลงเป็น absolute ด้วย `VITE_APP_URL` ก่อนส่งเป็น `image_urls` (เหมือน pattern ที่มีอยู่แล้วสำหรับ product reference images ในไฟล์เดียวกัน) — ไม่งั้น kie.ai ดึงภาพไม่ได้เลยถ้า `VITE_APP_URL` ไม่ใช่ host ที่เข้าถึงได้จริงจากอินเทอร์เน็ต (เช่นตอน dev local ต้องมี tunnel เช่น ngrok ก่อน)

### 3. อ่าน response ตอนสร้าง task

```php
$dec = json_decode($res, true);
$taskId = $dec['data']['taskId'] ?? null;
if (!$taskId) {
    $err = $dec['msg'] ?? substr($res, 0, 300);
    jsonError('Video API ไม่คืน taskId กลับ: ' . $err, 500);
}
// เก็บ taskId ลงคอลัมน์ video_job_id เดิม (ไม่เปลี่ยนชื่อคอลัมน์)
```

ตัด branch "synchronous response (direct URL)" เดิมทิ้ง (บรรทัด 3551-3561) — kie.ai เป็น async เสมอ ไม่มีทาง sync

### 4. อ่าน response ตอน poll — ต้อง decode ซ้อน 2 ชั้น

```php
$dec = json_decode($res, true);
$state = $dec['data']['state'] ?? 'generating';

if ($state === 'success') {
    $result = json_decode($dec['data']['resultJson'] ?? '{}', true);  // ← ซ้อนอีกชั้น
    $videoUrl = $result['resultUrls'][0] ?? '';
    // → status: 'done', video_url: $videoUrl
} elseif ($state === 'fail') {
    $errMsg = $dec['data']['failMsg'] ?? 'Unknown';
    // → status: 'failed', error: $errMsg
} else {
    // waiting/queuing/generating → status: 'generating' (คงพฤติกรรม poll ต่อเหมือนเดิม)
}
```

## Risks / Trade-offs

- **[Risk]** `model` field ไม่ยืนยัน (DB มี `veo3`, เอกสารตัวอย่างใช้ `veo-3-1`) → **Mitigation**: ทดสอบยิงจริง 1 ครั้งก่อนปิดงาน (task แยกใน tasks.md) ถ้าค่าใน DB ผิดจริง ต้องอัปเดต `ai_models.model_id` ของ record นั้นด้วย ไม่ใช่แค่แก้โค้ด
- **[Risk]** `generation_type`/`aspect_ratio` ที่ถูกต้องสำหรับเคส "1 ภาพ → วิดีโอ" ยังไม่ยืนยัน 100% จากเอกสารอย่างเดียว → **Mitigation**: การทดสอบยิงจริงเดียวกันในข้อบนจะเผยค่าที่ถูกต้อง (หรือ error message ที่บอกว่าต้องแก้อะไร) ปรับ payload ตามผลจริงที่ได้ ไม่ fix ค่าตายตัวไว้ก่อนวันทดสอบ
- **[Trade-off]** จำกัดแค่ 1 scene ต่อ content item ใน Phase 1 แปลว่าวิดีโอที่ได้ "ไม่ใช่ผลลัพธ์สุดท้าย" ที่ใช้งานจริงได้ (แค่คลิปสั้นจาก scene เดียว) — ยอมรับเพราะเป้าหมาย Phase 1 คือพิสูจน์ contract ไม่ใช่ส่งมอบฟีเจอร์ที่ใช้งานได้เต็มรูปแบบ (นั่นคือ Phase 2)
- **[Risk]** ทดสอบยิงจริงจะเสียเครดิตจริงจากบัญชี kie.ai ของทีม (ครั้งก่อนเช็คเหลือ 56.0 เครดิต) → **Mitigation**: ต้องขอ confirm จากผู้ใช้ก่อนยิงจริงทุกครั้ง (ตาม pattern เดียวกับที่ทำตอนสำรวจ endpoint ก่อนหน้านี้ในบทสนทนา)

## Migration Plan

ไม่มี migration ฐานข้อมูล — ใช้คอลัมน์ `video_gen_status`/`video_job_id`/`video_url` เดิมทั้งหมด Rollback คือ revert commit ของ `api/brand-content.php` เพียงไฟล์เดียว

## Open Questions

- `model` field ที่ถูกต้อง (`veo3` หรือ `veo-3-1` หรือค่าอื่น) — ต้องทดสอบยิงจริงก่อนถึงจะรู้แน่ชัด (มี task แยกใน tasks.md สำหรับเรื่องนี้โดยเฉพาะ ก่อน implement payload สุดท้าย)
- `generation_type` ที่ถูกต้องสำหรับ "1 ภาพ → วิดีโอ" — เอกสารที่มีตอนนี้ไม่ครอบคลุมเคสนี้ตรงๆ ต้องดูจาก error message ตอนทดสอบจริงหรือลองไม่ใส่ก่อน
