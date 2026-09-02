## Why

การเลือกหลาย Platform ในขั้นตอนสร้างคอนเทนต์ปัจจุบันทำให้ระบบสร้างคอนเทนต์แยกตาม platform (จำนวนวัน × จำนวน platform) ดังนั้นการกด "สร้าง" ครั้งเดียวจึงได้คอนเทนต์หลายรายการ แทนที่จะเป็น 1 รายการที่มีหลาย platform เป็นช่องทางเผยแพร่ และการเลือกประเภท Article/Video ในหน้าสร้างคอนเทนต์ไม่ถูกส่งไปยัง backend ทำให้ backend กำหนด `type='article'` แบบ hardcoded ไว้ทุกจุดเสมอ ผลคือเลือก "วิดีโอ" แล้ว AI ยังสร้างเป็นบทความ

## What Changes

- `generate-plan` สร้างคอนเทนต์ 1 รายการต่อ topic/generate โดยไม่คูณด้วยจำนวน platform ที่เลือก และเก็บรายการ platform เป็นช่องทางเผยแพร่แทนการสร้างรายการแยก (1 วันสามารถมีหลายรายการจากหลาย topic ได้)
- เพิ่มคอลัมน์เก็บรายการ platform ที่เลือก (หลายค่า) ไว้กับคอนเทนต์ พร้อมคง `platform` เดิมเป็นค่าแรกเพื่อความเข้ากันได้
- Frontend ส่ง `type` (article/video) ที่ผู้ใช้เลือกจริงในคำขอ `generate-plan` และ `plan-items`
- Backend บันทึก `type` จากค่าที่ได้รับ (ผ่านการตรวจค่า) แทนการ hardcode `'article'` ในทุกจุด INSERT
- `generate-article` ใช้ `type` ที่บันทึกจริงในการเลือก AI prompt flow (video vs article) อย่างถูกต้อง

## Capabilities

### New Capabilities

- `content-generation-single-item`: การ generate สร้างคอนเทนต์ 1 รายการต่อครั้ง และเก็บหลาย platform เป็นช่องทางเผยแพร่ ไม่สร้างคอนเทนต์แยกตาม platform
- `content-type-selection`: การเลือกประเภท Article/Video ถูกส่งจาก Frontend และบันทึกลง backend อย่างถูกต้อง เพื่อให้ AI Generation Flow เลือก prompt ตามประเภทที่ผู้ใช้เลือกจริง

### Modified Capabilities

ไม่มี

## Impact

- Backend: `api/brand-content.php` (`generate-plan`, `plan-items`, `generate-article`), `api/content-items.php`
- Frontend: `src/components/content/dialogs/QuickCreateDialog.tsx`, `src/pages/ContentPlannerPage.tsx`
- ข้อมูล: เพิ่มคอลัมน์ `platforms` (JSON) ให้ `content_items` ผ่าน migration ใหม่
- พฤติกรรมที่เปลี่ยน: เลือก N platform จะสร้าง 1 คอนเทนต์ (เดิมสร้าง N รายการ) และเลือกวิดีโอจะสร้างวิดีโอสคริปต์จริง
- ต้องตรวจ regression ของการสร้าง แก้ไข อนุมัติ ตั้งเวลา และเผยแพร่ทั้งบทความและวิดีโอ รวมถึง tenant isolation
