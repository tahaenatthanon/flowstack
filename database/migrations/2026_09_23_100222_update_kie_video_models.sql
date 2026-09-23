-- อัปเดต model วิดีโอของ kie.ai (provider-kieai) ให้เหลือเฉพาะรุ่นที่รองรับทั้ง 720p และ 1080p
--   เพิ่ม:        veo3_lite, bytedance/seedance-1.5-pro, bytedance/seedance-2, bytedance/seedance-2-5
--   เปลี่ยนชื่อ:  veo3 -> Veo 3.1 Quality, veo3_fast -> Veo 3.1 Fast
--   ปิดใช้งาน:   bytedance/seedance-2-fast (ไม่รองรับ 1080p)
--
-- features.video อธิบาย capability ต่อรุ่น:
--   api         veo    = POST /api/v1/veo/generate    + GET /api/v1/veo/record-info
--               market = POST /api/v1/jobs/createTask + GET /api/v1/jobs/recordInfo
--   durations   ความยาวคลิปที่รองรับ (วินาที)
--   price_unit  per_clip (kie คิดเท่ากันทุกความยาว — ทดสอบแล้ว 4 วิ = 30 credit เท่าคลิป 8 วิ) | per_second
--   price_usd   ราคาแบบมีเสียง ไม่ส่งวิดีโอ input (อ้างอิงหน้า kie.ai/pricing ณ 2026-09-23)
-- idempotent: รันซ้ำได้

-- ── Veo 3.1 ──────────────────────────────────────────────────────────────────
UPDATE ai_models
SET name = 'Veo 3.1 Quality',
    features = '{"video":{"api":"veo","durations":[4,6,8],"resolutions":["720p","1080p"],"price_unit":"per_clip","price_usd":{"720p":1.25,"1080p":1.275}}}'
WHERE provider_id = 'provider-kieai' AND model_id = 'veo3';

UPDATE ai_models
SET name = 'Veo 3.1 Fast',
    features = '{"video":{"api":"veo","durations":[4,6,8],"resolutions":["720p","1080p"],"price_unit":"per_clip","price_usd":{"720p":0.30,"1080p":0.325}}}'
WHERE provider_id = 'provider-kieai' AND model_id = 'veo3_fast';

INSERT INTO ai_models (id, provider_id, model_id, name, description, status, features)
SELECT UUID(), 'provider-kieai', 'veo3_lite', 'Veo 3.1 Lite', 'Google Veo 3.1 Lite — ถูกที่สุดในตระกูล Veo',
       'active', '{"video":{"api":"veo","durations":[4,6,8],"resolutions":["720p","1080p"],"price_unit":"per_clip","price_usd":{"720p":0.15,"1080p":0.175}}}'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ai_models WHERE provider_id = 'provider-kieai' AND model_id = 'veo3_lite');

-- ── Seedance ────────────────────────────────────────────────────────────────
INSERT INTO ai_models (id, provider_id, model_id, name, description, status, features)
SELECT UUID(), 'provider-kieai', 'bytedance/seedance-1.5-pro', 'Seedance 1.5 Pro', 'ByteDance Seedance 1.5 Pro',
       'active', '{"video":{"api":"market","durations":{"min":4,"max":12},"resolutions":["720p","1080p"],"price_unit":"per_second","price_usd":{"720p":0.035,"1080p":0.075}}}'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ai_models WHERE provider_id = 'provider-kieai' AND model_id = 'bytedance/seedance-1.5-pro');

INSERT INTO ai_models (id, provider_id, model_id, name, description, status, features)
SELECT UUID(), 'provider-kieai', 'bytedance/seedance-2', 'Seedance 2.0', 'ByteDance Seedance 2.0',
       'active', '{"video":{"api":"market","durations":{"min":4,"max":15},"resolutions":["720p","1080p"],"price_unit":"per_second","price_usd":{"720p":0.205,"1080p":0.51}}}'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ai_models WHERE provider_id = 'provider-kieai' AND model_id = 'bytedance/seedance-2');

INSERT INTO ai_models (id, provider_id, model_id, name, description, status, features)
SELECT UUID(), 'provider-kieai', 'bytedance/seedance-2-5', 'Seedance 2.5', 'ByteDance Seedance 2.5 — คลิปยาวสุด 30 วินาที',
       'active', '{"video":{"api":"market","durations":{"min":4,"max":30},"resolutions":["720p","1080p"],"price_unit":"per_second","price_usd":{"720p":0.315,"1080p":0.79}}}'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ai_models WHERE provider_id = 'provider-kieai' AND model_id = 'bytedance/seedance-2-5');

UPDATE ai_models
SET status = 'inactive'
WHERE provider_id = 'provider-kieai' AND model_id = 'bytedance/seedance-2-fast';
