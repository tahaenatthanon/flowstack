## Context

Pipeline ปัจจุบัน (ยืนยันจากโค้ดจริงใน `api/brand-content.php`):

```
AI generate content (action: generate-article, $isVideo branch, line ~2577)
  └─ ตอบกลับ "visuals": ["Scene 1: ...", "Scene 2: ...", ...]  (string ล้วน)
        │
        │  fallback conversion (regex, 2 จุด: line ~1612 ใน generate-scene-images,
        │  line ~3458 ใน generate-video) — รันแค่ครั้งเดียวตอน scenes[] ยังว่างอยู่
        │  (guard: if (empty($scenes) && !empty($ac['visuals'])))
        ▼
scenes[] = [{ visual_prompt, shot }, ...]   ← ไม่มี image_gen_status/video_prompt เลย
        │
        │  action: generate-scene-images (line ~1710)
        ▼
scenes[i].image_url = "..."  (เขียนกลับเฉพาะตอนสำเร็จ, ไม่เขียนอะไรตอน failed)
content_items.image_gen_status = "done"  (ระดับ item เดียว, unconditional — บั๊ก toast หลอก)
```

`content_items.article_content` เป็น JSON column เดียว ทุกการเขียนเป็น read-modify-write ทั้งก้อน (อ่าน `$ac`, แก้บางส่วน, `json_encode` เขียนกลับทั้งหมด) — ไม่มีกลไก partial update ระดับ field อยู่แล้ว การเพิ่ม field ใหม่ใน scene object จึงไม่ต้องเปลี่ยนกลไกการเขียน แค่เพิ่ม key

ไม่มี API action ใดที่ให้ผู้ใช้แก้ field ของ scene เดี่ยวๆ ได้เลยในปัจจุบัน (ตรวจสอบแล้วไม่พบ `update-scene`/`scene_index` ในเส้นทางที่รับ input จากผู้ใช้)

## Goals / Non-Goals

**Goals:**
- เก็บ `video_prompt`, `image_gen_status`, `image_gen_error` ต่อ scene ใน `article_content.scenes[]`
- ให้ AI เขียน `video_prompt` คู่กับ `visual_prompt` ตั้งแต่ตอน generate content (ไม่มี AI call แยก, ไม่มีชั้น "brief" คั่นกลาง)
- ให้ผู้ใช้แก้ `video_prompt` และสั่ง retry สร้างภาพเฉพาะ scene ที่ต้องการได้ผ่าน UI ใหม่
- ไม่ทำลายข้อมูล content เก่าที่มีอยู่แล้ว (backward-compat ทั้งรูปแบบ `visuals[]` และสถานะ scene ที่ไม่มี key ใหม่)

**Non-Goals:**
- ไม่เปลี่ยน logic การเลือกโหมด (image-to-video/text-to-video) ของ `generate-video` — ยังคงพฤติกรรมเดิม (ใช้ scene แรกที่มี `image_url`, validate ทุก scene ต้องมีภาพ) ทั้งหมดนี้เป็นของ Phase ถัดไปที่จะมาใช้ข้อมูลที่ change นี้สร้างขึ้น
- ไม่รองรับหลาย scene ต่อ 1 วิดีโอ หรือการต่อคลิป (Phase หลัง)
- ไม่ migrate ข้อมูลเก่าใน DB จริง — ใช้ derive rule ตอนอ่านแทน

## Decisions

### 1. `visuals[]` schema เปลี่ยนจาก `string[]` เป็น `[{visual, motion}]` — เฉพาะ branch วิดีโอ
**ทำไม**: ต้องการให้ AI เขียน motion prompt คู่กับ visual prompt ในการยิงครั้งเดียว ไม่เพิ่ม AI call ใหม่ (ลด cost/latency) ทางเลือกอื่นที่พิจารณาแล้วไม่เลือก:
- แยก AI call ที่สองเพื่อ generate video_prompt จาก visual_prompt ที่มีอยู่ — เพิ่ม latency/cost โดยไม่จำเป็น เพราะ AI เขียนสองอย่างพร้อมกันได้อยู่แล้วในรอบเดียว
- เก็บ video_prompt เป็น item-level เดียว (เหมือน `image_brief`) — ถูกปัดตกในการคุยออกแบบ เพราะแต่ละ scene เคลื่อนไหวไม่เหมือนกัน ต้องเป็น per-scene

**สำคัญ**: แก้เฉพาะ schema ใน `$isVideo` branch (line ~2577) เท่านั้น ไม่แตะ `visuals` ของ branch article/social (line ~2601) ซึ่งความหมายคือ "ภาพประกอบ" ทั่วไป ไม่ใช่ scene วิดีโอ

### 2. Backward-compat ด้วย derive rule ตอนอ่าน ไม่ใช่ migration เขียนทับ
**ทำไม**: content เก่าที่มี `scene.image_url` แต่ไม่มี key `image_gen_status` เลย (ทุก record ก่อน deploy change นี้) ต้องไม่ถูกตีความผิดเป็น `"none"` มิฉะนั้นจะเสียสถานะทันทีที่ deploy กฎ:
```
ไม่มี key image_gen_status:
  มี image_url (non-empty)  → derive เป็น "done"
  ไม่มี image_url             → derive เป็น "none"
```
ใช้ derive ณ จุดอ่าน (ทั้ง backend เวลาคืน response และ frontend เวลา render) แทนการรัน migration script เขียนทับ `article_content` ของทุก record — ปลอดภัยกว่า ย้อนกลับได้ ไม่เสี่ยง corrupt JSON ของ record จำนวนมาก

### 3. Fallback conversion (2 จุดในโค้ด) ต้อง parse ได้ทั้ง 2 รูปแบบ
`visuals[i]` อาจเป็น string (content เก่า) หรือ object `{visual, motion}` (content ใหม่) — logic แยกตาม `is_string($v)` ที่มีอยู่แล้วบางส่วน ขยายให้ครอบคลุม object shape ใหม่ scene ที่สร้างจาก fallback (ทั้ง 2 จุด) SHALL ตั้ง `image_gen_status: "none"` เสมอโดยไม่มีเงื่อนไข (scene ที่เพิ่งถูกสร้างยังไม่เคยพยายามสร้างภาพ)

### 4. API ใหม่: `update-scene` และ retry รายฉาก แยกจาก `generate-scene-images` (bulk)
**ทำไม**: ผู้ใช้ต้องแก้ `video_prompt` ทีละ scene และ retry เฉพาะ scene ที่ failed โดยไม่ยิง AI ซ้ำทุก scene (ประหยัด credit, ตรงจุด) ทางเลือกที่ไม่เลือก: ขยาย `generate-scene-images` ให้รับ `scene_index` เดียวได้ — ถูกปัดตกเพราะจะทำให้ endpoint เดิมมีสอง mode (bulk/single) ปนกัน อ่านยาก แยก action ชัดเจนกว่า

### 5. Save แบบ explicit (ปุ่ม "บันทึก") ไม่ auto-save
**ทำไม**: ลดความซับซ้อนของ debounce/race-condition กับการเขียน JSON ทั้งก้อน และลดจำนวน API call ที่ไม่จำเป็นทุกครั้งที่พิมพ์

## Risks / Trade-offs

- **[Risk] Content เก่าที่ derive เป็น "done" อาจมี `image_url` ที่เป็น broken link จริงๆ (ลบไฟล์ทิ้งไปแล้ว) แต่ derive rule เห็นแค่ว่า field ไม่ว่างก็ถือว่า done** → ยอมรับความเสี่ยงนี้ใน Phase นี้ เพราะไม่มีทางตรวจสอบว่าไฟล์ยังอยู่จริงโดยไม่ยิง request เพิ่มทุกครั้งที่ render (คนละเรื่องกับ scope นี้ — Phase ถัดไปที่ใช้สถานะนี้จริงจะเจอ error ตอนยิง Veo ถ้าไฟล์หาย ซึ่งเป็นพฤติกรรมที่ยอมรับได้)
- **[Risk] เปลี่ยน `visuals` schema อาจกระทบ prompt ที่ AI เข้าใจผิดรูปแบบ (เขียนกลับมาเป็น string เหมือนเดิมทั้งที่ขอ object)** → mitigate ด้วยการ parse แบบ defensive (รองรับทั้ง 2 แบบเหมือนเดิมอยู่แล้วตาม decision #3) ไม่ทำให้ระบบพังแม้ AI ตอบผิดรูปแบบ
- **[Trade-off] ไม่ auto-save** → ผู้ใช้อาจพิมพ์แล้วลืมกดบันทึก เสียงานที่แก้ไป — ยอมรับได้เพราะลดความซับซ้อนของ Phase นี้ตามที่ตัดสินใจไว้ (decision #5)

## Migration Plan

ไม่มี DB schema migration (schema เดิมเป็น JSON column อยู่แล้ว, ไม่มีการเพิ่มคอลัมน์ใหม่) Deploy เป็นการอัปเดตโค้ด backend+frontend พร้อมกัน:
1. Deploy backend (`api/brand-content.php`) ก่อน — endpoint ใหม่/แก้ไข ยัง backward-compatible กับ frontend เดิม (ไม่ breaking response shape ที่มีอยู่)
2. Deploy frontend — UI ใหม่เริ่มใช้ field ใหม่ทันที
3. Rollback: revert โค้ดทั้งสองฝั่งได้อิสระ เพราะไม่มีการเขียนทับข้อมูลเดิม (derive rule ทำงานได้แม้ revert กลับไปโค้ดเก่าที่ไม่รู้จัก field ใหม่ — แค่ field ส่วนเกินจะถูกเก็บเฉยๆ ใน JSON โดยโค้ดเก่าไม่สนใจ)

## Open Questions

ไม่มี — คำถามที่เปิดค้างทั้งหมดถูกปิดในขั้นตอน explore ก่อนหน้า change นี้
