-- เพิ่ม metric ระดับโพสต์ (change: facebook-page-insights-dashboard)
--
-- NULL = ปลายทางไม่รายงานค่านี้ (ต่างจาก 0 = รายงานว่าเป็นศูนย์) — เหตุผลเดียวกับที่ UI แยก "—" กับ 0
--   clicks             ← post_clicks                       (โพสต์ชนิด post)
--   reactions_json     ← post_reactions_by_type_total      (object แยกชนิด ของโพสต์ชนิด post)
--   video_avg_watch_ms ← post_video_avg_time_watched       (video_insights ของโพสต์ชนิด video, หน่วย ms)

ALTER TABLE content_post_metrics
  ADD COLUMN IF NOT EXISTS clicks             INT      NULL AFTER likes,
  ADD COLUMN IF NOT EXISTS reactions_json     LONGTEXT NULL AFTER clicks,
  ADD COLUMN IF NOT EXISTS video_avg_watch_ms INT      NULL AFTER reactions_json;
