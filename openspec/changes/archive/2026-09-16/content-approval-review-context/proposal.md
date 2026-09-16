## Why

ผู้อนุมัติที่เปิดดู "รายละเอียดคอนเทนต์" จากหน้ารายการอนุมัติ (`/content-approval`) ตัดสินใจโดยไม่เห็นข้อมูล 2 อย่างที่ระบบมีอยู่แล้วบางส่วนแต่ไม่เคยเก็บ/ไม่เคยโชว์:

1. **คะแนน SEO และ AEO ที่เคยคำนวณไว้ตอนสร้างเนื้อหาหายไปทันที** — ระบบมี 2 ชุดประเมินแยกกัน (SEO checklist และ AEO checklist ตาม `ArticleEditor.tsx` ที่มีทั้ง `SeoChecklistPanel`/`AeoChecklistPanel`) คำนวณคะแนน 0-100 คนละค่าและคืนใน response ตอน generate แต่ตาราง `content_items` ไม่มีคอลัมน์เก็บคะแนนทั้งสองเลย (ยืนยันจาก `SHOW COLUMNS FROM content_items` — มีแค่ `seo_title` เป็น text) พอเนื้อหามาถึงมือผู้อนุมัติ ไม่มีทางรู้เลยว่าตอนสร้างสอบผ่านด้วยคะแนนเท่าไหร่
2. **ประวัติการขอแก้ไข/ปฏิเสธเก็บได้แค่รอบล่าสุดรอบเดียว** — คอลัมน์ `reject_reason` ใน `content_items` เป็น text เดี่ยวที่ถูกเขียนทับทุกครั้งที่มีการตัดสินใจใหม่ (`api/content-items.php` PUT status) ถ้าเนื้อหาถูกส่งกลับแก้หลายรอบ ผู้อนุมัติเห็นแค่เหตุผลของรอบล่าสุด ไม่เห็นว่ารอบก่อนๆ เคยติดอะไรมาบ้าง

การตัดสินใจเรื่องนี้เกิดจากบทสนทนาสำรวจ (`/opsx:explore`) เมื่อ 16 ก.ย. 2569 ที่ไล่โค้ดจริงยืนยันทั้งสองช่องว่างนี้

## What Changes

- เพิ่ม 2 คอลัมน์เก็บคะแนน SEO และ AEO ล่าสุดแยกกันบน `content_items` แล้วบันทึกค่าทุกครั้งที่ระบบประเมิน (ตอน generate/repair) — โชว์แค่ตัวเลขคะแนนทั้งสองในหน้ารายละเอียดอนุมัติ ไม่ต้อง breakdown รายข้อ (ตามที่ตกลงไว้)
- สร้างตารางใหม่เก็บประวัติการตัดสินใจอนุมัติแบบแยกรอบ (แต่ละรอบ = สถานะที่ตัดสิน + เหตุผล + เวลา) แทนการเขียนทับ `reject_reason` เดิม
- หน้ารายละเอียดอนุมัติ (`ContentDetailView` / `approval-detail-full-content`) แสดงประวัติทุกรอบเรียงตามลำดับเวลา แทนที่จะโชว์แค่รอบล่าสุด
- **ไม่รวมในรอบนี้ (ตามที่ตกลงไว้ระหว่างสำรวจ):** ไม่เพิ่มข้อมูลผู้สร้าง/ผู้ขออนุมัติ (รอคุยกับทีมก่อน) และไม่เปลี่ยนพฤติกรรม SEO metadata panel ที่พับเก็บอยู่แล้ว (ยังคงต้องกดเปิดเอง ไม่บังคับดู)

## Capabilities

### New Capabilities
- `content-aeo-score-persistence`: เก็บคะแนน SEO และ AEO (แยกกัน 2 ค่า) ที่คำนวณตอน generate ไว้ถาวรบน content item และแสดงผลในหน้ารายละเอียดอนุมัติ

### Modified Capabilities
- `approval-detail-full-content`: เปลี่ยน "Requirement: Detail view shows reject reason" จากแสดงเหตุผลรอบล่าสุดรอบเดียว เป็นแสดงประวัติทุกรอบของการขอแก้ไข/ปฏิเสธ

## Impact

- **Database**: migration เพิ่ม 2 คอลัมน์คะแนน (`seo_score`, `aeo_score`) บน `content_items` + ตารางใหม่ `content_approval_rounds` เก็บประวัติแต่ละรอบ
- **Backend**: `api/brand-content.php` (จุดคำนวณ/คืนคะแนน SEO ตอน generate) ต้อง persist คะแนนกลับไปที่ `content_items`; `api/content-items.php` (PUT status) ต้อง insert แถวใหม่ในตารางประวัติแทน/เพิ่มเติมจากการเขียนทับ `reject_reason` เดิม
- **Frontend**: `ContentDetailView.tsx` และ `ContentArticleView.tsx`/`ContentVideoView.tsx` (ส่วนแสดง reject reason banner) ต้องดึงและเรียงประวัติหลายรอบแทนช่องเดียว; เพิ่มจุดแสดงคะแนน AEO
- **Data migration ของ, reason เดิม**: แถวที่มี `reject_reason` เดิมอยู่แล้ว (ก่อน migration) ต้องคิดว่าจะย้ายเข้าตารางประวัติใหม่เป็นรอบแรกหรือปล่อยว่าง — ต้องตัดสินใจใน design.md
