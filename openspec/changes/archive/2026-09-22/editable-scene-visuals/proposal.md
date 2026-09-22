## Why

ตอนนี้ผู้ใช้แก้ไขคำบรรยายภาพของฉากวิดีโอไม่ได้เลยหลังจาก AI generate สคริปต์ — ทั้ง "ลำดับฉาก" (รายการ visuals ก่อนสร้างภาพ) เป็น read-only ล้วนๆ และหลังสร้างภาพแล้วก็ไม่มีช่องแก้ `visual_prompt` ใน scene การ์ดเช่นกัน (มีแค่ `video_prompt`) ถ้า AI เขียนคำบรรยายภาพไม่ถูกใจ ทางเดียวที่แก้ได้คือสร้างสคริปต์ใหม่ทั้งหมด นอกจากนี้ปุ่ม "AI เขียน Video Prompt" ก็หายไปทันทีที่มีข้อความในช่อง ทำให้เขียนทับไม่ได้ถ้าอยากลองใหม่ และปุ่ม "สร้างภาพทุกฉาก" กับ SceneCards เรียงลำดับกลับด้านกันระหว่างสองหน้าที่ใช้ component เดียวกัน

## What Changes

- "ลำดับฉาก" ใน `ContentCardDialog` เปลี่ยนจาก list อ่านอย่างเดียวเป็น textarea แก้ไขได้ทีละบรรทัด (เฉพาะข้อความ `visual` ไม่แตะ `motion`, ไม่เพิ่ม/ลบจำนวนฉาก) และย้ายไปอยู่เหนือปุ่ม "สร้างภาพทุกฉาก" ทันที — แสดงเฉพาะตอนที่ content ยังไม่มี `scenes[]` เกิดขึ้น (เพราะ backend ไม่อ่าน `visuals[]` อีกต่อไปหลังมี `scenes[]`)
- เมื่อมี `scenes[]` แล้ว เพิ่มช่องแก้ไข "คำบรรยายภาพ" (`visual_prompt`) เข้าไปใน scene การ์ดแต่ละใบ คู่กับช่อง `video_prompt` เดิม
- เพิ่มปุ่ม "สร้างภาพฉากนี้ใหม่" ที่โผล่ขึ้นเฉพาะหลังบันทึก `visual_prompt` ที่แก้ไขแล้วสำเร็จ — กดต้องผ่าน dialog ยืนยันก่อนจึงจะยิงสร้างภาพจริง (ป้องกันใช้เครดิต AI โดยไม่ตั้งใจ)
- ปุ่ม "AI เขียน Video Prompt" เปลี่ยนจากซ่อนเมื่อมีข้อความ เป็นแสดงตลอดเวลา เขียนทับได้ทุกเมื่อ
- ปุ่ม "บันทึก" หลักของ `ContentCardDialog` กลายเป็นจุดบันทึกเดียวสำหรับทุกฟิลด์ที่แก้ไขได้ (ทั้ง content ประเภท article และ video) — disabled เมื่อยังไม่มีการแก้ไขใดๆ, enabled เมื่อมีการแก้ไข — และเมื่อมีการแก้ไข scene (`visual_prompt`) แล้วกดบันทึก dialog จะไม่ปิดตัว (ต่างจากฟิลด์อื่นที่ยังปิดตามปกติ) เพื่อให้เห็นปุ่ม "สร้างภาพฉากนี้ใหม่" ได้ทันทีในหน้าเดียวกัน
- สลับลำดับใน `ContentCardDialog` ให้ SceneCards อยู่เหนือปุ่ม "สร้างภาพทุกฉาก" ให้ตรงกับ `ContentVideoView` ที่เรียงถูกอยู่แล้ว
- ขยาย API action `update-scene` ให้รับ `visual_prompt` ได้ด้วย (ปัจจุบันรับแค่ `video_prompt`)
- `ContentVideoView` (หน้าอนุมัติ) ไม่เปลี่ยนแปลง — ยังคง readOnly ทั้งหมดเหมือนเดิม

## Capabilities

### New Capabilities
- `content-dialog-unified-save`: การบันทึกแบบรวมศูนย์ของ `ContentCardDialog` — dirty-tracking ทั้งฟอร์ม, ปุ่ม "บันทึก" disabled เมื่อไม่มีการแก้ไข, และ dialog ไม่ปิดตัวเมื่อบันทึกหลังแก้ไข scene

### Modified Capabilities
- `video-scene-motion-prompt`: ขยาย `update-scene` ให้รับ `visual_prompt`, เพิ่ม requirement สำหรับปุ่ม "สร้างภาพฉากนี้ใหม่" ที่ต้องยืนยันก่อนยิง
- `scene-generation-from-visuals`: "ลำดับฉาก" กลายเป็นแก้ไขได้และแสดงแบบมีเงื่อนไข (เฉพาะก่อนมี scenes), สลับลำดับ SceneCards กับปุ่ม "สร้างภาพทุกฉาก" ใน `ContentCardDialog`
- `video-prompt-backfill`: ปุ่ม "AI เขียน Video Prompt" เปลี่ยนจากแสดงเฉพาะตอนว่าง เป็นแสดงตลอดเวลา

## Impact

- Frontend: `src/components/content/ContentCardDialog.tsx`, `src/components/content/SceneCards.tsx`
- Backend: `api/brand-content.php` (action `update-scene`)
- ไม่กระทบ `src/components/content/views/ContentVideoView.tsx` (readOnly mode ไม่เปลี่ยน)
