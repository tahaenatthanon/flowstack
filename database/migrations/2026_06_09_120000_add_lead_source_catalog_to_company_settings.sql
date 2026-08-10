ALTER TABLE `company_settings`
  ADD COLUMN `lead_source_catalog` JSON NULL
    COMMENT 'Catalog of lead source options for sales opportunities'
  AFTER `calendar_event_type_catalog`;
