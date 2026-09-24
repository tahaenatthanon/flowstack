## Why

ตอนนี้แทบทุกเกณฑ์ SEO/AEO เป็นข้อบังคับ แบ่งเป็น SEO 14 จาก 15 ข้อ และ AEO ทั้ง 8 ข้อ นอกจากนี้ยังใช้คะแนน 80/70 ตัดสินผ่านด้วย ผลที่เกิดขึ้นมีสามเรื่อง
- ตอน generate ระบบให้ AI repair บทความใหม่ทั้งฉบับได้สูงสุด 4 รอบ บ่อยครั้งเพราะข้อที่เป็นแค่คำแนะนำ เช่น `content_gap` ไม่ผ่าน 8 จาก 10 บทความที่มี research ทำให้เปลือง credit แล้วก็ยังไม่ผ่าน
- ปุ่มตรวจใหม่กดได้ทั้งที่ยังไม่ได้บันทึก ผู้ใช้เลยเข้าใจว่าระบบตรวจสิ่งที่เพิ่งแก้
- Gate ตอนสร้าง ตอนส่งอนุมัติ และตอนเผยแพร่ ใช้เกณฑ์ไม่เหมือนกัน

## What Changes

- **เกณฑ์ข้อบังคับ/ข้อแนะนำ**
  - แบ่งทุกเกณฑ์เป็น **Required** (ไม่ผ่าน = บล็อก) และ **Recommended** (แนะนำเท่านั้น)
  - ค่า tier `optional` เปลี่ยนชื่อเป็น `recommended`
- **SEO Required 8 ข้อ**
  - `seo_title`: ไม่ว่าง และยาวไม่เกิน 60 ตัวอักษร
  - `meta_description`: ไม่ว่าง และยาวไม่เกิน 160 ตัวอักษร ถ้าสั้นกว่า 120 เป็นแค่คำแนะนำ
  - `slug`
  - `h1`
  - `content_length`: น้อยกว่า 300 คำถือว่าไม่ผ่าน ส่วน 300–499 คำเป็นคำแนะนำ
  - `primary_keyword_placement`: ต้องอยู่อย่างน้อย 1 ใน 3 ตำแหน่ง อยู่ครบ 3 ตำแหน่งเป็นคำแนะนำ
  - `keyword_stuffing`
  - `structured_data`
- **SEO Recommended:** `heading_structure`, `search_intent`, `related_keywords`, `topic_coverage`, `paa_questions`, `content_gap`, `internal_linking`
- **AEO Required:** `direct_answer` และ `structured_data` อีก 6 ข้อที่เหลือเป็น Recommended
- **BREAKING:** เลิกใช้เกณฑ์คะแนน 80/70 และ flag `critical` ในการตัดสินผ่าน ผลผ่านหรือไม่ผ่านขึ้นกับ Required ที่ `failed` อย่างเดียว ส่วน `needs_improvement` นับว่าผ่าน คะแนน 0–100 ยังคำนวณและแสดงเป็นข้อมูล
- **BREAKING:** เลิกใช้ `seo_gate_min_score` ในการตัดสินผล แต่ยังไม่ลบคอลัมน์
- **Quality Gate กลางตัวเดียว** ใช้ทั้งตอน Generate, ขออนุมัติ และเผยแพร่
  - `seo_gate_enabled` เป็นสวิตช์รวมระดับ tenant ตัวเดียว
  - ขออนุมัติและเผยแพร่ประเมินใหม่ทุกครั้งจากข้อมูลที่บันทึกล่าสุด ไม่ใช้ผลตรวจเก่าตัดสิน
- **วิดีโอ (`type=video`)** ไม่ผ่าน SEO/AEO gate และไม่มี SEO/AEO repair แต่ยังต้องผ่าน Approval/Publish ตามปกติ
- **AI Repair** เหลือ 1 รอบ รวม SEO+AEO ส่งไปแก้เฉพาะ Required ที่ `failed` ถ้ายังไม่ผ่านให้บันทึกเป็น `revision` พร้อมรายการข้อที่ต้องแก้ให้ผู้ใช้แก้เอง
- **ปุ่มตรวจ**
  - เหลือปุ่มเดียว **"ตรวจ SEO/AEO ใหม่"** ที่ footer ของ `ContentCardDialog`
  - ปุ่มถูกปิดเมื่อมีการแก้ไขที่ยังไม่บันทึก และแจ้งให้บันทึกก่อน
  - ถอดปุ่ม "ตรวจ SEO" ใน `ArticleEditor` แผงผลตรวจเหลือหน้าที่แสดงผลอย่างเดียว
- **การแสดงผล SEO/AEO** แยกกลุ่ม Required / Recommended พร้อมสถานะผ่าน/ไม่ผ่านของแต่ละข้อ ทั้งใน dialog และหน้าอนุมัติ

## Capabilities

### New Capabilities
- `quality-required-gate`: Quality Gate กลางที่ตัดสินจาก Required rule
  - ยกเว้นวิดีโอ
  - ใช้ร่วมกันที่ Generate, Approval และ Publish
  - `seo_gate_enabled` เป็นสวิตช์รวมระดับ tenant
  - ประเมินใหม่จากข้อมูลที่บันทึกล่าสุดทุกครั้ง
  - การแสดงผลแยก Required / Recommended

### Modified Capabilities
- `seo-quality-gate`
  - `seo_gate_status` ตัดสินจาก Required failed อย่างเดียว เลิกใช้คะแนนและ critical
  - tier `optional` เปลี่ยนเป็น `recommended`
  - Repair loop เหลือ 1 รอบ รวม SEO+AEO
- `content-seo-checklist`
  - เพดานแข็ง/ช่วงแนะนำของ `meta_description`, `content_length`, `primary_keyword_placement`
  - ย้าย tier ของ research rules
  - เกตตอนเผยแพร่ไม่ใช้ `seo_gate_min_score`
- `content-seo-generation`
  - Repair เฉพาะ Required failed 1 รอบ
  - `needs_improvement` ไม่กระตุ้นการสร้างใหม่
  - วิดีโอไม่ repair และไม่ถูก gate
  - "ตรวจ SEO ใหม่" รวมเป็นปุ่มเดียว
- `content-quality-recheck`
  - ปุ่มเปลี่ยนชื่อเป็น "ตรวจ SEO/AEO ใหม่" อยู่ที่ footer
  - ปิดเมื่อยังไม่บันทึก
  - ตรวจจากข้อมูลที่บันทึกล่าสุด

## Impact

- **Backend**
  - `api/lib/seo-checklist.php`: tier, เกณฑ์ meta/content/keyword, `seo_gate_status`, `seo_gate_check`
  - `api/lib/aeo-checklist.php`: tier, `aeo_gate_status`
  - `api/lib/publish-dispatch.php`: `content_quality_gate_check`, `final_publish_gate_check` เรียก gate กลาง
  - `api/approvals.php`
  - `api/brand-content.php`: repair loop, video, `quality-recheck`, `seo-checklist`
- **Frontend**
  - `src/components/content/ContentCardDialog.tsx`: ปุ่ม footer และการปิดเมื่อ dirty
  - `src/components/content/ArticleEditor.tsx`: ถอดปุ่ม และจัดกลุ่มผลตรวจ
  - `src/components/content/tabs/ContentApprovalTab.tsx`
  - `src/components/content/types.ts`: `SeoRuleTier`
  - `src/hooks/useContent.ts`
- **Tests:** `api/tests/seo-aeo-gate-test.php`, `publish-gate-test.php`, `seo-aeo-bugfix-A/B.test.php` และ Vitest ของ dialog/editor ที่เกี่ยวข้อง
- **DB:** ไม่มี migration คอลัมน์ `seo_gate_min_score` ยังอยู่แต่ไม่ถูกใช้ตัดสิน
- **Credit:** generate บทความเรียก AI ไม่เกิน 2 ครั้ง (สร้าง + repair 1 รอบ) จากเดิมสูงสุด 5 ครั้ง ส่วนวิดีโอไม่มี SEO/AEO repair เลย
