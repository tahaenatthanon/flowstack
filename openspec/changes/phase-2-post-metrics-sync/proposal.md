## Why

หลังเผยแพร่คอนเทนต์ไปแล้ว ระบบไม่เคยดึงข้อมูล engagement กลับมาเลย — `content_items` ที่มี `views > 0 OR likes > 0` มี 0 แถว ทำให้การ์ดวิว/ไลก์, "เนื้อหายอดนิยม" และ "เวลาโพสต์ที่ดีที่สุด" ไม่มีข้อมูลจริง ตัวเลข engagement เดิม (views/likes) จึงเป็นศูนย์เสมอ และไม่มีทางรู้ว่าคอนเทนต์ที่เผยแพร่ไปแล้วมีผลตอบรับอย่างไร

## What Changes

- เพิ่มตาราง time-series `content_post_metrics` เก็บข้อมูล engagement ย้อนหลัง (ไม่ใช่ค่าเดียวทับไปทับมา) เพื่อดูแนวโน้มการเติบโตของโพสต์ได้
- เพิ่ม `api/lib/insights-fetch.php` — ดึง insights จาก Facebook Graph API (`/{post_id}/insights` ด้วย Page token เดิมที่ใช้ใน `dispatch_facebook()`) และ Instagram โดยใช้ `content_publish_queue.platform_post_id` (id โพสต์ต่อช่องทางที่บันทึกไว้ตอนเผยแพร่) เป็นคีย์
- เพิ่ม `api/cron/content-metrics-sync.php` — cron ซิงก์ metrics เขียนลง `content_items.views`/`content_items.likes` และตาราง time-series ลงทะเบียนใน `cron_jobs`
- แก้ `analytics-recalculate` ให้จัดกลุ่มด้วย `published_at` (ไม่ใช่ `created_at`) และแจ้งจำนวนที่ขาดให้ผู้ใช้ทราบ — **นี่คือการแก้บั๊กในโค้ดที่ ship ไปแล้ว**
- เติมข้อมูลจริงลง `AnalyticsSocialTab.tsx` (โครงเปล่ามีอยู่แล้ว) พร้อม label ระบุชัดว่าตัวเลขครอบคลุมเฉพาะ Facebook/Instagram

## Capabilities

### New Capabilities
- `post-metrics-sync`: migration ตาราง time-series `content_post_metrics`, ฟังก์ชันดึง insights (`api/lib/insights-fetch.php`) สำหรับ Facebook/Instagram, cron ซิงก์ (`api/cron/content-metrics-sync.php`) ที่เขียน views/likes กลับลง `content_items` และลง time-series

### Modified Capabilities
- `content-dashboard-analytics`: แก้ `analytics-recalculate` (widget "เวลาโพสต์ที่ดีที่สุด") ให้จัดกลุ่มด้วย `published_at` แทน `created_at` และให้เกต ≥10 published รายงานจำนวนที่ขาด
- `content-dashboard-social-placeholder`: sub-tab "โซเชียล" แสดงข้อมูล engagement จริง (Facebook/Instagram) แทน em dash "—" พร้อม label ระบุขอบเขตแพลตฟอร์มที่ครอบคลุม

## Impact

- `database/migrations/` — เพิ่ม migration ตาราง `content_post_metrics`
- `api/lib/insights-fetch.php` — ไฟล์ใหม่
- `api/cron/content-metrics-sync.php` — ไฟล์ใหม่ + ลงทะเบียน `cron_jobs`
- `api/brand-content.php` — แก้ `analytics-recalculate` (กลุ่ม `published_at`, ข้อความเกต)
- `src/components/content/AnalyticsSocialTab.tsx` — เสียบข้อมูลจริง + scope label
- `cron_runs` / `cron_jobs` — บันทึกผลรันของ cron ใหม่
- External dependency: Facebook Page token ที่มี scope `read_insights` (channel id `7b144d1b-…`) — งานจัดหา credentials ไม่ใช่โค้ด
