## Why

ปัจจุบัน `generate-article` สร้างเนื้อหาแล้วส่งผลให้ผู้ใช้ทันที โดยกฎ SEO ที่กำกับอยู่ใน prompt ของบทความถูก hardcode แยกจาก `seo_evaluate()` ใน `api/lib/seo-checklist.php` ทำให้ (1) prompt กับตัวประเมิน SEO ลอยไปจากกันได้ (drift) และ (2) ไม่มีการตรวจหลังสร้างว่ารายการที่สร้าง "ผ่าน" เกณฑ์ SEO Checklist ก่อนแสดงผล ผู้ใช้จึงได้เนื้อหาที่อาจติดกฎ `fail` (เช่น meta_description สั้น/ยาวเกิน, ไม่มี H2, จำนวนคำไม่ถึง 500, slug ผิดรูปแบบ) แล้วเพิ่งมารู้ทีหลังในแผง SEO/AEO

## What Changes

- **นำกฎจาก SEO Checklist มาเป็นเงื่อนไขในการสร้างเนื้อหา**: `generate-article` ใช้กฎชุดเดียวกับ `seo_evaluate()` (single source of truth) สร้างรายการข้อกำหนดภาษาไทยฉีดเข้า AI prompt แทนการ hardcode แยกชุด
- **ตรวจและสร้างใหม่จนผ่าน**: หลัง AI สร้างเนื้อหา ระบบเรียก `seo_evaluate()` กับรายการที่ได้ ถ้ามีกฎ `level = 'fail'` จะป้อน feedback (ข้อความภาษาไทยของกฎที่ติด) กลับไปสร้างใหม่ สูงสุด N ครั้ง จนไม่มี `fail` จึงส่งผลให้ผู้ใช้
- **แยก ruleset ตามชนิดที่ผู้ใช้เลือก**: ใช้ `content_items.type` (article/video) เลือกชุดกฎที่เกี่ยวข้อง เช่น วิดีโอไม่บังคับ H2 / word_count / internal_link แต่บังคับ hashtags
- **ไม่บล็อกด้วย pending/warn/skip**: เฉพาะ `fail` เท่านั้นที่กระตุ้นการสร้างใหม่ — `pending`, `warn`, `skip` ไม่ขัดขวางการแสดงผล (สอดคล้องกับเกตเผยแพร่เดิม)
- **คืนผลประเมินใน response**: `generate-article` คืน `seo` (`score` + `rules`) พร้อม `seo_passed` เพื่อให้ frontend แสดงสถานะ SEO ทันทีหลังสร้าง
- **เพดานการสร้างใหม่**: จำกัดจำนวนรอบสร้างใหม่ต่อคำขอ เพื่อไม่ให้เสีย token/เวลาเกินควร และคืนเนื้อหาที่ดีที่สุดพร้อม `seo_passed = false` เมื่อถึงเพดาน

## Capabilities

### New Capabilities
- `content-seo-generation`: การสร้างเนื้อหาผ่าน `generate-article` ต้องใช้กฎ SEO Checklist เป็นเงื่อนไข (single source of truth), ประเมินผลด้วย `seo_evaluate()` หลังสร้าง, สร้างใหม่พร้อม feedback จนไม่มีกฎ `fail` (ภายในเพดานที่กำหนด), และคืนผลประเมิน SEO ใน response

### Modified Capabilities
<!-- ไม่มีการเปลี่ยน requirement ใน spec ที่มีอยู่แล้ว -->

## Impact

- **Backend**: `api/brand-content.php` (`generate-article`), `api/lib/seo-checklist.php` (เพิ่ม helper สร้าง checklist/prompt จากชุดกฎเดียวกัน)
- **Frontend**: `src/components/content/views/ContentDetailView.tsx`, `src/components/content/ContentListTab.tsx`, `src/components/content/dialogs/QuickCreateDialog.tsx` (อ่าน/แสดง `seo` จาก response และ `seo_passed`; แผง SEO/AEO เดิมยังใช้ `?action=seo-checklist` ต่อ)
- **API response**: `generate-article` เพิ่มฟิลด์ `seo` และ `seo_passed` (additive — ไม่ทำลายผู้เรียกเดิม)
- **Cost/Latency**: การสร้างเนื้อหาอาจเรียก AI มากกว่า 1 รอบเฉพาะเมื่อมีกฎ `fail` (ถูกจำกัดด้วยเพดาน)
