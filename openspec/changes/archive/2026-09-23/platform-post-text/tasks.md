## 1. Backend: ประกอบข้อความโพสต์

- [x] 1.1 `api/lib/publish-dispatch.php`: เพิ่ม `publish_strip_directions(string): string` ตาม regex ใน design ข้อ 2 (ต้นบรรทัดเท่านั้น, ลบบรรทัดที่เหลือว่าง, ยุบบรรทัดว่างซ้อน)
- [x] 1.2 เพิ่ม `publish_screenplay_check(string): ?string` ตาม design ข้อ 3 (คืนเหตุผลไทยพร้อมตัวอย่างบรรทัดที่เจอ)
- [x] 1.3 เพิ่ม `publish_social_post_text(array $content, string $platform): array` ตาม design ข้อ 1 (title = `content_items.title`; body = content_override → scripts ที่ตัดคำกำกับ → caption → html→text; dedupe `<h1>` เทียบทั้ง `content_items.title` และ `article_content.title`)
- [x] 1.4 `dispatch_content()`: platform โซเชียลใช้ title/body จากข้อ 1.3 — เว็บ/CMS คงเดิม (`article_content.title ?? title`, html, และ override เดิมของคิวเก่าแทน html)
- [x] 1.5 `publish_via_central_flow()`: เรียก `publish_screenplay_check()` กับข้อความสุดท้ายของโซเชียลหลัง final publish gate → `blocked` + เหตุผล (ไม่เรียก dispatcher)
- [x] 1.6 `api/cron/publish-scheduler.php`: เลิกเลือก `scripts[platform]` เอง, ส่ง `content_override` เป็น key แยก (`$content['content_override']`) แทนการเขียนทับ caption/article_content สำหรับโซเชียล (เว็บคงพฤติกรรมเดิมของคิวเก่า), ตรวจ `publish_screenplay_check()` ก่อน dispatch → `failed` + `error_msg` ตาม pattern gate เดิม
- [x] 1.7 `api/content-publish.php`: schedule และ send-now เพิกเฉย `channel_overrides` (ไม่ error) และเขียน `content_override = NULL` สำหรับคิวใหม่
- [x] 1.8 เทสต์ `api/tests/platform-post-text-test.php`: ตาราง fixture ตัดคำกำกับ (Post caption/Caption/Reels/ข้อความ LINE OA/Hook 3 วิ/Scene 1/Section 2/Intro/Outro/CTA, ตัวพิมพ์เล็ก-ใหญ่, คำเดียวกันกลางประโยคไม่ถูกตัด, บรรทัดว่างไม่ซ้อน), ลำดับแหล่งข้อความ 5 กรณี (override/script/caption/article/empty), หัวข้อโซเชียลจาก `content_items.title` + เว็บยังใช้ชื่อบทความ, dedupe h1 ทั้งสองค่า, gate บทวิดีโอ (Visual:/Voiceover:/[0:00/[Hook → บล็อก, ข้อความปกติผ่าน), `dispatch_content` เว็บยังได้ HTML เดิม
- [x] 1.9 รันเทสต์ publish เดิมที่เกี่ยวข้อง (`api/tests/*publish*`, `scripts/test-publish-dispatch-hardening.php`) ให้ผ่าน/ปรับตาม requirement ใหม่

## 2. Backend: prompt

- [x] 2.1 `api/brand-content.php`: แทน `$scriptExamples` ทั้งสองจุด (วิดีโอ ~2791, บทความ ~2830) ด้วยตัวอย่างไม่มีคำกำกับตาม design ข้อ 6 (tiktok = แคปชั่น + hashtag, youtube = คำอธิบายคลิป)
- [x] 2.2 เพิ่มกฎ "scripts คือข้อความพร้อมโพสต์ — ห้ามคำกำกับ ห้ามพาดหัว ห้ามบทวิดีโอแยกฉาก; twitter รวมหัวข้อ ≤ 280" ใน system prompt ทั้งสองจุด
- [x] 2.3 เทสต์ข้อ 1.8 เพิ่ม: ตรวจว่า schema/prompt ที่ประกอบได้ไม่มีรูปแบบ `Label:` ในตัวอย่าง scripts (แยกฟังก์ชันสร้างตัวอย่างออกมาให้ทดสอบได้ถ้าจำเป็น)

## 3. Frontend: ตัดคำกำกับ + หน้าต่างเผยแพร่

- [x] 3.1 `types.ts`: `stripScriptDirections(text)` ใช้ regex เดียวกับ PHP กับทุก platform (ตัดพารามิเตอร์ platform — ปรับผู้เรียกทั้งหมด), เพิ่ม `SOCIAL_POST_PLATFORMS` และ `getPublishDefaultText()` คืน `{text, source}` ('script' | 'caption' | 'article')
- [x] 3.2 `SchedulePublishDialog.tsx`: แทน Textarea ด้วยกล่องแสดงผลอ่านอย่างเดียว (หัวข้อตัวหนา + ข้อความ + ป้ายแหล่งที่มา), เว็บแสดง "จะโพสต์เนื้อหาบทความของคอนเทนต์นี้", คำแนะนำให้แก้ใน dialog แก้ไขคอนเทนต์, label "ข้อความโพสต์ ({platform})", ลบ `buildOverrides()` / `channel_overrides`

## 4. Frontend: ContentCardDialog

- [x] 4.1 state `scriptsDraft` + รายการแท็บ = platform โซเชียลที่เลือก (ไม่ใช่ key ที่มี) — แท็บเป็น Textarea แก้ได้, บรรทัดบนแสดงหัวข้อ (`topic` ปัจจุบัน) ตัวหนา
- [x] 4.2 แท็บว่าง: ข้อความ "ยังไม่มีข้อความเฉพาะ — ตอนโพสต์จะใช้ข้อความโพสต์สำรองแทน" + ตัวอย่างข้อความสำรอง
- [x] 4.3 แท็บ twitter: ตัวนับ `(หัวข้อ + "\n\n" + ข้อความ).length/280` + คำเตือนเมื่อเกิน (ไม่บล็อก)
- [x] 4.4 บันทึก: merge `scriptsDraft` ลง `art.scripts` ใน payload `article_content` ของปุ่ม "บันทึก" (ข้อความว่าง = ไม่เขียน key, key เดิมที่ไม่มีแท็บคงไว้) + รวมใน `isDirty` snapshot ทั้งตอนโหลดและหลังบันทึก
- [x] 4.5 เปลี่ยนชื่อ: หัวส่วน "ข้อความโพสต์แต่ละ Platform", ช่อง `caption` → "ข้อความโพสต์สำรอง" + คำอธิบาย "ใช้เมื่อ platform ไม่มีข้อความเฉพาะ"

## 5. เทสต์ Frontend

- [x] 5.1 ปรับเทสต์เดิมที่อ้าง "Scripts สำหรับ Platform ที่เลือก", "Caption (", การแก้ข้อความใน `SchedulePublishDialog`, `channel_overrides`, `stripScriptDirections(text, platform)` (เช่น `ContentCardDialogScripts.test.tsx` และเทสต์ของ prefill)
- [x] 5.2 เทสต์ใหม่ `ContentCardDialogPostText.test.tsx`: แท็บครบทุก platform โซเชียลที่เลือก (ไม่มีเว็บ), แท็บว่างแสดงข้อความสำรอง, แก้แล้วบันทึกได้ `article_content.scripts` ใหม่โดย key อื่นและ `scenes[].id` ไม่เปลี่ยน, ข้อความว่างไม่เขียน key, หัวข้อบรรทัดบนเปลี่ยนตามช่อง "หัวข้อ", ตัวนับ twitter + คำเตือน, ชื่อใหม่แสดงครบ
- [x] 5.3 เทสต์ `SchedulePublishDialog`: ไม่มีช่องแก้ไข, ตัวอย่างต่อ platform ต่างกันและตัดคำกำกับ (รวม facebook), คำขอ send-now/schedule ไม่มี `channel_overrides`, fixture ตัดคำกำกับชุดเดียวกับ PHP ให้ผลตรงกัน

## 6. ตรวจสอบ

- [x] 6.1 `php -l` ไฟล์ที่แก้ + รันเทสต์ PHP ของกลุ่ม 1–2
- [x] 6.2 `pnpm lint`, `pnpm build`, `pnpm test` — ไม่มี fail ใหม่เทียบ 8 ตัวที่ fail อยู่แล้วบน HEAD
- [x] 6.3 ตรวจผ่านหน้าเว็บ local: เปิดคอนเทนต์ `ce12e595` (11 platform) เห็นแท็บ 7 แท็บ, แท็บว่าง 3 แท็บ, แก้ข้อความแล้วบันทึก → สถานะ/Quality ตามกติกาเดิม; เปิดหน้าต่าง "ตั้งเวลาโพสต์" เห็นตัวอย่างอ่านอย่างเดียวพร้อมหัวข้อ; ตรวจ payload ไม่มี `channel_overrides`
  — หมายเหตุ: ตรวจแล้วผ่านหน้าเว็บ: `ce12e595` แสดง 7 แท็บ (Line OA/LinkedIn/Twitter มี ⚠ + ข้อความสำรอง), หัวข้อบรรทัดบน, ชื่อ "ข้อความโพสต์สำรอง"; หน้าต่าง "ตั้งเวลาโพสต์" ไม่มีช่องแก้ (0 textarea), ตัวอย่าง Facebook = หัวข้อ + ข้อความ, WordPress = "จะโพสต์เนื้อหาบทความ" — **ไม่ได้กดบันทึก/ส่ง** เพราะคอนเทนต์นี้อนุมัติแล้ว (บันทึกจะดึงกลับเป็น revision) — การบันทึก/payload ตรวจใน Vitest แทน
- [x] 6.5 (เพิ่มตามผลตรวจจริง) กฎ prompt ห้ามคัดลอกแคปชั่นทั้งก้อน + ทดสอบสร้างคอนเทนต์ใหม่ครบ 7 platform โซเชียล (`e46d0838`): ไม่มีคำกำกับ/บทวิดีโอ/พาดหัวซ้ำ, ความเหมือนกับแคปชั่น 26–59%, ระหว่าง platform สูงสุด 64% — Twitter ยาวเกิน (หัวข้อ 72 + ข้อความ 266) → ปรับเพดานตัวข้อความ twitter เป็น 180 แล้วสร้างใหม่ได้ 81 + 162 = 245 ✓ — gate เพิ่มรูปแบบ `- Visual:` / `ฉากที่ N` / `[สคริปต์` ที่หลุดจากแคปชั่นเก่า `5121176a`
- [ ] 6.4 ทดสอบโพสต์จริง Facebook 1 ครั้ง (มี credential แล้ว — แอปอยู่ใน Development mode ดูผลจากบัญชีแอดมิน) ด้วยคอนเทนต์ที่อนุมัติแล้ว: ข้อความบนเพจ = หัวข้อ + ข้อความแท็บ Facebook ไม่มีคำกำกับ; และคอนเทนต์ที่มี "Visual:/Voiceover:" ถูกบล็อกพร้อมเหตุผล — ขอยืนยันกับผู้ใช้ก่อนโพสต์
