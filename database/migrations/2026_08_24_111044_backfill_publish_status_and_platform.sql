-- Backfill ผลเผยแพร่ที่ข้อมูลไม่สอดคล้องกัน — 2 เรื่องในไฟล์เดียว
--
-- ═══ เรื่องที่ 1: status ถอยกลับเป็น draft ทั้งที่เผยแพร่แล้ว ═══
--
-- ก่อนรัน: content_items ทั้ง 35 แถวเป็น status='draft' (published เหลือ 0) แต่มี 4 แถว
-- ที่ published_at ไม่ NULL และมีแถว status='sent' ใน content_publish_queue จริง
-- (updated_at ของ 3 แถวคือ 2026-08-24 10:18–10:19 = ถูกตั้งกลับเป็น draft ภายหลัง)
--
-- ทำไมทั้ง 4 แถวนี้ถือว่า "เผยแพร่จริง": ทุกแถวมี external_post_id จากปลายทางจริง และ
-- จำนวน sent rows ใน queue ตรงกัน
--   4196ca2b  facebook     3 sent rows  post id 1257586584107497_122100916827446843
--   a0309d33  facebook     2 sent rows  post id 1257586584107497_122100915723446843
--   d698c9f2  lotusdomino 16 sent rows  post id lotusdomino_1787117420
--   fd93d7fb  facebook     1 sent row   post id 1257586584107497_122103195393446843
--
-- ไม่แตะ approved_at: d698c9f2 มี approved_at = NULL เพราะถูกเผยแพร่ก่อนที่ approval gate
-- (commit 24a8620) จะมีอยู่ — การเติม approved_at ย้อนหลังคือการกุหลักฐานว่ามีคนอนุมัติ
--
-- ═══ เรื่องที่ 2: platform ไม่ตรงกับ channel ที่โพสต์จริง ═══
--
-- a0309d33 เก็บ platform='youtube' แต่แถว sent ใน queue (251f2e50) ชี้ channel facebook
-- และได้ post id รูปแบบ facebook (pageId_postId) — ค่า 'youtube' มาจากตอนสร้างคอนเทนต์
-- ไม่ใช่จากการเผยแพร่ (เส้นทางเผยแพร่ไม่เคยเขียนคอลัมน์นี้ ซึ่ง change นี้แก้แล้ว)
-- อีก 3 แถวมี platform ตรงกับ sent row อยู่แล้ว จึงไม่ต้องแก้
--
-- Rollback:
--   UPDATE content_items SET status = 'draft' WHERE id IN
--     ('4196ca2b-49b2-4eb7-9198-dbdec4afe506','a0309d33-e693-4671-b5d0-2f5fc2780b57',
--      'd698c9f2-0674-4ddf-8316-8c571d31b6c5','fd93d7fb-1b35-47e6-be68-06d3adf679ec');
--   UPDATE content_items SET platform = 'youtube'
--     WHERE id = 'a0309d33-e693-4671-b5d0-2f5fc2780b57';
--
-- See openspec/changes/phase-0-publish-result-gaps/ (งาน 1.1, 1.2)

UPDATE content_items
SET status     = 'published',
    updated_at = NOW()
WHERE id IN (
    '4196ca2b-49b2-4eb7-9198-dbdec4afe506',  -- facebook,    published_at 2026-08-21 15:30:55
    'a0309d33-e693-4671-b5d0-2f5fc2780b57',  -- facebook,    published_at 2026-08-21 15:29:08
    'd698c9f2-0674-4ddf-8316-8c571d31b6c5',  -- lotusdomino, published_at 2026-08-19 12:30:20
    'fd93d7fb-1b35-47e6-be68-06d3adf679ec'   -- facebook,    published_at 2026-08-24 10:15:08
)
  AND published_at IS NOT NULL;

UPDATE content_items
SET platform   = 'facebook',
    updated_at = NOW()
WHERE id = 'a0309d33-e693-4671-b5d0-2f5fc2780b57'
  AND platform = 'youtube';
