## 1. ยืนยัน contract จริงก่อนแก้โค้ด (ต้องขอ confirm จากผู้ใช้ก่อนทุกครั้งที่ยิงจริง — เสียเครดิต kie.ai จริง)

- [x] 1.1 ขอ confirm จากผู้ใช้ก่อนยิง test request จริงไปยัง kie.ai
- [x] 1.2 ทดสอบยิง `POST /api/v1/jobs/createTask` จริง 1 ครั้งด้วย `model="veo3"` + scene ตัวอย่างที่มี `image_url` จริง (สร้างผ่าน ngrok tunnel เพื่อให้ kie.ai ดึงภาพ local ได้) — ผลลัพธ์: `{"code":402,"msg":"Credits insufficient..."}` — **402 คือ billing error ที่เกิดหลัง field validation ผ่านแล้วเท่านั้น** ยืนยันว่า payload shape (`model`, `callBackUrl`, `input.prompt`, `input.image_urls`, `input.aspect_ratio`) ถูกต้องตามโครงสร้างจริง
- [x] 1.3 ไม่จำเป็น — `model: "veo3"` ผ่าน validation แล้ว (ได้ 402 ไม่ใช่ error เรื่อง model ไม่รู้จัก) ไม่ต้องลอง `"veo-3-1"`
- [x] 1.4 ไม่จำเป็น — `model_id="veo3"` ใน DB ถูกต้องอยู่แล้ว ไม่ต้องแก้
- [x] 1.5 ยืนยันแล้ว — `aspect_ratio: "9:16"` และไม่ใส่ `generation_type` ผ่าน validation (ได้ 402 ไม่ใช่ 400/422)
- [ ] 1.6 **ทำไม่ได้** — ไม่มี `taskId` จริงให้ทดสอบ poll เพราะ create ล้มเหลวด้วย credit ไม่พอ (ไม่ใช่ blocker ของโค้ด แต่เป็นข้อจำกัดเรื่องเครดิตบัญชี kie.ai) การ implement `video-status` จึงอิงตามเอกสารทางการเท่านั้น ยังไม่ได้ยืนยันด้วยการทดสอบจริง 100% — ควรทดสอบซ้ำเมื่อมีเครดิตเพียงพอ

## 2. แก้ `generate-video` action

- [x] 2.1 เปลี่ยน URL จาก `{baseUrl}/video/generations` เป็น `{baseUrl}/api/v1/jobs/createTask`
- [x] 2.2 เปลี่ยนการสร้าง `$sceneList`/`$payload` — ใช้แค่ `$scenes[0]` (scene แรก) แทนการวนทุก scene, สร้าง `input: {prompt, image_urls: [scene.image_url], aspect_ratio}` ตามผลที่ยืนยันจาก task 1.5
- [x] 2.3 ลบ branch "synchronous response (direct URL)" เดิม (บรรทัด 3551-3561) — kie.ai เป็น async เสมอ
- [x] 2.4 เปลี่ยนการอ่าน response เป็น `$dec['data']['taskId']` แทน `$dec['job_id'] ?? $dec['id']`
- [x] 2.5 คง logic เดิมที่บันทึก `video_job_id`/`video_gen_status='generating'` ลง DB และตอบ frontend เป็น `{status: 'generating', video_job_id}` — ไม่เปลี่ยน contract นี้

## 3. แก้ `video-status` action

- [x] 3.1 เปลี่ยน URL จาก `{baseUrl}/video/generations/{jobId}` เป็น `{baseUrl}/api/v1/jobs/recordInfo?taskId={jobId}`
- [x] 3.2 เปลี่ยนการอ่าน response เป็น `$dec['data']['state']` แทน `$dec['status']`
- [x] 3.3 เพิ่ม mapping: `state` เป็น `waiting`/`queuing`/`generating` → ตอบ `{status: 'generating', video_job_id}` เหมือนเดิม
- [x] 3.4 เพิ่ม mapping: `state === 'success'` → `json_decode($dec['data']['resultJson'])` แล้วอ่าน `resultUrls[0]` เป็น `video_url`, บันทึก `video_gen_status='done'`, ตอบ `{status: 'done', video_url}`
- [x] 3.5 เพิ่ม mapping: `state === 'fail'` → อ่าน `$dec['data']['failMsg']` เป็น error, บันทึก `video_gen_status='failed'`, ตอบ `{status: 'failed', error}`

## 4. ทดสอบ end-to-end จริง (ต้องขอ confirm ก่อนยิงจริงอีกครั้ง — เสียเครดิต)

- [x] 4.1 ขอ confirm จากผู้ใช้ก่อนทดสอบ end-to-end (ยิงซ้ำไม่เสี่ยงเครดิตเพิ่ม เพราะ 402 ถูก reject ก่อน generate เริ่ม)
- [x] 4.2 กด "สร้างวิดีโอ" จริงผ่าน UI กับ content item จริง (สร้าง content + สร้างภาพทุกฉากจริงผ่าน UI ระหว่างทำงานนี้) — **เจอ 2 บั๊กเพิ่มระหว่างทดสอบ ที่ design.md ไม่ได้คาดไว้ แก้แล้วทั้งคู่**:
  1. `$videoBaseUrl` จาก DB มี `/api/v1` ต่อท้ายอยู่แล้ว (`https://api.kie.ai/api/v1`) โค้ดเดิมต่อ `/api/v1/jobs/createTask` ซ้ำเข้าไปอีก กลายเป็น path ซ้อน `/api/v1/api/v1/jobs/createTask` (404) — แก้ด้วย `preg_replace('#/api/v1$#', '', $videoBaseUrl)` ก่อนต่อ path ทั้ง 2 action
  2. `scene['image_url']` ที่เก็บใน DB เป็น relative path ไม่ใช่ URL เต็ม — เพิ่มการแปลงเป็น absolute ด้วย `VITE_APP_URL` (ตาม pattern เดิมที่ใช้กับ product reference images ในไฟล์เดียวกัน)
  หลังแก้ทั้ง 2 จุด ได้ error กลับมาตรงกับที่ทดสอบตรงไว้ก่อนหน้า (`Credits insufficient`) ยืนยันว่ายิงถูก endpoint/payload แล้วจริง — **ไม่ได้ `video_job_id` กลับมาเพราะเครดิตบัญชี kie.ai ไม่พอ (ข้อจำกัดเรื่องเงิน ไม่ใช่บั๊กโค้ด)**
- [ ] 4.3 **ทำไม่ได้** — ต้องมี `taskId` จริงที่สร้างสำเร็จก่อนถึงจะ poll ได้ ติดเครดิตไม่พอเหมือนเดิม ต้องทดสอบซ้ำเมื่อมีเครดิตเพียงพอ
- [x] 4.4 ยืนยันแล้ว — error ที่ frontend ได้รับคือ `"Video API ไม่คืน taskId กลับ: Credits insufficient : Your current balance isn't enough to run this request. Please top up to continue."` เป็นข้อความอ่านได้ ไม่ใช่ raw JSON

## 5. ปิดงาน

- [x] 5.1 รัน `pnpm lint` (0 errors, warning ที่เหลือเป็นของเดิมไม่เกี่ยวกับงานนี้) และ `php -l api/brand-content.php` (no syntax errors)
- [x] 5.2 ตรวจสอบ `video-generation-provider-contract` spec — ผ่านทุก scenario ยกเว้น "งานเสร็จสำเร็จ" ที่ต้องมี `taskId` จริงสำเร็จก่อนถึงจะ poll ทดสอบได้ (ติดเครดิตบัญชี kie.ai ไม่พอ ไม่ใช่บั๊กโค้ด — ต้องทดสอบซ้ำเมื่อมีเครดิต)
