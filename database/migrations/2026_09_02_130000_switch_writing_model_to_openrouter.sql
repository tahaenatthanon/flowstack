-- Data update (NOT a schema change) — AI Research Content Workflow precondition
--
-- ย้าย Writing AI (ai_content_text_model_id) จาก provider-kilo → provider-openrouter
-- เพื่อปลดล็อก analyze + generate-article ที่เดิมติด "Add credits" (kilo หมดเครดิต)
--
-- ผลลัพธ์: analyze และ generate ใช้ resolveAICreds('ai_content_text_model_id')
--           ซึ่งจะแก้ base_url + api_key ไปยัง provider-openrouter โดยอัตโนมัติ
--
-- หมายเหตุ: research/fetch ใช้ perplexity/sonar บน OpenRouter อยู่แล้ว (hardcode)
--           จึงทำให้ทั้ง 3 ขั้น (research/analyze/writing) อยู่ OpenRouter ครบ

UPDATE `company_settings`
SET `ai_content_text_model_id` = '1542fca5-84a1-4be9-989f-4381f272da38'  -- openai/gpt-4o-mini (provider-openrouter)
WHERE `tenant_id` = 'tenant-default';
