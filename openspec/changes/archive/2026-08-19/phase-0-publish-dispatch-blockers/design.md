## Context

ระบบเผยแพร่มี 2 เส้นทางที่เรียก `dispatch_content()` (ใน `api/lib/publish-dispatch.php`): cron queue (`publish-scheduler.php`) และ `send_now` (`content-publish.php`) ทั้งคู่ใช้ `match($platform)` ที่รองรับ 9 platform แต่ไม่มี `lotusdomino` จึงคืน `Unknown platform: lotusdomino` ให้ทุกคอนเทนต์ที่เข้าคิวผ่าน channel Lotus Domino — ณ 19 ส.ค. 2026 มี `failed` 16 แถวจากสาเหตุนี้

logic การส่ง Lotus Domino มีอยู่แล้วแบบ inline ใน `api/brand-content.php` (`?action=publish`, ~บรรทัด 2276, 2550, 3178) ซึ่งโพสต์ JSON ไปยัง Domino agent endpoint พร้อมฟิลด์ SEO/AEO (Slug, SEOTitle, MetaDescription, Tags, AttachPhoto) แล้ว "assume ok ถ้าไม่มี curl error"

กลยุทธ์ที่บังคับใช้ (จาก roadmap.md): **patch ไม่ refactor** — ยกเว้นจุด `lotusdomino` ที่จำเป็นเพราะเป็นต้นเหตุความล้มเหลวจริง

## Goals / Non-Goals

**Goals:**
- เพิ่ม `dispatch_lotusdomino()` ใน `api/lib/publish-dispatch.php` และเพิ่ม arm ใน `match($platform)` เพื่อให้ cron queue และ `send_now` เผยแพร่ไป Lotus Domino ได้
- ปลดล็อก DoD เฟส 0: ได้ `content_publish_queue.status='sent'` ครั้งแรก และ `content_items.published_at` ไม่ NULL ≥ 1
- คงพฤติกรรมเดิมของ Domino agent (payload JSON + assume ok เมื่อไม่มี curl error)

**Non-Goals:**
- ไม่ refactor inline curl ~163 บรรทัดของ `?action=publish` (task แยก)
- ไม่เพิ่มการแจ้งเตือน publish ล้มเหลว (task แยก)
- ไม่เพิ่มการจัดการ token หมดอายุ (task แยก)
- ไม่แก้ enum platform ให้มี `youtube` (งาน 0.7 ใช้วิธีตั้ง platform ถูกต้องหรือปิด `is_active` แทน)
- ไม่ reset failed 23 แถวทั้งหมด (ต้องตรวจรายแถวก่อน re-queue)

## Decisions

**1. สกัด `dispatch_lotusdomino()` เป็นฟังก์ชันใหม่ใน publish-dispatch.php**
- *เหตุผล:* `dispatch_content()` เป็น single source of truth สำหรับ cron queue; inline handler ใน brand-content.php ไม่สามารถเรียกจาก cron ได้
- *ทางเลือกที่พิจารณา:* แก้ inline handler ทุกจุดให้ map platform — ปฏิเสธ เพราะไม่ได้แก้ cron queue และทำซ้ำ logic 3 จุด

**2. `dispatch_lotusdomino()` รับเฉพาะ (channel, creds, title, body, excerpt, imgUrl) + ฟิลด์ SEO ที่จำเป็น**
- *เหตุผล:* ฟังก์ชัน dispatch อื่นใช้ signature นี้; ฟิลด์ slug/seoTitle/metaDesc/keywords/tags ส่งเป็นพารามิเตอร์ optional (มี default ว่าง) เพื่อไม่ให้ breaking signature เดิม
- *ทางเลือกที่พิจารณา:* ส่ง `$content` เต็ม array — ปฏิเสธ เพราะฟิลด์ SEO อยู่ใน `article_content` JSON และต้องการการ parse ซ้ำ

**3. คงพฤติกรรม "assume ok เมื่อไม่มี curl error" ของ Domino**
- *เหตุผล:* Domino agent เป็น black-box ไม่คืน HTTP error ที่เชื่อถือได้ เปลี่ยนเป็นตรวจ HTTP code จะเสี่ยง break พฤติกรรมเดิมโดยไม่จำเป็น
- *ทางเลือกที่พิจารณา:* ตรวจ HTTP status — ปฏิเสธ (patch ไม่ refactor)

**4. งาน 0.6/0.7 เป็น data fix ผ่าน SQL โดยตรง ไม่ใช่ code**
- *เหตุผล:* WordPress credentials และ Youtube platform เป็นข้อมูลใน `publish_channels` ไม่ใช่ code; แก้ที่ data ตรงกว่า

## Risks / Trade-offs

- [ความเสี่ยง] Domino endpoint จริงของ `Lotus Notes (KTNBS)` มี `credentials_encrypted = NULL` → หลังแก้ dispatcher แล้ว error จะเปลี่ยนเป็น "missing credentials" ยังส่งไม่ได้
  → Mitigation: งาน 0.5 ต้องทำคู่กับการเติม creds หรือตั้ง `is_active = 0` ของ channel นั้น
- [ความเสี่ยง] Re-queue failed ทั้งก้อนจะ fail ซ้ำทันที → Mitigation: ตรวจรายแถว `scheduled_at` ก่อน เฉพาะแถวที่ยังควรโพสต์ย้อนหลังจึง re-queue
- [ความเสี่ยง] WordPress ปลายทางอาจไม่รองรับ Application Password → Mitigation: งาน 0.6 ระบุความเสี่ยงนี้; ถ้าไม่รองรับต้องเปลี่ยนช่องทางทดสอบ DoD
- [ความเสี่ยง] `platform=''` (Youtube) จะได้ `Unknown platform: ` ทันทีที่มีคอนเทนต์เข้าคิว → Mitigation: งาน 0.7 ตั้ง platform ถูกต้องหรือปิด is_active

## Migration Plan

1. Deploy code (เพิ่ม `dispatch_lotusdomino()` + match arm) — ไม่มี schema migration
2. Data fix: แก้ WordPress credentials, แก้ Youtube platform, เติม/ปิด Lotus Notes credentials
3. Re-queue failed ที่ยังควรโพสต์ (ตรวจรายแถว)
4. รัน `php api/cron/publish-scheduler.php` เพื่อยิง DoD เส้นทาง cron
5. Rollback: revert code (ฟังก์ชันใหม่เป็น additive — ไม่กระทบ platform อื่น); data fix ย้อนกลับด้วยการ restore ค่าเดิมของ `publish_channels`
