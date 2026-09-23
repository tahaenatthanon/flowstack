-- kie-video-adapter: ปิด Seedance 2.0 / 2.5 ชั่วคราว
-- ชื่อฟิลด์ภาพ features.video.image_field = 'first_frame_url' ของสองรุ่นนี้มาจาก docs ของ kie.ai
-- เท่านั้น ยังไม่ได้ยิงทดสอบจริง (ต้องใช้ ≥112 credit) — ปิดไว้ไม่ให้แอดมินเลือกจนกว่าจะทดสอบผ่าน
-- (งานย้ายไป Phase 3a) — sync models ไม่เปิดกลับเอง เพราะแถวที่มี features.video ถูกข้ามการตั้ง status
-- เปิดใช้ภายหลัง: UPDATE ai_models SET status='active' WHERE provider_id='provider-kieai'
--                 AND model_id IN ('bytedance/seedance-2','bytedance/seedance-2-5');
-- idempotent: รันซ้ำได้

UPDATE ai_models
SET status = 'inactive'
WHERE provider_id = 'provider-kieai'
  AND model_id IN ('bytedance/seedance-2', 'bytedance/seedance-2-5');
