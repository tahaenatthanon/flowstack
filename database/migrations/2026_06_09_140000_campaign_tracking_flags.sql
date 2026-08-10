-- Add per-campaign tracking toggles: open-tracking pixel and click-tracking link wrapping
ALTER TABLE email_campaigns
  ADD COLUMN enable_track_opens  TINYINT(1) NOT NULL DEFAULT 1 AFTER total_clicks,
  ADD COLUMN enable_track_clicks TINYINT(1) NOT NULL DEFAULT 1 AFTER enable_track_opens;
