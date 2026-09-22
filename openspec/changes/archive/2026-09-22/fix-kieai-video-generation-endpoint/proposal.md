## Why

`generate-video`/`video-status` (`api/brand-content.php`) ยิง `POST {baseUrl}/video/generations` และ `GET {baseUrl}/video/generations/{jobId}` ซึ่ง**ไม่มีอยู่จริง** — ตรวจสอบกับ kie.ai (provider ที่ตั้งค่าไว้จริงในระบบ, `model=veo3` ผ่าน `provider-kieai`, `https://api.kie.ai/api/v1`) ยืนยันแล้วทั้งจากการทดสอบยิงจริง (`POST /api/v1/veo/generate` คืน `422 Please enter prompt` แปลว่ามีจริง) และเอกสารทางการล่าสุด (`https://docs.kie.ai`) ว่า endpoint จริงคือ `POST /api/v1/jobs/createTask` (สร้าง task) และ `GET /api/v1/jobs/recordInfo?taskId=...` (poll ผล) — payload/response shape ก็ต่างจากที่โค้ดคาดไว้ทั้งหมด ปุ่ม "สร้างวิดีโอ" จึงต้อง error ทุกครั้งที่กดในสภาพปัจจุบัน ไม่เคยมีทางสำเร็จได้เลย

เพิ่มเติม: kie.ai รองรับแค่ 1 request = 1 คลิปวิดีโอ (ไม่มี parameter คุมความยาว, `image_urls` รับได้สูงสุด 2 รูปสำหรับ first/last-frame เท่านั้น) — payload ปัจจุบันที่ส่ง `scenes[]` เป็น array หลายฉากพร้อม `narration`/`duration_sec` ต่อฉากในคำขอเดียว จึงไม่มีทางตรงกับ contract จริงได้เลยเช่นกัน ไม่ใช่แค่ path ผิด

## What Changes

- แก้ `generate-video` ให้ยิง `POST {baseUrl}/api/v1/jobs/createTask` ด้วย payload ที่ตรงกับ kie.ai จริง (`{model, callBackUrl: null, input: {prompt, image_urls, aspect_ratio, generation_type}}`) และอ่าน `data.taskId` แทน `job_id`/`id` เดิม
- แก้ `video-status` ให้ยิง `GET {baseUrl}/api/v1/jobs/recordInfo?taskId=...` และอ่าน `state` (`waiting`/`queuing`/`generating`/`success`/`fail`) + `resultJson.resultUrls[]` (ต้อง `json_decode` ซ้อนอีกชั้นเพราะ `resultJson` เป็น JSON string) แทน `status`/`video_url` เดิม
- **จำกัดขอบเขต Phase 1 ไว้แค่ 1 scene ต่อ content item** (ใช้ scene แรกที่มี `image_url` เป็น input) เพื่อพิสูจน์ contract จริงก่อน — ไม่ทำ multi-scene stitching ในงานนี้ (จะทำใน Phase 2 แยกต่างหาก ซึ่งต้องมี video-editing layer ต่อคลิปหลายไฟล์ที่ระบบยังไม่มีเลย)
- **Response contract ที่ frontend เห็นไม่เปลี่ยน** — `ContentVideoView.tsx`/`ContentCardDialog.tsx` ยังคงได้ `{status: 'generating', video_job_id}` ตอนสร้าง และ `{status: 'done'/'failed', video_url?, error?}` ตอน poll เหมือนเดิมทุกประการ ไม่ต้องแก้ UI เลย
- **BREAKING (ภายใน)**: ทิ้ง field `narration`/`duration_sec`/`shot`/`title` ต่อ scene ที่เคยส่งใน payload เดิม (ไม่มีที่ใน contract จริงของ kie.ai) — field เหล่านี้ไม่เคยถูก AI generate อยู่แล้วในทางปฏิบัติ (เช็คแล้วว่าว่างเปล่า/ค่า default เสมอ) จึงไม่กระทบข้อมูลจริง

## Capabilities

### New Capabilities
- `video-generation-provider-contract`: กำหนด request/response contract ที่แท้จริงระหว่าง `generate-video`/`video-status` กับ kie.ai (`POST /api/v1/jobs/createTask`, `GET /api/v1/jobs/recordInfo`) รวมถึงขอบเขตว่า Phase 1 รองรับแค่ 1 scene ต่อคำขอ

### Modified Capabilities
- ไม่มี — `scene-generation-from-visuals` (fallback visuals→scenes, UI gating) ไม่ถูกแตะเลยในงานนี้ เพราะงานนี้แก้แค่การเรียก provider จริง ไม่แก้ logic การแปลง scenes

## Impact

- Backend: `api/brand-content.php` (`generate-video` action ~บรรทัด 3444-3567, `video-status` action ~บรรทัด 3570)
- ไม่กระทบ Database schema — ไม่มี column/field ใหม่ ไม่มี migration
- ไม่กระทบ Frontend เลย — response contract เดิมคงอยู่ 100%
- ไม่กระทบ `generate-scene-images` (Step 2 สร้างภาพต่อฉาก) — ใช้ endpoint คนละตัว (`/images/generations`) ที่ยืนยันแล้วว่าทำงานถูกต้องอยู่แล้ว
- นอกสโคป (Phase 2 แยกต่างหาก): multi-scene stitching, adaptive scene-count formula ตามความยาวที่เลือก, narration/duration_sec ต่อ scene จาก Script Sections, ติดตั้ง ffmpeg
- **ความเสี่ยงที่ต้องจัดการก่อนปิดงาน**: ยังไม่ยืนยัน `model` field ที่ถูกต้อง — DB เก็บ `model_id=veo3` (จาก catalog sync ของ kie.ai) แต่ตัวอย่าง payload ในเอกสารล่าสุดใช้ `"model": "veo-3-1"` เป็นคนละ string กัน ต้องทดสอบยิงจริง 1 ครั้ง (เสียเครดิตจริงเพราะ field ครบพอจะเริ่ม generate) ก่อนถือว่างานนี้เสร็จสมบูรณ์
