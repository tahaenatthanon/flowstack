## 1. เตรียมการ

- [x] 1.1 ย้าย constant `SCRIPT_PLATFORMS` จาก `api/lib/script-quality-checklist.php` ไปประกาศใน `api/lib/publish-dispatch.php`
- [x] 1.2 Grep ทั่ว repo อีกครั้งหาทุกจุดที่อ้างอิง `script_quality`, `Script SEO`, `Script AEO`, `SCRIPT_SEO_WEIGHTS`, `SCRIPT_AEO_WEIGHTS`, `script_evaluate_seo`, `script_evaluate_aeo`, `script_quality_evaluate`, `script_quality_check_platform`, `script_quality_publish_check`, `script_quality_generation_requirements`, `script_quality_selected_platforms` เพื่อยืนยันสโคปก่อนแก้จริง (เทียบกับ proposal.md ว่าครบ)

## 2. Backend — Generation (`api/brand-content.php` → `generate-article`)

- [x] 2.1 ลบส่วน `SCRIPT SEO/AEO Requirements` และ key ตัวอย่าง SEO/AEO ของ script ออกจาก prompt schema ของ branch วิดีโอ (mainSys ใน video prompt)
- [x] 2.2 ลบส่วนเดียวกันออกจาก prompt schema ของ branch article/social
- [x] 2.3 ดึง instruction ที่ไม่เกี่ยวกับ SEO/AEO จาก `script_quality_generation_requirements()` (เช่น "ห้ามสร้าง platform อื่นที่ไม่ได้เลือก", "ไม่ copy เนื้อหาข้าม platform ตรงๆ") ไปใส่ไว้ใน system prompt โดยตรงก่อนลบฟังก์ชันนี้ทิ้ง
- [x] 2.4 ลบการเรียก `script_quality_evaluate()` รอบแรกหลัง decode JSON และ per-platform repair loop ที่ตามมา (รวม `$scriptQualityContext`, `$scriptAttempt`, `$scriptRepairSystem/$scriptRepairUser`)
- [x] 2.5 ลบการ re-evaluate `script_quality` หลัง SEO/AEO article repair (จุดที่ recompute `$scriptQuality` ซ้ำหลัง repair ของ article) และลบการเก็บ `$art['script_quality']` / `'script_quality' => $scriptQuality` ออกจาก response payload — รวมถึงลบ hard-fail `jsonError(422)` ที่เคยบล็อก generation ทั้งหมดเมื่อ Script SEO/AEO ไม่ผ่าน (พบเพิ่มระหว่างแก้จริง อยู่ในบล็อกเดียวกัน) และปรับ `$generationStatus`/`$finalStatus` ให้อิงแค่ Article SEO/AEO
- [x] 2.6 ลบข้อความ revision reason ที่อ้างอิง "Script SEO"/"Script AEO" (จุดสร้างข้อความ revision เมื่อ quality ไม่ผ่านหลัง repair ครบ)
- [x] 2.7 ตรวจจุด duplicate-content-for-date ที่ `unset($dateContent['script_quality'], ...)` — ลบทิ้งถ้าไม่มี field นี้ให้ unset แล้ว (dead code) — พบอีกจุดเดียวกันในตัว edit plan-item handler (`brand-content.php` ~L565-587) แก้ไปพร้อมกัน คง `quality_checked_at` invalidation ไว้ตามเดิม
- [x] 2.8 ปรับข้อความตัวอย่างจำนวนใน prompt schema: `visuals` และ `hashtags` เปลี่ยนจากตัวอย่างจำนวนตายตัว (เช่น 3 scene / 5 hashtag) เป็นข้อความกลางที่สื่อว่าจำนวนขึ้นกับความเหมาะสมของเนื้อหา (ทั้ง video และ article branch)

## 3. Backend — Publish Gate

- [x] 3.1 ลบ branch ตรวจ Script SEO/AEO ใน `content_quality_gate_check()` (`api/lib/publish-dispatch.php`) — คงเฉพาะ Article SEO/AEO gate สำหรับ web platform
- [x] 3.2 ลบ branch ตรวจ Script SEO/AEO ใน `final_publish_gate_check()` (`api/lib/publish-dispatch.php`) — คง Approval gate, Platform gate, Article SEO/AEO gate (web platform) ไว้ตามเดิม
- [x] 3.3 ลบฟังก์ชัน `publish_script_gate()` และจุดเรียกใช้ใน `api/content-publish.php` (พบว่าไม่มีจุดเรียกใช้จริงอยู่แล้ว — dead code)
- [x] 3.4 ลบการเรียก `script_quality_publish_check()` ในเส้นทาง cron auto-publish (`api/brand-content.php` ราว L3490) และข้อความ error `Script SEO/AEO gate: ...` ที่เกี่ยวข้อง

## 4. Backend — Cleanup

- [x] 4.1 ลบไฟล์ `api/lib/script-quality-checklist.php` ทั้งไฟล์ (หลังยืนยันว่า `SCRIPT_PLATFORMS` ย้ายออกแล้วตาม 1.1 และไม่มีฟังก์ชันอื่นถูกเรียกจากที่ใดอีก)
- [x] 4.2 ลบ `require_once .../script-quality-checklist.php` ออกจาก `api/brand-content.php` และ `api/content-publish.php` (require ที่เหลือใน `api/tests/entity-clarity-test.php` และ `api/tests/script-quality-gate-test.php` จัดการพร้อม task 6.1/6.3)
- [x] 4.3 ลบ logic invalidate `script_quality` เมื่อแก้ไข content ใน `api/content-items.php` — คง `quality_checked_at` invalidation (Article Quality) ไว้ตามเดิม

## 5. Frontend — UI (`src/components/content/ContentCardDialog.tsx`)

- [x] 5.1 ลบ component `ScriptQualityChecklist` และ `ScriptQualityPlatform` (รวม helper `scriptQualityScoreColor`/`scriptQualityStatusMeta` ที่ใช้เฉพาะสองจุดนี้ และ icon import ที่ไม่ใช้แล้ว)
- [x] 5.2 ลบ state/effect ที่ผูกกับ Script SEO/AEO เท่านั้น (`scriptQuality`, `setScriptQuality`, `persistedScriptQuality` และ effect ที่อ่าน `articleData?.script_quality`)
- [x] 5.3 ลบจุดเรียกใช้ `<ScriptQualityPlatform .../>` ใน JSX ของ Platform Script section
- [x] 5.4 ตรวจว่า Platform Script section ยังแสดง Script เต็ม, Script Sections, ภาพประกอบ, Hashtags ครบหลังลบ UI ส่วน SEO/AEO ออก — ยืนยันในเบราว์เซอร์จริงกับ content item จริง (TikTok, "เจาะลึกจุดเด่น Duckkit AI Portal...") เห็น Headlines/Scripts (แท็บ TikTok/YouTube/Instagram)/Script Sections (Opening/Bridge/Twist/Ending)/ภาพประกอบ (6)/Hashtags (6) ครบ และสแกน `dialog.innerText` ทั้งหมดพบคำว่า "SEO"/"AEO" แค่จุดเดียวคือ "SEO / AEO Metadata" ของ Article เท่านั้น ไม่มีจุดใดเกี่ยวกับ Script อีก

## 6. Tests

- [x] 6.1 `api/tests/script-quality-gate-test.php` — ทั้งไฟล์ทดสอบ `script_evaluate_seo`/`script_evaluate_aeo`/`script_quality_evaluate`/`script_quality_publish_check`/`script_gate_status` โดยตรง (ฟังก์ชันเหล่านี้ถูกลบไปพร้อมไฟล์ `script-quality-checklist.php` แล้ว ไม่เหลือ behavior ให้ทดสอบต่อ) → ลบไฟล์ทิ้งทั้งไฟล์
- [x] 6.2 เขียน `api/tests/publish-gate-test.php` ใหม่ทั้งไฟล์ — เพิ่ม Section C (TC09-TC15) พิสูจน์ regression ว่า Platform Script (สั้น/ไม่มี keyword/ไม่มี entity/ไม่มี script เลย) "ไม่ถูก block" อีกต่อไป ปรับ TC ที่เคยคาดหวัง per-platform script block (เดิม TC04-TC09, TC12-TC15, TC18-TC19, TC23-TC25) ให้สะท้อน behavior ใหม่ คงกลุ่ม Approval gate/Article SEO-AEO gate/publish-once/central executor ไว้ตามเดิมเพราะไม่เปลี่ยน
- [x] 6.3 `api/tests/entity-clarity-test.php` — ทั้งไฟล์ (EC01-EC06) ทดสอบ `entity_clarity` ซึ่งเป็น rule ภายใน Script AEO evaluation โดยตรง ไม่เหลือ behavior ให้ทดสอบต่อ → ลบไฟล์ทิ้งทั้งไฟล์
- [x] 6.4 ปรับ `src/__tests__/content/ContentCardDialogScripts.test.tsx` — ลบ TC9/TC10 เดิม (assert Script SEO/AEO checklist UI ที่ถูกลบแล้ว) แทนที่ด้วย TC9 ใหม่ที่ยืนยันว่าแม้มี legacy `script_quality` ค้างอยู่ใน article_content ก็ไม่แสดง UI คะแนน/checklist ใดๆ แต่ Script เนื้อหาเต็มยังแสดงปกติ; TC7 เดิม (platform boundary) คงไว้ ปรับแค่คำอธิบายที่อ้างอิง "repair" ที่ไม่มีแล้ว

## 7. Verification

- [x] 7.1 `php -l` ทุกไฟล์ PHP ที่แก้ไข (`api/brand-content.php`, `api/lib/publish-dispatch.php`, `api/content-publish.php`, `api/content-items.php`) — ผ่านหมด (รันซ้ำยืนยัน 2 รอบ)
- [x] 7.2 รัน `php api/tests/publish-gate-test.php` (เขียนใหม่ตาม 6.2) — 18/18 PASS; `script-quality-gate-test.php`/`entity-clarity-test.php` ถูกลบตาม 6.1/6.3 จึงไม่มีให้รัน; `seo-aeo-gate-test.php` (ไม่กระทบ) รันแยกยืนยัน 20/20 PASS
- [x] 7.3 `pnpm lint` — 0 errors (มีแค่ 47 warning เดิมที่ไม่เกี่ยวกับไฟล์ที่แก้)
- [x] 7.4 `pnpm test` — 24/24 files, 167/167 tests PASS (รันซ้ำยืนยัน 2 รอบ)
- [x] 7.5 `pnpm build` — build สำเร็จ
- [x] 7.6 ทดสอบจริงในเบราว์เซอร์ (login session จริง): เปิด content item จริงที่เลือก TikTok (script platform) ผ่าน ContentCardDialog — ยืนยัน UI ไม่แสดง Script SEO/AEO score/checklist ใดๆ (สแกนข้อความทั้ง dialog พบ "SEO/AEO" แค่จุดเดียวคือของ Article), Headlines/Scripts/Script Sections/ภาพประกอบ/Hashtags แสดงครบ, ปิด dialog ด้วย "ยกเลิก" แล้วตรวจ DB ยืนยันว่า record ไม่ถูกแก้ไข (updated_at เดิม) — ส่วนกด "ส่งทันที"/อนุมัติ/เผยแพร่จริงบนข้อมูลจริง **ไม่ได้ทำ** เพื่อเลี่ยงความเสี่ยงแก้ไข/เปลี่ยนสถานะ record จริงซ้ำอีก (มีเหตุลบ record โดยไม่ตั้งใจไปแล้วก่อนหน้านี้ในเซสชันนี้) — อาศัยผลจาก PHP regression test 18/18 ที่เรียก `final_publish_gate_check()` ตัวจริงโดยตรงแทน (ฟังก์ชันเดียวกับที่ endpoint publish/send-now/cron เรียกใช้) เป็นหลักฐานยืนยันแทนการคลิกจริง
