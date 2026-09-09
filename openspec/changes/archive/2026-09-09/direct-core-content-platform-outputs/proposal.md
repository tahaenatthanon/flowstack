## Why

Direct Create ปัจจุบันผูก "Content Type" (Article/Video) เข้ากับทั้งสามเรื่องพร้อมกัน: (1) วิธีเขียน Core Article, (2) รายชื่อ Platform ที่เลือกได้ (`QuickCreateDialog` บังคับให้ Video เลือกได้แค่ TikTok/YouTube/Instagram/Custom และ Article เลือกได้แค่ Facebook/LinkedIn/Twitter/Instagram/LineOA/WordPress/Wix/Custom — สองกลุ่มนี้ไม่ overlap กับ Website/TikTok เลย) และ (3) ว่า platform ไหนจะได้ Script+Script Sections ตรวจโค้ดจริงพบว่าการผูกทั้งสามเรื่องเป็นแกนเดียวทำให้เกิดปัญหาที่ยืนยันแล้ว 3 จุด: (ก) เลือกได้แค่กลุ่ม platform เดียวต่อครั้ง — ทำให้สร้าง Content ที่มีทั้ง Website+Facebook+TikKok ในการรันเดียวไม่ได้เลยผ่าน Direct Create วันนี้ (ข) `script_sections` ถูกขอจาก AI และแสดงใน UI แบบไม่มีเงื่อนไข แม้ไม่มี platform วิดีโอใดถูกเลือก (ค) เมื่อ Content Type เป็น video, generate-article ไม่ขอ `full_html` จาก AI เลย ทำให้ Core Article fallback ไปใช้ script ของ Facebook เป็นเนื้อหาบทความ — ถ้าไม่ได้เลือก Facebook ด้วย Core Article จะไม่มีเนื้อหาเลยนอกจาก title/excerpt

## What Changes

- **BREAKING (UX)**: ปลดล็อกรายชื่อ platform ที่เลือกได้ใน `QuickCreateDialog` ให้เป็น list เดียวกันไม่ว่า Content Type จะเป็น Article หรือ Video (รวม `ARTICLE_PLATFORMS`/`VIDEO_PLATFORMS` เป็นชุดเดียว) — Content Type ยังคงเป็นตัวเลือกที่ผู้ใช้ตั้งเองเหมือนเดิม แต่เปลี่ยนหน้าที่จาก "กรอง platform ที่เลือกได้" เหลือแค่ "กำหนดวิธีเขียน Core Article" เท่านั้น
- เพิ่ม shared constant กำหนดว่า platform ใดต้องการ Script + Script Sections (TikTok, YouTube) แยกจาก platform ที่ต้องการแค่ Post/Caption (Facebook, Instagram, LinkedIn, Twitter, LineOA) และ platform ที่ใช้ Core Article ตรงๆ (Website: WordPress/Wix/Custom, Lotus Notes/Domino) — ใช้ constant เดียวกันทั้ง backend (`generate-article` เพื่อขอ/ไม่ขอ `script_sections` จาก AI) และ frontend (`ContentCardDialog` เพื่อแสดง/ซ่อนบล็อก Script Sections)
- เลิกผูก "จะขอ/แสดง Script Sections ไหม" กับ Content Type (`$isVideo`) — เปลี่ยนไปเช็คว่า platform ที่เลือกมี TikTok/YouTube หรือไม่แทน ไม่ว่า Content Type จะตั้งเป็นอะไร
- แก้ Core Article ให้มีเนื้อหาเสมอไม่ว่า Content Type จะเป็น Article หรือ Video — ให้ generate-article ขอ body/summary จาก AI สำหรับ video-type ด้วย (ไม่ใช่ปล่อยว่างแล้วพึ่ง AI ใส่ `full_html` มาเองแบบไม่รับประกัน) และเลิก fallback ไปใช้ `scripts['facebook']` เป็นเนื้อหา Core Article
- ไม่แตะ field/schema เดิม (`article_content.scripts`, `article_content.script_sections`, DB columns) — เปลี่ยนแค่ "เงื่อนไขว่าจะสร้าง/แสดงเมื่อไหร่" ไม่เปลี่ยนชื่อหรือโครงสร้าง field
- Batch (`BatchGenerateDialog`) ไม่ต้องแก้ UI ใดๆ — เลือก platform อิสระอยู่แล้วไม่ผูกกับ Content Type อยู่แล้ว จะได้ผลดีขึ้นโดยอัตโนมัติจากการแก้ backend ร่วมกัน (shared generation logic เดียวกัน)
- นอกสโคป (deferred ตามที่ตกลง): LinkedIn Post-vs-Article configuration — ไม่มี infrastructure รองรับอยู่แล้วในปัจจุบัน ไม่สร้างใหม่ในงานนี้ LinkedIn ยังคงได้ Post เหมือนเดิม

## Capabilities

### New Capabilities
- `core-content-platform-output-shape`: กำหนดว่า Core Article ต้องมีเนื้อหาเสมอไม่ว่า Content Type จะเป็นอะไร (ไม่พึ่งพา platform ใดโดยเฉพาะ) และ Platform Output shape (Script+Sections / Post-Caption / ใช้ Article ตรงๆ) ถูก derive จากชนิดของ platform ที่เลือก ไม่ใช่จาก Content Type และ Direct Create (QuickCreateDialog) ต้องเลือก platform ได้อิสระไม่ถูกจำกัดด้วย Content Type

### Modified Capabilities
- `content-type-selection`: แก้ scenario "type=video ใช้ video prompt" ที่เดิมระบุว่า generate-article "ไม่สร้าง full_html แบบบทความ" เมื่อ type=video — เปลี่ยนเป็นต้องสร้างเนื้อหา Core Article เสมอ (ผ่าน field ที่เหมาะสม เช่น full_html หรือ video summary ที่แปลงเป็น HTML ได้) ไม่ปล่อยว่างให้ fallback ไปพึ่ง script ของ platform ใดโดยเฉพาะ

## Impact

- Frontend: `src/components/content/dialogs/QuickCreateDialog.tsx` (รวม platform list, เอา `contentType`-based filter ออกจาก platform picker)
- Frontend: `src/components/content/ContentCardDialog.tsx` (เงื่อนไขแสดง "โครงสร้างบท (Script Sections)" ให้เช็ค platform วิดีโอที่เลือก แทนการเช็คแค่ `scriptSections` มีข้อมูลหรือไม่)
- Frontend: `src/components/content/types.ts` (เพิ่ม shared constant/util รายชื่อ platform ที่ต้องการ Script เช่น `VIDEO_SCRIPT_PLATFORMS`)
- Backend: `api/brand-content.php` (`generate-article`) — เปลี่ยนเงื่อนไขขอ `script_sections` จาก AI ให้อิงจาก platform ที่เลือกแทน `$isVideo`; แก้ prompt/schema ของ video branch ให้ขอเนื้อหา Core Article เสมอ; แก้ fallback `$fullHtml` ไม่ให้พึ่ง `scripts['facebook']`
- ไม่กระทบ Database schema — ไม่มี column/field ใหม่ ไม่มี migration
- ไม่กระทบ Batch UX — `BatchGenerateDialog.tsx` ไม่ต้องแก้ไฟล์ (ได้ผลลัพธ์ที่ถูกต้องขึ้นจาก backend fix โดยอัตโนมัติ เพราะใช้ generate-article ร่วมกัน)
- ไม่กระทบ LinkedIn dispatch (`api/lib/publish-dispatch.php`) — ไม่มีการเปลี่ยนแปลงในงานนี้
