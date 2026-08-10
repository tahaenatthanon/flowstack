-- Copy AI settings from KTN (tenant-default) to winaisri superadmin tenant
-- Root cause: winaisri@gmail.com is a superadmin in their own tenant (6b3769a0-...)
-- which had no AI config, causing all AI features to fail with "ยังไม่ตั้งค่า AI"

UPDATE company_settings
SET
  ai_active_provider_id     = 'provider-kilo',
  ai_default_model_id       = (SELECT ai_default_model_id FROM (SELECT ai_default_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_chat_model_id          = (SELECT ai_chat_model_id FROM (SELECT ai_chat_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_content_text_model_id  = (SELECT ai_content_text_model_id FROM (SELECT ai_content_text_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_content_image_model_id = (SELECT ai_content_image_model_id FROM (SELECT ai_content_image_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_content_video_model_id = (SELECT ai_content_video_model_id FROM (SELECT ai_content_video_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_cardscan_model_id      = (SELECT ai_cardscan_model_id FROM (SELECT ai_cardscan_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_analyst_model_id       = (SELECT ai_analyst_model_id FROM (SELECT ai_analyst_model_id FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_content_timeout        = (SELECT ai_content_timeout FROM (SELECT ai_content_timeout FROM company_settings WHERE tenant_id = 'tenant-default') t),
  ai_content_max_tokens     = (SELECT ai_content_max_tokens FROM (SELECT ai_content_max_tokens FROM company_settings WHERE tenant_id = 'tenant-default') t)
WHERE tenant_id = '6b3769a0-bf66-44f1-a8ab-692774c3a2e6';
