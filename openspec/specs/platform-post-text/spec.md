# platform-post-text Specification

## Purpose

กำหนดข้อความที่โพสต์ลงแพลตฟอร์มโซเชียล — ประกอบที่ backend จุดเดียว (`publish_social_post_text`) เป็น `content_items.title` + ข้อความโพสต์ของ platform (`article_content.scripts[platform]` ที่ตัดคำกำกับ → `caption` → บทความ), gate บทวิดีโอปน, การแก้ข้อความโพสต์ในแท็บ "ข้อความโพสต์แต่ละ Platform" ของ `ContentCardDialog` (ผ่านการอนุมัติก่อนโพสต์) และชื่อเรียกบนหน้าจอ — ที่มา: change `platform-post-text`

## Requirements

### Requirement: ข้อความโพสต์โซเชียลประกอบที่ backend จุดเดียว
ระบบ SHALL มีฟังก์ชันกลาง (`publish_social_post_text()` ใน `api/lib/publish-dispatch.php`) ที่คืนข้อความโพสต์ของ platform โซเชียล (`facebook`, `instagram`, `tiktok`, `lineoa`, `linkedin`, `twitter`, `youtube`) — ทั้ง "ส่งเดี๋ยวนี้" (`api/content-publish.php`) และ cron (`api/cron/publish-scheduler.php`) SHALL ใช้ฟังก์ชันนี้ผ่าน `dispatch_content()` และ SHALL ไม่เลือกข้อความเองที่จุดเรียก

ข้อความโพสต์ SHALL เป็น `"{หัวข้อ}\n\n{ข้อความ}"` โดย:
- **หัวข้อ** = `content_items.title` (ช่อง "หัวข้อ" ในฟอร์มของ `ContentCardDialog`) — ว่าง → ไม่มีบรรทัดหัวข้อ
- **ข้อความ** = ตัวแรกที่ไม่ว่าง (หลัง `trim()`) ตามลำดับ: `content_publish_queue.content_override` ของคิวเดิมที่มีค่าอยู่แล้ว → `article_content.scripts[platform]` (ผ่านการตัดคำกำกับ) → `content_items.caption` → `article_content.html` แปลงเป็นข้อความล้วน

#### Scenario: ใช้ข้อความโพสต์ของ platform นั้น
- **WHEN** `content_items.title = "AI ช่วยร้านกาแฟ"` และ `scripts.facebook = "ลูกค้าทักแชทเยอะ?\nลองให้ AI ช่วยตอบ"`
- **THEN** ข้อความที่โพสต์ Facebook SHALL เป็น `"AI ช่วยร้านกาแฟ\n\nลูกค้าทักแชทเยอะ?\nลองให้ AI ช่วยตอบ"`

#### Scenario: หัวข้อมาจากช่องในฟอร์ม ไม่ใช่ชื่อที่ AI ตั้ง
- **WHEN** ผู้ใช้แก้ช่อง "หัวข้อ" เป็น "หัวข้อใหม่" แต่ `article_content.title` ยังเป็นชื่อเดิมที่ AI ตั้ง
- **THEN** บรรทัดแรกของโพสต์โซเชียล SHALL เป็น "หัวข้อใหม่"

#### Scenario: ไม่มีข้อความของ platform นั้น
- **WHEN** `scripts` ไม่มี key `linkedin` และ `caption = "ข้อความสำรอง"`
- **THEN** ข้อความของโพสต์ LinkedIn SHALL เป็น `caption`

#### Scenario: คิวเดิมที่มีข้อความที่แก้ไว้แล้ว
- **WHEN** คิว `pending` ที่สร้างก่อน change นี้มี `content_override = "ข้อความเดิม"`
- **THEN** ข้อความของโพสต์ SHALL เป็น "ข้อความเดิม" (ไม่เปลี่ยนโพสต์ที่ตั้งไว้แบบเงียบๆ)

### Requirement: ตัดคำกำกับที่ต้นบรรทัดทุก platform โซเชียล
ก่อนใช้ `scripts[platform]` เป็นข้อความโพสต์ ระบบ SHALL ตัดคำกำกับที่อยู่ต้นบรรทัด (ไม่สนตัวพิมพ์เล็กใหญ่) ออกสำหรับ**ทุก platform โซเชียล** ได้แก่ `Post caption`, `Caption/Reels`, `Caption`, `Professional post`, `Post`, `ข้อความ LINE OA`, `Hook` (รวม `Hook 3 วิ`), `Scene N`, `Section N`, `Intro`, `Outro`, `CTA` ตามด้วย `:` — เนื้อความหลัง `:` SHALL อยู่ครบ — การตัดที่ backend และที่หน้าจอ SHALL ใช้กฎชุดเดียวกัน

#### Scenario: Facebook มีคำกำกับติดมา
- **WHEN** `scripts.facebook = "Post caption: สนใจไหม\nCTA: ทักแชทเลย"`
- **THEN** ข้อความ SHALL เป็น `"สนใจไหม\nทักแชทเลย"`

#### Scenario: คำว่า CTA กลางประโยคไม่ถูกตัด
- **WHEN** ข้อความมีบรรทัด `"ทำ CTA ให้ชัด: ช่วยเพิ่มยอด"` (คำกำกับไม่ได้อยู่ต้นบรรทัด)
- **THEN** บรรทัดนั้น SHALL ไม่ถูกแก้

### Requirement: ไม่โพสต์ข้อความที่มีบทวิดีโอปน
ก่อนโพสต์โซเชียล ระบบ SHALL ตรวจข้อความสุดท้าย (หลังประกอบและตัดคำกำกับแล้ว) — ถ้าพบบรรทัดที่ขึ้นต้นด้วย (อาจนำด้วย bullet `-`/`•`/`*` หรือเลขข้อ) `Visual:`, `Voiceover:`, `Voice over:`, `Narration:`, `Shot:`, `บทพากย์:`, `เสียงบรรยาย:` หรือบรรทัด `ฉากที่ N`, หรือพบ timecode รูปแบบ `[0:00` / `(0:00`, หรือ `[Hook` / `[สคริปต์` SHALL ไม่โพสต์ และ SHALL คืนสถานะ `blocked` พร้อมเหตุผลภาษาไทย "ข้อความโพสต์มีบทวิดีโอปน (…) กรุณาแก้ข้อความโพสต์ของ {platform} ก่อนเผยแพร่" — ใช้ทั้ง "ส่งเดี๋ยวนี้" และ cron

#### Scenario: แคปชั่นเก่ามีบทวิดีโอ
- **WHEN** ข้อความที่จะโพสต์ Facebook มีบรรทัด `"Visual: บาริสต้ายิ้ม"` และ `"Voiceover: สวัสดีค่ะ"`
- **THEN** ระบบ SHALL ไม่เรียก Facebook API และคิวนั้น SHALL เป็น `blocked` พร้อมเหตุผลที่ระบุว่ามีบทวิดีโอปน

#### Scenario: บทวิดีโอแบบมี bullet และภาษาไทย
- **WHEN** แคปชั่นมีบรรทัด `" ฉากที่ 1 (8 วินาที)"` และ `"- Visual: บาริสต้ายุ่ง"`
- **THEN** ระบบ SHALL บล็อกพร้อมเหตุผล

#### Scenario: ข้อความปกติผ่าน
- **WHEN** ข้อความไม่มีรูปแบบดังกล่าว เช่น รายการ `"- ข้อดี: ตอบไว"`, เวลาเปิดร้าน `"เปิด 9:00 ถึง 18:00"` หรือคำว่า "ฉาก" กลางประโยค
- **THEN** ระบบ SHALL โพสต์ตามปกติ

### Requirement: แก้ข้อความโพสต์ได้ใน ContentCardDialog
ส่วน "ข้อความโพสต์แต่ละ Platform" ของ `ContentCardDialog` SHALL แสดงแท็บของ**ทุก platform โซเชียลที่คอนเทนต์เลือกไว้** (ไม่ใช่เฉพาะ platform ที่มี scripts อยู่แล้ว) และแต่ละแท็บ SHALL เป็นช่องแก้ไขข้อความได้ — การบันทึก SHALL ใช้ปุ่ม "บันทึก" หลักของ dialog (รวมใน dirty-tracking เดิม) โดยเขียนลง `article_content.scripts[platform]` — platform เว็บ/CMS SHALL ไม่มีแท็บ

แต่ละแท็บ SHALL แสดง:
- บรรทัดบนสุดเป็นหัวข้อที่จะถูกเติม (ค่าจากช่อง "หัวข้อ" ปัจจุบัน แสดงตัวหนา แก้ไม่ได้ในแท็บ)
- แท็บที่ข้อความว่าง: ข้อความ "ยังไม่มีข้อความเฉพาะ — ตอนโพสต์จะใช้ข้อความโพสต์สำรองแทน" พร้อมตัวอย่างข้อความสำรอง
- แท็บ `twitter`: ตัวนับความยาวรวม (หัวข้อ + ข้อความ) เทียบ 280 และคำเตือนเมื่อเกิน (ไม่บล็อกการบันทึก)

การบันทึกข้อความโพสต์หลังอนุมัติ SHALL ทำให้คอนเทนต์กลับเป็น `revision` และล้าง `approved_at` ตามกติกาเดิมของการแก้ `article_content`

#### Scenario: คอนเทนต์เก่ามี scripts แค่ 4 platform
- **WHEN** คอนเทนต์เลือก facebook, instagram, tiktok, youtube, lineoa, linkedin, twitter, wordpress แต่ `scripts` มีแค่ 4 key แรก
- **THEN** SHALL มีแท็บ 7 แท็บ (ไม่มี wordpress) และแท็บ lineoa, linkedin, twitter SHALL เป็นช่องว่างที่พิมพ์ได้พร้อมข้อความว่าจะใช้ข้อความสำรอง

#### Scenario: แก้ข้อความแล้วบันทึก
- **WHEN** ผู้ใช้แก้ข้อความแท็บ Facebook แล้วกด "บันทึก"
- **THEN** `article_content.scripts.facebook` SHALL เป็นค่าใหม่ และ key อื่นใน `article_content` (รวม `scenes[].id`) SHALL ไม่เปลี่ยน

#### Scenario: Twitter ยาวเกิน
- **WHEN** หัวข้อ + ข้อความ Twitter ยาว 310 ตัวอักษร
- **THEN** แท็บ SHALL แสดง `310/280` พร้อมคำเตือนว่าจะถูกตัดท้าย และยังบันทึกได้

#### Scenario: แก้หลังอนุมัติ
- **WHEN** คอนเทนต์ `approved` แล้วผู้ใช้แก้ข้อความโพสต์และบันทึก
- **THEN** สถานะ SHALL เป็น `revision` และ `approved_at` SHALL เป็น NULL

### Requirement: ชื่อเรียกข้อความโพสต์บนหน้าจอเป็นชุดเดียว
หน้าจอ SHALL ใช้ชื่อ: "ข้อความโพสต์แต่ละ Platform" (แทน "Scripts สำหรับ Platform ที่เลือก"), "ข้อความโพสต์ ({platform})" (แทน "Caption ({platform})" ในหน้าต่างเผยแพร่), และ "ข้อความโพสต์สำรอง" พร้อมคำอธิบาย "ใช้เมื่อ platform ไม่มีข้อความเฉพาะ" (แทนช่อง "แคปชั่น") — ชื่อ field ในโค้ด/API/DB (`scripts`, `caption`) SHALL ไม่เปลี่ยน

#### Scenario: เปิด dialog แก้ไขคอนเทนต์
- **WHEN** ผู้ใช้เปิด `ContentCardDialog`
- **THEN** SHALL เห็นหัวข้อส่วน "ข้อความโพสต์แต่ละ Platform" และช่อง "ข้อความโพสต์สำรอง" และ SHALL ไม่เห็นคำว่า "Scripts สำหรับ Platform ที่เลือก"
