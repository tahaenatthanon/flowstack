## Why

Direct Content Generation ปัจจุบันสร้าง สร้าง SEO/AEO ซ้อนสองชั้น: หนึ่งชุดที่ระดับ Article/Core Content (ถูกต้องตาม design) และอีกชุดแยกต่างหากต่อ Platform Script (Facebook/TikTok/YouTube ฯลฯ) ผ่าน `script_quality_evaluate()` พร้อม repair loop และ Publish Gate ของตัวเอง ทำให้ Platform Script ถูกประเมิน/ซ่อม/บล็อกการเผยแพร่ด้วยเกณฑ์ SEO/AEO ที่ไม่จำเป็น เพิ่มความซับซ้อนของ generation pipeline โดยไม่มีประโยชน์เพิ่มต่อผู้ใช้ (Script ไม่ได้ถูกจัดอันดับค้นหาแยกจาก Article) และยังเสี่ยงบล็อกการเผยแพร่คอนเทนต์ที่ Article ผ่าน Quality แล้วแต่ Script ยังไม่ผ่านเกณฑ์ SEO/AEO ที่ไม่ตรงจุดประสงค์

## What Changes

- ลบ SCRIPT SEO/AEO generation instructions/schema ออกจาก prompt ของ `generate-article` (`api/brand-content.php`) — AI ยังต้องสร้าง Script ตาม Platform ที่เลือกและ Script Sections ตามเดิม แต่ไม่ต้องสร้าง SEO/AEO ให้ Script
- ลบ per-platform Script SEO/AEO evaluation + repair loop ออกจาก `generate-article` (`api/brand-content.php`)
- เลิกใช้ SEO/AEO scoring logic ใน `api/lib/script-quality-checklist.php` (`SCRIPT_SEO_WEIGHTS`, `SCRIPT_AEO_WEIGHTS`, `script_evaluate_seo()`, `script_evaluate_aeo()`, `script_quality_evaluate()`, `script_quality_publish_check()`, `script_quality_generation_requirements()`) — ย้าย `SCRIPT_PLATFORMS` (routing constant แยก web/script platform) ออกไปเก็บที่อื่นก่อน เพราะยังถูกใช้เพื่อแยกเส้นทาง publish ไม่เกี่ยวกับ SEO/AEO โดยตรง
- **BREAKING**: ลบ Script SEO/AEO ออกจาก Publish Gate ทุกเส้นทาง — `api/lib/publish-dispatch.php` (`content_quality_gate_check()`, `final_publish_gate_check()`), `api/content-publish.php` (`publish_script_gate()`), และ cron auto-publish path ใน `api/brand-content.php` — ผลคือการเผยแพร่ Platform Script จะไม่ถูกบล็อกด้วยคะแนน Script SEO/AEO อีกต่อไป (ยังคงต้องผ่าน Approval gate และ Article SEO/AEO gate สำหรับ web platform ตามเดิม)
- ลบ logic invalidate `script_quality` เมื่อแก้ไข content ใน `api/content-items.php` (กลายเป็น dead code เมื่อ field นี้เลิกสร้าง)
- ลบ UI แสดง Script SEO/AEO score, checklist และสถานะผ่าน/ไม่ผ่านออกจาก `ContentCardDialog.tsx` (`ScriptQualityPlatform`, `ScriptQualityChecklist`) โดยคง Script, Script Sections, ภาพประกอบ, Hashtags ไว้ครบ
- ปรับจำนวน ภาพประกอบ/Hashtags ในตัวอย่าง schema ของ prompt จากจำนวนตายตัว (เดิมเป็นตัวอย่าง 3 scene / 5 hashtag) ให้เป็นไปตามความเหมาะสมของเนื้อหา ไม่ผูกจำนวนตายตัว
- ปรับ/เขียน test ที่ยึดกับ behavior เดิมของ Script SEO/AEO ให้ตรงกับ behavior ใหม่: `src/__tests__/content/ContentCardDialogScripts.test.tsx`, `api/tests/publish-gate-test.php`, `api/tests/script-quality-gate-test.php`, `api/tests/entity-clarity-test.php`
- ไม่กระทบ Article/Core Content SEO/AEO (`api/lib/seo-checklist.php`, ArticleEditor SEO panel, ContentArticleView SEO section) — คงไว้ทั้งหมด

## Capabilities

### New Capabilities
- `direct-platform-script-generation`: กำหนดว่า Platform Script ภายใต้ Direct Content Generation ประกอบด้วย Script + Script Sections เท่านั้น (ไม่มี SEO/AEO ของตัวเอง) และไม่ถูกประเมิน/ซ่อม/บล็อกการเผยแพร่ด้วยเกณฑ์ SEO/AEO แยกต่อ platform — SEO/AEO ของ Content มีอยู่เพียงชุดเดียวที่ระดับ Article/Core Content

### Modified Capabilities
(ไม่มี — ไม่พบ requirement ใน `openspec/specs/` ที่ระบุพฤติกรรม Script SEO/AEO ไว้อย่างเป็นทางการมาก่อน การเปลี่ยนแปลงนี้จึงเป็นการเพิ่ม spec coverage ใหม่ให้พฤติกรรมที่มีอยู่ในโค้ดแต่ไม่เคยถูก spec ไว้ ไม่ใช่การแก้ requirement เดิม)

## Impact

- Backend: `api/brand-content.php`, `api/lib/script-quality-checklist.php`, `api/lib/publish-dispatch.php`, `api/content-publish.php`, `api/content-items.php`
- Frontend: `src/components/content/ContentCardDialog.tsx`
- Tests: `src/__tests__/content/ContentCardDialogScripts.test.tsx`, `api/tests/publish-gate-test.php`, `api/tests/script-quality-gate-test.php`, `api/tests/entity-clarity-test.php`
- Database: ไม่ต้องทำ migration — `script_quality` ไม่ใช่ column แยก แต่เป็น key ใน JSON blob ของ `article_content` เท่านั้น จะเลิกเขียน key นี้ไปเอง
- Publish behavior: Platform Script ที่คะแนน SEO/AEO ต่ำกว่าเกณฑ์เดิม (SEO/AEO ≥ 80) จะเผยแพร่ได้ทันทีที่ผ่าน Approval gate (และ Article SEO/AEO gate สำหรับ web platform) — เป็นการ "ปลดล็อก" ไม่ใช่ทำให้เข้มงวดขึ้น จึงไม่กระทบ regression เชิงบล็อกผู้ใช้
