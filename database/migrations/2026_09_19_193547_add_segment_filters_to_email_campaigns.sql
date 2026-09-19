ALTER TABLE email_campaigns
  ADD COLUMN segment_filters JSON DEFAULT NULL COMMENT 'เงื่อนไข segment แบบไดนามิก เช่น {"business_type":"IT","engagement":"has_opened_or_clicked_any"}' AFTER enable_track_clicks;
