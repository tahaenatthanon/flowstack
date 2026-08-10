-- Remove meeting and leave from calendar_event_type_catalog (now handled via tasks)
UPDATE company_settings
SET calendar_event_type_catalog = '[{"key":"holiday","label":"วันหยุดบริษัท","color":"#ef4444","active":1,"system":1},{"key":"other","label":"อื่นๆ","color":"#8b5cf6","active":1,"system":1}]'
WHERE id = 1;
