## Why

ข้อความที่โพสต์ไปแต่ละ platform โซเชียลตอนนี้ไม่ใช่ข้อความที่ผู้ใช้และผู้อนุมัติเห็น: ระบบเติม "หัวข้อ" จากชื่อที่ AI ตั้ง (ไม่ใช่ช่อง "หัวข้อ" ที่ผู้ใช้แก้) ไว้บรรทัดแรก, Scripts ของ TikTok/YouTube ถูก AI เขียนเป็นบทวิดีโอแทนแคปชั่น, คำกำกับอย่าง `Post caption:`/`CTA:` หลุดขึ้นโพสต์, และข้อความแก้ได้แค่ในหน้าต่าง "ตั้งเวลาโพสต์" ซึ่งเกิดหลังการอนุมัติ — change นี้ทำให้ "ข้อความโพสต์แต่ละ Platform" เป็นสิ่งเดียวที่ถูกแก้ ถูกอนุมัติ และถูกโพสต์จริง ก่อนต่อยอดเป็นการโพสต์วิดีโอใน Phase 5

## What Changes

- AI เขียน `article_content.scripts[platform]` ทุก platform เป็น**ข้อความพร้อมโพสต์** — ไม่มีคำกำกับ (`Post caption:`, `CTA:`, `Hook 3 วิ:`, `Scene 1:` …) และไม่มีพาดหัว; `tiktok` = แคปชั่นสั้น + hashtag, `youtube` = คำอธิบายคลิป (เลิกเขียนเป็นบทวิดีโอ) — ใช้ทั้งคอนเทนต์วิดีโอและบทความ
- โพสต์โซเชียล (`facebook`, `instagram`, `tiktok`, `lineoa`, `linkedin`, `twitter`) = **`content_items.title` (ช่อง "หัวข้อ" ในฟอร์ม)** + ข้อความโพสต์ของ platform นั้น (สำรอง: `caption` → เนื้อหาบทความแปลงเป็นข้อความ) — backend ประกอบข้อความที่จุดเดียวให้ทั้ง "ส่งเดี๋ยวนี้" และ cron
- ตัดคำกำกับที่ต้นบรรทัดให้**ทุก platform โซเชียล** ที่ backend ก่อนโพสต์ (ตาข่ายรองรับข้อมูลเก่า)
- **gate ใหม่**: ข้อความสุดท้ายที่จะโพสต์มีรูปแบบบทวิดีโอ (`Scene N:`, `Visual:`, `Voiceover:`, `[0:00`, `[Hook`) → ไม่โพสต์ พร้อมเหตุผลภาษาไทย
- `ContentCardDialog`: แท็บ "ข้อความโพสต์แต่ละ Platform" **แก้ไขได้** (บันทึกด้วยปุ่ม "บันทึก" เดิม, แก้หลังอนุมัติ → กลับเป็น `revision` ตามกติกาเดิม), แสดงแท็บ**ครบทุก platform โซเชียลที่เลือก** (แท็บว่างพิมพ์เองได้ พร้อมบอกว่าจะใช้ข้อความโพสต์สำรอง), บรรทัดบนแสดงหัวข้อที่จะถูกเติม, Twitter มีตัวนับ /280 พร้อมคำเตือน
- **BREAKING (UI/API)**: หน้าต่าง "ตั้งเวลาโพสต์"/"ส่งเดี๋ยวนี้" (`SchedulePublishDialog`) **แสดงข้อความอย่างเดียว** — ทั้งข้อความโซเชียลและ "เนื้อหา" ของเว็บ; backend **ไม่รับ `channel_overrides` ใหม่** (คิวเดิมที่มี `content_override` อยู่แล้วยังใช้ตามเดิม)
- เปลี่ยนชื่อบนหน้าจอให้ตรงกัน: "Scripts สำหรับ Platform ที่เลือก" → "ข้อความโพสต์แต่ละ Platform", "Caption (Facebook)" → "ข้อความโพสต์ (Facebook)", ช่อง "แคปชั่น" → "ข้อความโพสต์สำรอง" (ชื่อในโค้ด/DB ไม่เปลี่ยน)

## Capabilities

### New Capabilities
- `platform-post-text`: การประกอบข้อความโพสต์โซเชียลต่อ platform (หัวข้อ + ข้อความโพสต์ + ลำดับสำรอง), การตัดคำกำกับ, gate บทวิดีโอปน, การแก้ไขข้อความโพสต์ใน `ContentCardDialog` (แท็บครบ, หัวข้อบรรทัดบน, ตัวนับ Twitter) และชื่อเรียกบนหน้าจอ

### Modified Capabilities
- `platform-script-publish-prefill`: หน้าต่างเผยแพร่แสดงข้อความอย่างเดียว ไม่ส่ง `channel_overrides`, ตัดคำกำกับทุก platform (ไม่ใช่แค่ tiktok/youtube), แสดงหัวข้อที่จะถูกเติม
- `publish-dispatch-plaintext-body`: ลำดับแหล่งเนื้อหาโพสต์โซเชียลเปลี่ยนเป็น ข้อความโพสต์ของ platform → `caption` → บทความ และหัวข้อมาจาก `content_items.title`
- `direct-platform-script-generation`: Platform Script ต้องเป็นข้อความพร้อมโพสต์ ไม่มีคำกำกับ/พาดหัว และ tiktok/youtube ไม่เป็นบทวิดีโอ

## Impact

- **Backend**: `api/lib/publish-dispatch.php` (ฟังก์ชันกลางประกอบข้อความโพสต์ + ตัดคำกำกับ + gate + หัวข้อจาก `content_items.title`), `api/cron/publish-scheduler.php` (เลิกเลือก script เอง ใช้ฟังก์ชันกลาง), `api/content-publish.php` (ไม่รับ `channel_overrides` ใหม่), `api/brand-content.php` (prompt ของ scripts ทั้งวิดีโอและบทความ)
- **Frontend**: `ContentCardDialog.tsx` (แท็บแก้ได้/ครบ/หัวข้อ/ตัวนับ/ชื่อใหม่ + บันทึก scripts ใน `article_content`), `SchedulePublishDialog.tsx` (แสดงอย่างเดียว), `types.ts` (`stripScriptDirections`, `getPublishDefaultText`) และเทสต์ที่เกี่ยวข้อง
- **ข้อมูล**: ไม่มี migration — scripts เก่ายังใช้ได้ (ตัดคำกำกับตอนโพสต์); scripts ที่ขาดบาง platform ใช้ข้อความสำรอง
- **ไม่อยู่ในขอบเขต**: `script_sections` / โครงสร้างบท (change `scene-story-roles`), การโพสต์วิดีโอ (Phase 5), เว็บ/CMS (ยังใช้เนื้อหาบทความเหมือนเดิม), การแก้ TikTok/YouTube dispatch
