## Context

เส้นทางข้อความโพสต์โซเชียลตอนนี้:

```
AI (generate-article) → article_content.scripts[platform]   (prompt: tiktok/youtube = บทวิดีโอ, อื่นๆ มีคำกำกับ)
      │
      ├─ ContentCardDialog "Scripts สำหรับ Platform ที่เลือก" — แสดงอย่างเดียว, แท็บเฉพาะ key ที่มี
      ├─ SchedulePublishDialog — prefill จาก scripts (ตัดคำกำกับเฉพาะ tiktok/youtube ด้วย stripScriptDirections ใน types.ts)
      │     ผู้ใช้แก้ได้ → channel_overrides → content_publish_queue.content_override / content.caption
      ├─ publish-scheduler.php:123 — ไม่มี override → content.caption = scripts[platform] ดิบ (ไม่ตัดคำกำกับ)
      └─ dispatch_content() (publish-dispatch.php:264) — $socialBody = caption → html→text
            dispatch_* ประกอบ "$title\n\n$body" โดย $title = article_content.title ?? content_items.title
```

ปัญหา: ข้อความที่โพสต์ ≠ ข้อความที่ผู้อนุมัติเห็น (แก้ได้หลังอนุมัติ, หัวข้อมาจากชื่อที่ AI ตั้ง), คำกำกับหลุด (ข้อมูลจริง: facebook 3–4 จาก 32, tiktok 4–5 จาก 27), scripts ของ tiktok/youtube เป็นบทวิดีโอ, คอนเทนต์ที่สร้างก่อน commit `b8ccfe8` (4 ก.ย.) มี scripts แค่ 4 platform ตายตัว

การแก้ `article_content` ผ่าน `PUT content-items.php` ล้าง `quality_checked_at` และดึงสถานะกลับเป็น `revision` เมื่ออนุมัติแล้วอยู่แล้ว ([content-items.php:206](api/content-items.php:206))

## Goals / Non-Goals

**Goals:**
- ข้อความโพสต์โซเชียลถูกแก้ที่เดียว (`ContentCardDialog`) ก่อนอนุมัติ และสิ่งที่โพสต์ = สิ่งที่เห็นในแท็บ (หัวข้อ + ข้อความ)
- backend ประกอบข้อความจุดเดียว ใช้ทั้ง "ส่งเดี๋ยวนี้" และ cron
- ข้อมูลเก่าที่มีคำกำกับ/บทวิดีโอปน ไม่หลุดขึ้นโพสต์

**Non-Goals:**
- `script_sections` / โครงสร้างบท (change `scene-story-roles`), การโพสต์วิดีโอ (Phase 5), เว็บ/CMS (ยังใช้บทความ), แก้ dispatch ของ TikTok/YouTube, สร้าง scripts ย้อนหลังให้คอนเทนต์เก่า

## Decisions

### 1. ฟังก์ชันกลาง `publish_social_post_text(array $content, string $platform): array`
คืน `['title' => string, 'body' => string, 'source' => 'override'|'script'|'caption'|'article'|'empty']` อยู่ใน `api/lib/publish-dispatch.php` และ `dispatch_content()` เรียกสำหรับทุก platform ใน `SCRIPT_PLATFORMS`:
- title = `trim(content_items.title)`
- body ตามลำดับ: `$content['content_override']` (มีเฉพาะคิวเดิม) → `publish_strip_directions(scripts[platform])` → `trim(caption)` → `publish_html_to_text(html, dedupe titles)`
- `dispatch_content()` ส่ง title/body ที่ได้เข้า dispatcher เดิม (signature ไม่เปลี่ยน — dispatcher ยังประกอบ `"$title\n\n$body"` และตัดเพดานเอง)
- เว็บ/CMS ไม่ผ่านฟังก์ชันนี้ ใช้ `$art['title'] ?? content.title` + html เดิม

ทางเลือกที่ไม่เลือก: ให้ scheduler/content-publish เลือกข้อความก่อนส่งเข้า dispatch (แบบเดิม) — สองจุดเคย drift กันแล้ว (cron ไม่ตัดคำกำกับ)

`publish-scheduler.php`: เลิกเขียน `$content['caption'] = scripts[...]` และเลิก `json_encode(['html' => $ov])` ทับ article_content — ส่ง `content_override` ในรูป key แยก (`$content['content_override']`) ให้ฟังก์ชันกลางตัดสิน — สำหรับเว็บ/CMS ที่คิวเดิมมี override ให้คงพฤติกรรมเดิม (override แทน html) เพื่อไม่เปลี่ยนโพสต์ที่ตั้งไว้

### 2. กฎตัดคำกำกับชุดเดียว 2 ภาษา
- PHP `publish_strip_directions(string $text): string` และ TS `stripScriptDirections(text)` (ตัดพารามิเตอร์ platform ออก — ใช้ทุก platform) ใช้ regex เดียวกัน:
  `^\s*(post caption|caption/reels|caption|professional post|post|ข้อความ line oa|hook(\s*\d+\s*วิ)?|scene\s*\d+|section\s*\d+|intro|outro|cta)\s*[:：]\s*` (case-insensitive, multiline, `u`)
- ตัดเฉพาะต้นบรรทัด แล้วลบบรรทัดที่ว่างเพราะเหลือแต่คำกำกับ ยุบบรรทัดว่างซ้อนเกิน 1
- เทสต์ทั้งสองฝั่งใช้ fixture ชุดเดียวกัน (ตาราง input/expected ใน tasks) เพื่อกัน drift

### 3. gate บทวิดีโอปน `publish_screenplay_check(string $finalText): ?string`
- ตรวจบรรทัดขึ้นต้น `visual|voice ?over|narration|shot` + `:` และ timecode `[\[(]\s*\d{1,2}:\d{2}` หรือ `\[hook` (case-insensitive)
- คืนเหตุผลภาษาไทย (ระบุตัวอย่างที่เจอ ≤ 40 ตัวอักษร) หรือ null
- เรียกใน `publish_via_central_flow()` หลัง `final_publish_gate_check` (ส่งเดี๋ยวนี้) และใน `publish-scheduler.php` ก่อน dispatch → `status='blocked'`/`failed` พร้อม `error_msg` ตาม pattern gate เดิม
- ตรวจหลังตัดคำกำกับ: `Scene 1:` ถูกตัดไปแล้วจึงไม่ถูกตรวจซ้ำ แต่ `Visual:`/`Voiceover:`/timecode ไม่ได้อยู่ในรายการตัด → โดนบล็อก (ตั้งใจ: บทวิดีโอแบบเต็มต้องให้คนแก้ ไม่ใช่ตัดทิ้งเงียบๆ)

### 4. `ContentCardDialog` — แท็บแก้ได้ + บันทึกใน `article_content`
- state `scriptsDraft: Record<platform, string>` เริ่มจาก `articleData.scripts` — รายการแท็บ = platform โซเชียลที่เลือก (`platforms` ∩ `SOCIAL_PLATFORMS` + `youtube`) ไม่ใช่ key ที่มี
- บันทึก: merge `scriptsDraft` เข้า `art.scripts` ใน payload `article_content` เดิมของปุ่ม "บันทึก" (ข้าง `visuals`) — เก็บ key เดิมที่ไม่มีแท็บไว้ (เช่น platform ที่ถูกยกเลิกเลือก) ไม่ลบ — รวมใน `isDirty` snapshot
- ช่องว่าง → ไม่เขียน key (ไม่บันทึก `""`) เพื่อให้ fallback ทำงาน
- ส่วนหัวของแท็บ: หัวข้อ = state `topic` ปัจจุบัน (สะท้อนการแก้ที่ยังไม่บันทึก), ตัวนับ twitter = `[...(topic + "\n\n" + text)].length`
- ตัวอย่างข้อความสำรองของแท็บว่าง = `caption` (ถ้าว่าง → "เนื้อหาบทความ")
- การดึงสถานะกลับเป็น `revision` และล้าง Quality ใช้กติกาเดิมของ `PUT content-items.php` (ไม่เขียนโค้ดใหม่)

### 5. `SchedulePublishDialog` อ่านอย่างเดียว + backend ไม่รับ override ใหม่
- เปลี่ยน `Textarea` เป็นกล่องแสดงผล (`whitespace-pre-wrap`) ต่อ platform: หัวข้อ (ตัวหนา) + ข้อความจาก `getPublishDefaultText()` (ตัดคำกำกับทุก platform) + ป้ายแหล่งที่มา ("จากข้อความโพสต์ Facebook" / "จากข้อความโพสต์สำรอง") — เว็บแสดง "จะโพสต์เนื้อหาบทความของคอนเทนต์นี้"
- คำแนะนำ: "ต้องการแก้ข้อความ? แก้ใน 'ข้อความโพสต์แต่ละ Platform' ของคอนเทนต์ (ต้องขออนุมัติใหม่)"
- ลบ `buildOverrides()` และไม่ส่ง `channel_overrides`
- `content-publish.php`: ทั้ง schedule และ send-now **เพิกเฉย** `channel_overrides` ที่ส่งมา (ไม่ error — client เก่าที่ cache อยู่ยังใช้ได้) และเขียน `content_override = NULL` เสมอสำหรับคิวใหม่ — กัน API ข้ามการอนุมัติ
- หัวข้อที่แสดงใช้ `content_items.title` จาก item (ตรงกับ backend)

### 6. prompt ของ scripts
- แทน `$scriptExamples` ทั้งสองจุด ([brand-content.php:2791](api/brand-content.php:2791), [2830](api/brand-content.php:2830)) ด้วยตัวอย่างไม่มีคำกำกับ เช่น tiktok `"แคปชั่นสั้นดึงความสนใจ 1-3 บรรทัด ... #แฮชแท็ก"`, youtube `"คำอธิบายคลิป: สรุปเนื้อหา ... ชวนกดติดตาม"` (เป็นคำอธิบายภาษาไทย ไม่ใช่ `Label:`)
- เพิ่มกฎใน system prompt: "scripts คือข้อความพร้อมโพสต์ — ห้ามคำกำกับต้นบรรทัด ห้ามพาดหัว/ชื่อเรื่อง (ระบบเติมหัวข้อให้) ห้ามเป็นบทวิดีโอแยกฉาก; twitter รวมกับหัวข้อต้อง ≤ 280"
- ไม่แตะ `script_sections` schema (อยู่นอกขอบเขต)

### 7. ชื่อบนหน้าจอ
- `ContentCardDialog`: หัวส่วน "ข้อความโพสต์แต่ละ Platform", label ช่อง `caption` → "ข้อความโพสต์สำรอง" + คำอธิบาย, placeholder ปรับตาม
- `SchedulePublishDialog`: "ข้อความโพสต์ ({platform})"
- ค้นคำ "Scripts สำหรับ Platform" / "Caption (" ในเทสต์เดิมแล้วปรับให้ตรง

## Risks / Trade-offs

- [ผู้ใช้เคยแก้ข้อความตอนกดเผยแพร่ ต้องเปลี่ยนวิธีทำงาน] → คำแนะนำในหน้าต่างเผยแพร่ชี้ไปที่จุดแก้ใหม่
- [แก้ข้อความโพสต์ = ต้องตรวจ Quality ใหม่ + ขออนุมัติใหม่ (กติกาเดิมของการแก้ `article_content`)] → ตั้งใจ: ข้อความที่ถูกอนุมัติต้องเป็นของจริง; ระบุในผลทดสอบว่า Quality ของบทความไม่ได้ขึ้นกับ scripts (scripts ไม่ถูกประเมิน SEO/AEO ตาม `direct-platform-script-generation`) — แค่ต้องกดตรวจใหม่
- [regex ตัดคำกำกับตัดผิด เช่นบรรทัดที่ขึ้นต้นด้วย "Post:" โดยตั้งใจ] → จำกัดเฉพาะต้นบรรทัด + รายการคำตายตัว; เทสต์กรณีคำเดียวกันกลางประโยค
- [gate บทวิดีโอปนบล็อกผิด] → ใช้รูปแบบที่ชัด (ต้นบรรทัด + `:`, timecode) และเหตุผลบอกบรรทัดที่เจอ ผู้ใช้แก้แล้วส่งใหม่ได้
- [คิวเดิมที่มี `content_override` ข้ามการอนุมัติไปแล้ว] → ยอมรับ: ไม่เปลี่ยนโพสต์ที่ตั้งไว้แบบเงียบๆ; คิวใหม่ไม่มี override
- [AI ยังเขียนพาดหัวในข้อความ] → prompt สั่งห้าม; ข้อมูลที่หลุด ผู้ใช้เห็นในแท็บ (หัวข้ออยู่บรรทัดบน) และแก้ได้เอง

## Migration Plan

- ไม่มี migration DB — ข้อมูลเดิมใช้ได้ทันที (ตัดคำกำกับตอนโพสต์, platform ที่ไม่มี scripts ใช้ข้อความสำรอง)
- deploy: backend + frontend พร้อมกัน; backend เพิกเฉย `channel_overrides` จึงปลอดภัยแม้ frontend เก่ายังเปิดค้าง
- rollback: revert โค้ด — ไม่มีข้อมูลที่ต้องคืน (scripts ที่ผู้ใช้แก้ยังอยู่ใน `article_content`)

## Open Questions

- ไม่มี — รายละเอียดที่เหลือ (ถ้อยคำคำแนะนำ, สีป้าย) ตัดสินตอน implement ตามแนว UI เดิม
