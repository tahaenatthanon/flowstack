## Context

ระบบเผยแพร่คอนเทนต์ผ่าน `dispatch_content()` ลง 9 platform และบันทึก `external_post_id`/`published_url` ไว้แล้ว (เฟส 0) แต่ยังไม่เคยดึง engagement กลับ — `content_items.views`/`likes` เป็น 0 ทั้งหมด ไม่มีตาราง time-series และ `AnalyticsSocialTab` เป็นโครงเปล่าแสดง "—"

`dispatch_facebook()` (`api/lib/publish-dispatch.php`) เก็บ creds เป็น JSON `{ "page_id", "access_token" }` อยู่แล้ว — Page token ตัวนี้ใช้เรียก `https://graph.facebook.com/v19.0/{page_id}/feed` และสามารถเรียก `/{post_id}/insights` ได้โดยตรง เพียงเพิ่ม scope `read_insights` ไม่ต้องสร้าง OAuth flow ใหม่ Instagram มี creds `{ ig_user_id, access_token }` อยู่แล้วเช่นกัน

Cron infrastructure มีพร้อมแล้ว: `cron_jobs` (key/type/file_path/enabled), `cron_runs` (job_name/started_at/finished_at/records_processed/errors/notes), และ `cron-manager.php` รองรับ `type='include'` ที่ include ไฟล์ใน `api/cron/` พร้อมตั้ง `CRON_MODE` + `$GLOBALS['cron_run_id']`

## Goals / Non-Goals

**Goals:**
- ดึง engagement (views/likes) จาก Facebook และ Instagram โดยใช้ `content_publish_queue.platform_post_id` ของแถวที่ `status='sent'` เป็นคีย์ join (ต่อช่องทาง)
- เก็บเป็น time-series (ตาราง `content_post_metrics`) เพื่อดูแนวโน้ม ไม่ใช่ค่าเดียวทับไปทับมา
- เขียนค่าล่าสุดกลับลง `content_items.views`/`likes` เพื่อให้การ์ด/ranking เดิมทำงานได้ทันที
- แก้บั๊ก `analytics-recalculate` ให้จัดกลุ่มด้วย `published_at` และบอกจำนวนที่ขาด
- เสียบข้อมูลจริงลง `AnalyticsSocialTab` พร้อมระบุขอบเขตแพลตฟอร์ม

**Non-Goals:**
- ไม่ซิงก์ tiktok/lineoa/linkedin/twitter/wix/custom/lotusdomino (ไม่มี API/creds ในเฟสนี้)
- ไม่ทำ followers/reach/impressions (ยังไม่มีตารางเก็บ) — engagement เท่านั้น
- ไม่จัดการ token หมดอายุ/refresh (task แยก ไม่มีเจ้าภาพในเฟสนี้)
- ฝั่ง WordPress ใช้ GSC clicks ต้องพึ่งเฟส 1 — ถ้าเฟส 1 ยังไม่เสร็จ ทำเฉพาะ FB/IG ไปก่อน

## Decisions

**1. ตาราง `content_post_metrics` เป็น time-series แยกจาก `content_items`**
- *เหตุผล:* ต้องการแนวโน้มการเติบโต ไม่ใช่ snap-shot ทับกัน `content_items.views/likes` เก็บค่าล่าสุดเพื่อให้ ranking/การ์ดเดิมทำงาน ส่วน history อยู่ใน time-series
- *ทางเลือกที่พิจารณา:* เก็บเฉพาะค่าล่าสุดใน `content_items` — ปฏิเสธ เพราะตาม roadmap ต้องดูแนวโน้มได้ และไม่มีวิธีดูว่าโพสต์โตแค่ไหน

**2. แยก platform ด้วย `match()` ตามแบบ `dispatch_content()`**
- *เหตุผล:* สอดคล้องกับ pattern เดิม อ่านง่าย และเตรียมขยาย platform ได้ในเฟสถัดไป
- *ทางเลือกที่พิจารณา:* if/elseif chain — ปฏิเสธเพราะ `dispatch_content()` ใช้ `match()` อยู่แล้ว

**3. ใช้ `content_publish_queue.platform_post_id` ต่อช่องทางเป็นคีย์ join ไม่ใช่ `content_items.external_post_id`**
- *เหตุผล:* `content_items` มี `platform` กับ `external_post_id` อย่างละช่องเดียว และ **ไม่มี `channel_id`** — คอนเทนต์ที่เผยแพร่หลายช่องทางจะเหลือ id ของช่องทางสุดท้ายเท่านั้น (`publish-scheduler.php` เขียนทับทุกรอบ) ส่วน `content_publish_queue` เก็บ `channel_id` + `platform_post_id` แยกต่อแถว จึงเป็นแหล่งเดียวที่เติมคอลัมน์ `channel_id` ของ `content_post_metrics` ได้ถูกต้อง และได้ creds ของ channel ที่ใช้โพสต์จริงมาด้วยการ join
- *ทางเลือกที่พิจารณา:* ใช้ `content_items.external_post_id` (ข้อเสนอเดิมของ proposal) — ปฏิเสธ เพราะซิงก์ได้ช่องทางเดียวต่อคอนเทนต์ และ `channel_id` จะเป็น NULL เสมอ
- *ผลต่อ `content_items.views/likes`:* เขียนเป็น **ผลรวมทุกช่องทาง** ของคอนเทนต์นั้น เพื่อให้การ์ด/ranking เดิมที่อ่านสองคอลัมน์นี้ยังทำงานได้ทันที
- *ยังไม่ query หาโพสต์ใหม่:* เรียก `/{post_id}/insights` ตรง ๆ ไม่เรียก `/{page_id}/feed` แล้ว match ตามชื่อ (เปราะบางและกิน quota)

**4. cron ใช้ `type='include'` + `file_path='api/cron/content-metrics-sync.php'`**
- *เหตุผล:* ตามแบบ `publish-scheduler`/`ai-digest` — ไฟล์ include รับ `CRON_MODE` + `$GLOBALS['cron_run_id']` และเขียน `cron_runs` ได้
- *ทางเลือกที่พิจารณา:* `type='http'` — ปฏิเสธเพราะต้อง expose endpoint + token และแพงกว่าสำหรับงาน background

**5. แก้ `analytics-recalculate` แบบ patch (2 จุด) ไม่ refactor**
- *เหตุผล:* ตามกลยุทธ์ patch ไม่ refactor — เปลี่ยน `DAYOFWEEK(created_at)/HOUR(created_at)` → `DAYOFWEEK(published_at)/HOUR(published_at)` และแก้ข้อความเกตให้บอกจำนวนขาด
- *ทางเลือกที่พิจารณา:* refactor สูตร scoring ใหม่ — ปฏิเสธ (นอก scope; น้ำหนัก `likes×2` คงไว้ แต่จะบันทึกที่มาเป็น comment)

## Risks / Trade-offs

- [ความเสี่ยง] FB token หมดอายุ ไม่มีระบบแจ้งเตือน → Mitigation: บันทึก error ลง `cron_runs.errors` + `error_msg` เพื่อให้เห็นจาก cron-manager; การแจ้งเตือนเต็มรูปแบบเป็น task แยก
- [ความเสี่ยง] เกต ≥10 published ยังไม่ผ่าน (published=0 ปัจจุบัน) → Mitigation: ทำงาน migration/fetch/cron ให้เสร็จก่อน เกตจะผ่านเองเมื่อโพสต์สะสม; แก้ข้อความให้บอกจำนวนขาด
- [ความเสี่ยง] ผู้ใช้เข้าใจผิดว่าตัวเลขครอบคลุมทุกช่องทาง → Mitigation: label ใน UI ระบุชัด "เฉพาะ Facebook/Instagram"
- [ความเสี่ยง] Facebook Insights metric ไม่มี "views/likes" ตรงตัว (มี impressions/reactions) → Mitigation: map อย่างชัดเจนใน `insights-fetch.php` (reactions→likes, impressions→views) และบันทึก mapping ไว้ใน code comment
- [ความเสี่ยง] `external_post_id` เป็น NULL สำหรับคอนเทนต์ที่เผยแพร่ก่อนเฟส 0 → Mitigation: cron ไล่จาก `content_publish_queue` ที่ `status='sent' AND platform_post_id IS NOT NULL` จึงข้ามแถวที่ไม่มี id อย่างเงียบ ๆ ไม่ error
- [ความเสี่ยง] **ปัจจุบันไม่มีโพสต์ FB/IG ที่เผยแพร่จริงเลย** (queue ที่ `sent` 16 แถวเป็น lotusdomino ทั้งหมด ซึ่งเป็น Non-Goal) → cron จะประมวลผล 0 แถวจนกว่าจะมีการโพสต์จริง Mitigation: พิสูจน์ code path ด้วย mock insights endpoint + seed data แล้วบันทึกเป็นหลักฐาน
- [ความเสี่ยง] **creds ของ FB/IG ในฐานข้อมูลเป็นค่า placeholder** (`page_id=123546`, `access_token` 7 ตัวอักษร; IG ไม่มีคีย์เลย) → ไม่ใช่แค่เพิ่ม scope แต่ต้องขอ token ใหม่ทั้งชุด Mitigation: แยกงานกลุ่ม 6 ออกเป็น blocker ที่ไม่ขวางกลุ่ม 1–5

## Migration Plan

1. Deploy migration `content_post_metrics` (ไม่มี schema change ในตารางอื่น)
2. Deploy `api/lib/insights-fetch.php` + `api/cron/content-metrics-sync.php`
3. ลงทะเบียน cron ผ่าน `cron-manager.php` (`type='include'`)
4. Deploy fix `analytics-recalculate` + UI `AnalyticsSocialTab`
5. Rollback: ลบ cron entry + ลบไฟล์ใหม่ (additive ไม่กระทบเส้นทางเดิม); migration rollback = DROP TABLE (ข้อมูลเป็น time-series สร้างใหม่ได้)

## Open Questions

- น้ำหนัก `likes × 2` ในสูตร scoring — ควรทำให้ตั้งค่าได้หรือไม่ (ตอนนี้คงค่าไว้ แต่บันทึกที่มาเป็น comment)
- Facebook Insights ใช้ metric ตัวไหนเป็น "views" กันแน่ (impressions vs video_views) — ต้องยืนยันกับเจ้าของเพจว่าต้องการนิยามไหน
