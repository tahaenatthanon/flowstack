## Context

`generate-video` ปัจจุบัน (ยืนยันจากโค้ดจริง, [api/brand-content.php:3614](api/brand-content.php:3614)):

```php
// Validation เดิม: บังคับทุก scene ต้องมี image_url
foreach ($scenes as $idx => $scene) {
    if (empty($scene['image_url'])) $missingSceneIndexes[] = $idx + 1;
}
if ($missingSceneIndexes) jsonError('...ยังไม่มี Image กรุณากด "สร้างภาพทุกฉาก"...');

// Payload: ใช้ visual_prompt (ผิด — ควรเป็น video_prompt)
$payload = [
    'model' => $videoModelName, 'callBackUrl' => null,
    'input' => [
        'prompt' => $firstScene['visual_prompt'] ?? '',
        'image_urls' => [$sceneImageUrl],
        'aspect_ratio' => '9:16',   // fix ตายตัว
    ],
];
```

`grep video_prompt` ทั้งไฟล์พบว่ามีแค่ 2 จุดที่ "เขียน" ค่านี้ (fallback conversion, `update-scene`) — ไม่มีจุดไหน "อ่าน" ไปใช้งานจริงเลย นี่คือ gap หลักที่ change นี้ต้องปิด

Frontend มี validation ซ้อนอีกชั้นที่ระดับปุ่ม (ไม่ใช่แค่ backend):
```
ContentVideoView.tsx:348   disabled={... || !allScenesHaveImages}
ContentCardDialog.tsx:943  disabled={... || !allScenesHaveImages}
allScenesHaveImages = scenes.every(s => !!s.image_url)
```
ถ้าแก้แค่ backend โดยไม่แก้ตรงนี้ ผู้ใช้จะกดปุ่ม "สร้างวิดีโอ" ไม่ได้อยู่ดีเมื่อยังไม่มีภาพครบทุก scene

kie.ai/Veo contract (ยืนยันจาก docs และ curl test จริงในช่วง Phase 1): `generation_type` enum (`TEXT_2_VIDEO` / `FIRST_AND_LAST_FRAMES_2_VIDEO` / `REFERENCE_2_VIDEO`, auto-detect จาก `image_urls` ถ้าไม่ส่ง), `aspect_ratio` (`16:9`/`9:16`/`Auto`, default `16:9`)

## Goals / Non-Goals

**Goals:**
- `video_prompt` ที่ผู้ใช้แก้ไขได้ (จาก Phase ก่อนหน้า) มีผลจริงต่อวิดีโอที่สร้าง
- เลือกโหมด image-to-video/text-to-video อัตโนมัติตามสถานะภาพจริงของ scene แรก ไม่ใช่ default ตายตัว
- ไม่บังคับสร้างภาพทุก scene ก่อนอีกต่อไป (ทั้ง backend และ UI)
- เลือกสัดส่วนวิดีโอได้ต่อการสร้างแต่ละครั้ง
- มีทางกู้คืนเมื่อ `video_prompt` ว่าง (ปุ่ม AI เขียนย้อนหลัง) แทนที่จะ error ตายตัวให้ผู้ใช้ไปพิมพ์เอง

**Non-Goals:**
- ไม่รองรับหลาย scene ต่อ 1 วิดีโอ (ยังใช้แค่ scene แรกเหมือน Phase 1)
- ไม่เก็บวิดีโอหลายสัดส่วนพร้อมกัน — `content_items.video_url`/`video_gen_status`/`video_job_id` ยังเป็นคอลัมน์เดี่ยว การสร้างใหม่เขียนทับของเดิมเสมอ
- ไม่มี vision call ดูภาพจริงตอนเขียน Video Prompt ย้อนหลัง — ใช้แค่ `visual_prompt` (ข้อความ) เป็น input

## Decisions

### 1. Mode detection ใช้ `image_gen_status` ของ scene แรก ไม่ใช่แค่เช็ค `image_url` ว่าง/ไม่ว่าง
**ทำไม**: `image_url` ว่างเปล่าสื่อความหมายได้ 2 อย่างปนกัน — "ยังไม่เคยลอง" กับ "ลองแล้วพัง" ถ้าใช้แค่ presence check จะไม่แยกสองกรณีนี้ออกจากกัน ทำให้ scene ที่ generate ภาพล้มเหลวถูกปฏิบัติเหมือนกับ scene ที่ตั้งใจข้ามภาพไปเลย (text-to-video) ซึ่งผิดเจตนา — ใช้ `image_gen_status` (มีอยู่แล้วจาก Phase ก่อนหน้า พร้อม backward-compat derive rule) แยก 3 สถานะได้ชัดเจน

### 2. `failed` ไม่ fallback ไป text-to-video อัตโนมัติ
**ทำไม**: ถ้า scene ตั้งใจจะมีภาพ (ผู้ใช้เขียน visual_prompt ไว้ กดสร้างภาพ) แต่ล้มเหลว การไปสร้าง text-to-video แทนแบบเงียบๆ จะได้ผลลัพธ์ที่ผู้ใช้ไม่คาดคิด (สั่งไว้อย่างได้อีกอย่าง) ดีกว่าให้ error ชัดเจนพร้อมเหตุผล (`image_gen_error` ที่มีอยู่แล้ว) ให้ผู้ใช้ตัดสินใจเอง (retry ภาพ หรือยอมรับ text-to-video เอง)

### 3. Aspect ratio: selector ต่อการสร้าง ไม่ใช่ต่อ scene หรือต่อ content item
**ทำไม**: สัดส่วนเป็นคุณสมบัติของ "วิดีโอที่จะได้" ไม่ใช่ของ scene หรือ content item ถาวร — ผู้ใช้อาจอยากได้สัดส่วนต่างกันในการสร้างแต่ละครั้ง (ลองใหม่, เปลี่ยนใจ) ไม่ต้องมี state ถาวรเก็บไว้ ส่งเป็น parameter ของ request `generate-video` แต่ละครั้งพอ — ไม่ persist ลง DB (ไม่มีคอลัมน์ใหม่)

### 4. ปุ่ม "AI เขียน Video Prompt" อยู่ทุก scene card ไม่ใช่แค่ scene แรก
**ทำไม**: `SceneCards.tsx` เป็น component กลาง render scene ทุกตัวแบบเดียวกันอยู่แล้ว (มีช่อง video_prompt + ปุ่มบันทึกในทุก card) การ special-case ให้ปุ่มนี้โผล่เฉพาะ scene[0] ต้องเพิ่มเงื่อนไขแยกในโค้ดที่ render ทุก scene เหมือนกันอยู่แล้ว ซับซ้อนกว่าและดูไม่สมเหตุผลในสายตาผู้ใช้ (ทำไม scene อื่นไม่มีปุ่มนี้) — ให้เงื่อนไขเดียวกันทุก scene (`video_prompt` ว่าง → โชว์ปุ่ม) ง่ายกว่าและเตรียมพร้อมสำหรับ Phase 3 (หลาย scene) ไปในตัวโดยไม่ต้องแก้ซ้ำ

### 5. Error ของ "AI เขียน Video Prompt" ไม่ persist ลง DB — toast อย่างเดียว
**ทำไม**: ต่างจาก image generation (ช้า, อาจ rate-limit, ผู้ใช้อาจปิดหน้าแล้วกลับมาดูทีหลัง) การเขียน video_prompt เป็น text completion สั้นๆ จบในการโต้ตอบเดียว ถ้าพังผู้ใช้เห็น toast แล้วกดใหม่ได้ทันที ไม่มีเหตุผลต้องเพิ่มคอลัมน์ error ใหม่ (ลด schema footprint)

### 6. "AI เขียน Video Prompt" ใช้ text model ไม่ใช่ image model, input เป็น `visual_prompt` (ไม่ใช่ภาพจริง)
**ทำไม**: งานนี้คือ text-to-text (บรรยายภาพ → คำสั่งเคลื่อนไหว) ไม่ใช่ vision task — ใช้ `ai_content_text_model_id` (โมเดลเดียวกับที่ generate บทความ/สคริปต์) ถูกกว่าและเร็วกว่าการยิง vision call ไปดูภาพจริงที่ generate ไว้แล้ว ซึ่ง `visual_prompt` ที่มีอยู่ก็บรรยายภาพละเอียดพอสำหรับงานนี้อยู่แล้ว

## Risks / Trade-offs

- **[Risk] ผู้ใช้กดสร้างวิดีโอตอน scene[0] เป็น "none" (text-to-video) ทั้งที่จริงตั้งใจจะรอสร้างภาพก่อน** → ยอมรับความเสี่ยงนี้ เพราะการเลือกอัตโนมัติตามสถานะจริงคือ behavior ที่ตกลงกันไว้ (ผู้ใช้ต้องเข้าใจว่า "ไม่มีภาพ = text-to-video" เป็นเจตนาของระบบ ไม่ใช่บั๊ก) — UI ควรมี label/tooltip บอกโหมดที่จะใช้ก่อนกดยืนยัน (รายละเอียด UI ให้ทีม implement ตัดสินใจตอน apply)
- **[Trade-off] Aspect ratio ไม่ persist** → ถ้าผู้ใช้ต้องการดูว่าวิดีโอปัจจุบันสร้างด้วยสัดส่วนไหน ต้องดูจากไฟล์วิดีโอเอง (เล่นแล้วดู) ไม่มีบันทึกไว้ใน DB — ยอมรับได้เพราะไม่ใช่ข้อมูลที่ critical ต้อง query/filter ทีหลัง
- **[Risk] `generate-scene-video-prompt` เป็น AI call ใหม่ที่มีต้นทุนจริง** → ผู้ใช้กดปุ่มนี้ซ้ำๆ โดยไม่ตั้งใจอาจเสีย credit เกินจำเป็น — mitigate ด้วย loading state ปิดปุ่มระหว่างเรียก (pattern เดียวกับปุ่ม retry ภาพที่มีอยู่แล้ว)

## Migration Plan

ไม่มี DB migration (ใช้ field ที่มีอยู่แล้วทั้งหมด) Deploy เป็นการอัปเดตโค้ด backend+frontend พร้อมกัน — ถ้า revert กลับ โค้ดเก่าจะกลับไปใช้ `visual_prompt`/บังคับทุก scene มีภาพเหมือนเดิม ไม่มีข้อมูลเสียหาย

## Open Questions

ไม่มี — ปิดครบทุกจุดในขั้นตอน explore ก่อนหน้า change นี้
