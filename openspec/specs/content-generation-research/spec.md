# content-generation-research Specification

## Purpose

กำหนดให้ Research เป็น Mandatory Internal Flow ของการสร้าง Content โดยระบบต้อง Reuse Research Data ที่ยังสด หรือ Fetch ใหม่เมื่อไม่มี/หมดอายุ และ AI ต้องใช้ Research Data จริงเป็น Context ในการสร้าง Content

## Requirements

### Requirement: Research is mandatory for content generation
`generate-article` SHALL ไม่สร้าง Content หากไม่มี Research Job ที่ผ่านการตรวจสอบและมี Research Brief ที่ใช้งานได้

#### Scenario: Content is generated through the normal UI
- **WHEN** ผู้ใช้กรอก Topic และกดสร้าง Content
- **THEN** ระบบต้องทำ Research Fetch/Reuse → Analyze → Generate โดยอัตโนมัติ
- **AND** ไม่มีตัวเลือกให้ผู้ใช้ปิด Research

#### Scenario: Direct generation bypass is attempted
- **WHEN** request เรียก `generate-article` โดยไม่มี `research_job_id`
- **THEN** ระบบสามารถ Reuse Research Job เดิมที่ตรง Topic และยังอยู่ใน TTL ได้
- **AND** หากไม่มี Research Data ที่ใช้งานได้ ระบบต้องไม่ Generate Content และคืน error

### Requirement: Every generation entry point runs the Research flow
ทุกจุดใน UI ที่สั่งสร้างเนื้อหาใน Phase 2 SHALL เรียกใช้ Mandatory Research flow เดียวกัน (Fetch/Reuse → Analyze → Generate) และ SHALL ไม่เรียก `generate-article` โดยตรงเพื่อ bypass Research

#### Scenario: Research is expired when the user presses generate
- **WHEN** ผู้ใช้กดสร้างเนื้อหาจากจุดใดก็ได้ใน Phase 2 และ Research เดิมหมดอายุ
- **THEN** ระบบ Fetch Research ใหม่ให้อัตโนมัติแล้วจึง Generate
- **AND** ผู้ใช้ไม่พบ error ที่ต้องแก้ด้วยการไป Fetch Research เองก่อน

#### Scenario: A generation entry point has no topic
- **WHEN** รายการที่จะสร้างไม่มี Topic/หัวข้อ
- **THEN** ระบบไม่เรียก `generate-article` และแจ้งผู้ใช้ว่าต้องมีหัวข้อก่อนเริ่ม Research

#### Scenario: Entry points are kept within Phase 2 scope
- **WHEN** ตรวจสอบ Generation Entry Point
- **THEN** ต้องครอบคลุม Normal Content Generation เช่น Quick Create, Content Planner, Card Dialog, Detail View และ Content List
- **AND** Batch/Video ไม่ถือเป็น acceptance scope ของ Phase 2 เว้นแต่มี requirement แยกกำหนดเพิ่มเติม

### Requirement: Existing valid Research Data is reused
Research Fetch SHALL ตรวจสอบ Research Data ของ tenant เดียวกันที่ตรงกับ provider, location, language และ normalized seed/topic และยังอยู่ใน TTL ก่อน Fetch ใหม่

#### Scenario: Matching Research is fresh
- **WHEN** มี Research Data ที่ตรง Topic และ `fetched_at` ยังอยู่ภายใน `research_cache_hours`
- **THEN** ระบบใช้ Research Job เดิม
- **AND** ไม่ Fetch provider ใหม่

### Requirement: Expired or missing Research is refreshed
ระบบ SHALL Fetch Research ใหม่เมื่อไม่มีข้อมูลที่ตรง Topic หรือข้อมูลเดิมหมดอายุ

#### Scenario: Research is expired
- **WHEN** Research Data เดิมเกิน TTL
- **THEN** ระบบ Fetch Research ใหม่
- **AND** ใช้ Research Job ใหม่ที่ Fetch สำเร็จในการ Generate Content

#### Scenario: No Research exists
- **WHEN** ไม่พบ Research Data ที่ตรง Topic
- **THEN** ระบบ Fetch Research ใหม่ก่อน Generate

### Requirement: Research Topic is the source of truth
ระบบ SHALL เก็บ Original User Topic ไว้ใน `content_items.source_topic` เป็น source of truth แบบคงที่ และ Research SHALL ใช้ค่านี้เป็น seed โดยไม่ใช้ `title`/`topic` ที่ AI rewrite หรือผู้ใช้แก้ไขภายหลังมาแทน

#### Scenario: User enters YouTube
- **WHEN** ผู้ใช้กรอก Topic `YouTube` และระบบสร้าง Content Item
- **THEN** ระบบบันทึก `content_items.source_topic = YouTube`
- **AND** Research Fetch ใช้ `source_topic` เป็น seed หลัง trim/normalize
- **AND** การแก้ไข `title`/`topic` ภายหลังต้องไม่เปลี่ยน `source_topic`
- **AND** ห้ามใช้ AI-rewritten topic แทน seed เดิม

### Requirement: Research brief must be usable before generation
Research Job ที่ใช้ Generate SHALL มีสถานะ `done`, มี `analysis` ที่ผ่าน validation และมี source data ที่ตรวจสอบย้อนหลังได้

#### Scenario: Research fetch succeeds but analysis is missing
- **WHEN** Job มี raw Research แต่ไม่มี valid analysis
- **THEN** ระบบต้อง Analyze ก่อน Generate

### Requirement: AI generation must consume Research
เมื่อสร้าง Content ระบบ SHALL ส่ง Research Brief, Research keywords และ source metadata ของ Job ที่ใช้จริงเข้า AI Generation Context ทุกครั้ง

#### Scenario: Content is generated from Research
- **WHEN** Research Job พร้อมใช้งาน
- **THEN** prompt ของ AI มี Research Brief และ selected/fallback Research keywords
- **AND** AI ไม่สามารถ Generate จาก Topic เพียงอย่างเดียวได้

### Requirement: Research primary keyword controls SEO metadata
เมื่อสร้าง Content จาก Research ระบบ SHALL ใช้ primary keyword ที่มาจาก Research เป็นหลักสำหรับ SEO title, slug, meta description, ย่อหน้าแรก และ headings และ SHALL ไม่สร้าง `meta_keywords` ที่ไม่มีแหล่งจาก Research

#### Scenario: SEO fields use Research keyword
- **WHEN** Research brief มี primary keyword และ Content Generation สำเร็จ
- **THEN** SEO fields ที่กำหนดมี primary keyword ตามกติกา
- **AND** `meta_keywords` มาจาก Research keywords เท่านั้น

### Requirement: Research fetch failure has a safe fallback
หาก Fetch ใหม่ล้มเหลว ระบบ SHALL ไม่ลบ Research Data เดิม และสามารถใช้ Research Data เดิมได้เมื่อยังอยู่ใน TTL และผ่าน validation

#### Scenario: Refresh fails with usable cached data
- **WHEN** Fetch ใหม่ล้มเหลวและมี Research Data เดิมที่ยังใช้ได้
- **THEN** ระบบสามารถใช้ข้อมูลเดิมเป็น fallback

#### Scenario: Refresh fails without usable research
- **WHEN** Fetch ใหม่ล้มเหลวและไม่มี Research Data ที่ใช้ได้
- **THEN** ระบบต้องหยุด Content Generation และแจ้ง error

### Requirement: Research linkage is persisted
เมื่อสร้าง Content จาก Research สำเร็จ ระบบ SHALL บันทึก `content_item_id` กลับไปยัง Research Job ของ tenant เดียวกัน โดยไม่ลบ source data เดิม

#### Scenario: Created content is linked to research
- **WHEN** Content Item ถูกสร้างจาก Research Job
- **THEN** Job ถูกอัปเดตด้วย `content_item_id` ของ Content นั้น
- **AND** raw source, fetched_at และ analysis ยังคงอยู่

### Requirement: Cached Research with existing analysis is not re-analyzed unnecessarily
เมื่อ Reuse Research Job ที่มี valid analysis อยู่แล้ว ระบบ SHALL ใช้ analysis เดิมโดยไม่เรียก Analyze AI ซ้ำ

#### Scenario: Cached job already has a brief
- **WHEN** Fetch endpoint คืน cached job ที่มี `analysis`
- **THEN** generation flow ข้าม Analyze และใช้ brief เดิม

### Requirement: Direct mode cannot bypass Research
Direct Mode SHALL เป็นเพียงรูปแบบการสร้าง Content และ SHALL ไม่เป็นช่องทาง bypass Mandatory Research

#### Scenario: Direct mode generation
- **WHEN** ผู้ใช้สร้าง Content ด้วย Direct Mode
- **THEN** ระบบยังต้องผ่าน Fetch/Reuse → Analyze → Generate
- **AND** Direct Mode ต้องไม่ส่ง weekly/day-of-week context ที่ไม่เกี่ยวข้องกับ Topic

### Requirement: Research settings are consistent with the mandatory flow
Research Settings SHALL ระบุ provider และ model ที่ใช้จริงอย่างชัดเจน และต้องไม่เปิด configuration ที่ทำให้ Normal Content Generation bypass Research

#### Scenario: AI Research provider is configured
- **WHEN** tenant เลือก provider `ai`
- **THEN** ระบบใช้ Research AI model ที่ผ่านการยืนยัน และ Writing AI ต้องแยกจาก Research AI ตามบทบาท

### Requirement: End-to-end Research flow is verifiable
ระบบ SHALL สามารถตรวจสอบ flow ตั้งแต่ Research Settings → Provider Test → FETCH → Cache → ANALYZE → Research Brief → Generate Content → SEO/AEO → Approval → Schedule/Publish โดยใช้ endpoint เดิม

#### Scenario: AI provider end-to-end succeeds
- **WHEN** tenant มี credential และ model ที่พร้อมใช้ และสร้าง Content ด้วย Research
- **THEN** Fetch สำเร็จ, Web Search มีหลักฐาน citation/URL ที่ตรวจสอบได้, Analyze สำเร็จ, Content ใช้ Research Brief จริง และ linkage ถูกบันทึก

#### Scenario: Cache behavior is verified
- **WHEN** fetch seed เดิมภายใน TTL โดยไม่ส่ง `force_refresh`
- **THEN** ระบบ reuse Job เดิม
- **AND** เมื่อส่ง `force_refresh=true` หรือข้อมูลหมดอายุ ระบบ Fetch ใหม่

#### Scenario: Failure behavior is verified
- **WHEN** provider timeout, HTTP error, malformed response หรือ credential ไม่พร้อม
- **THEN** ระบบไม่รายงาน Research เป็นสำเร็จปลอม
- **AND** หากไม่มี Research fallback ที่ใช้งานได้ ระบบต้องหยุด Generation

#### Scenario: Tenant isolation is verified
- **WHEN** ผู้ใช้ส่ง Research Job ที่เป็นของ tenant อื่น
- **THEN** API ปฏิเสธ request และไม่คืน Research data ของ tenant อื่น

### Requirement: Research is not an optional bypass
เอกสารและ UI ของ Phase 2 SHALL สอดคล้องกับสถาปัตยกรรมปัจจุบันที่ Research เป็น Mandatory และ SHALL ไม่อ้างว่า Content Generation แบบไม่ใช้ Research เป็น supported flow

#### Scenario: Documentation is checked
- **WHEN** ตรวจ Specification และ Test ของ Research
- **THEN** ต้องไม่มี acceptance criterion ที่ขัดกับ Mandatory Research เช่น "Content generation without research still works"
- **AND** Legacy/optional Research behavior ที่ไม่ใช่ architecture ปัจจุบันต้องถูกลบหรือระบุว่าอยู่นอก Phase 2

### Requirement: No separate content pipeline is introduced
Phase 2 SHALL ใช้ Content Generation Flow เดิม และ SHALL ไม่สร้าง route, menu, permission หรือหน้า wizard สำหรับ `/content-pipeline`

#### Scenario: No separate pipeline route is added
- **WHEN** ตรวจ source หลัง implement
- **THEN** ไม่พบ `ContentPipelinePage`, route `/content-pipeline`, menu item "สายการผลิตคอนเทนต์" หรือ permission `content_pipeline`
