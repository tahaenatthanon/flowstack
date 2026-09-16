## ADDED Requirements

### Requirement: SEO and AEO scores persist on the content item after generation
ระบบ SHALL บันทึกคะแนน SEO (0–100, จาก `seo_evaluate()`) และคะแนน AEO (0–100, จาก AEO checklist) แยกกันคนละคอลัมน์ (`content_items.seo_score`, `content_items.aeo_score`) ทุกครั้งที่บันทึกเนื้อหาหลัง generate หรือ AI repair loop จบ (ค่าสุดท้ายหลัง retry เสร็จสิ้น ไม่ใช่ค่าระหว่างรอบ retry)

#### Scenario: Both scores saved after successful generation
- **WHEN** ระบบสร้างเนื้อหาสำเร็จและมีทั้งผล SEO evaluation และ AEO evaluation
- **THEN** ระบบบันทึกคะแนน SEO ลง `content_items.seo_score` และคะแนน AEO ลง `content_items.aeo_score` ของ content item ที่เกี่ยวข้อง แยกคอลัมน์กัน

#### Scenario: Scores saved even when gate fails after retry cap
- **WHEN** AI repair loop ทำครบ retry cap แล้ว gate status (SEO หรือ AEO) ยังไม่ `passed`
- **THEN** ระบบยังคงบันทึกคะแนนล่าสุดของทั้งสองระบบ (คะแนนที่ดีที่สุดที่ทำได้) ลงคอลัมน์ที่เกี่ยวข้อง

#### Scenario: Score columns are null before first generation
- **WHEN** content item ยังไม่เคยผ่านการ generate/evaluate เลย
- **THEN** `content_items.seo_score` และ `content_items.aeo_score` เป็น NULL ทั้งคู่

### Requirement: Approval detail view shows both persisted scores
ระบบ SHALL แสดงคะแนน SEO และคะแนน AEO (ตัวเลขแยกกัน 2 ค่า ไม่ต้อง breakdown รายข้อ) ในหน้ารายละเอียดคอนเทนต์ที่เปิดจากรายการอนุมัติ เมื่อค่านั้นๆ มีอยู่

#### Scenario: Both scores visible when reviewing content
- **WHEN** ผู้ใช้เปิดรายละเอียดคอนเทนต์จากหน้ารายการอนุมัติ และ content item มีทั้ง `seo_score` และ `aeo_score` ไม่เป็น NULL
- **THEN** ระบบแสดงตัวเลขคะแนนทั้งสองแยกกันในหน้ารายละเอียด

#### Scenario: Only one score shown when only one exists
- **WHEN** content item มีค่าใดค่าหนึ่งเป็น NULL (เช่น `seo_score` มีค่าแต่ `aeo_score` เป็น NULL)
- **THEN** ระบบแสดงเฉพาะคะแนนที่มีค่าจริง ไม่แสดง 0 หรือ placeholder แทนค่าที่เป็น NULL

#### Scenario: No score display when never evaluated
- **WHEN** ผู้ใช้เปิดรายละเอียดคอนเทนต์ที่ทั้ง `seo_score` และ `aeo_score` เป็น NULL
- **THEN** ระบบไม่แสดงตัวเลขคะแนนใดๆ
