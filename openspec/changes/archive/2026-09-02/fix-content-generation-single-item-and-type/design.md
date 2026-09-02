## Context

เส้นทางสร้างคอนเทนต์เริ่มจาก `generate-plan` ใน `api/brand-content.php` ซึ่งปัจจุบันเมื่อมี `platforms` จะวน loop `วัน × platform` แล้วเรียก AI ต่อคู่และสร้าง `content_plan_items` + `content_items` ต่อคู่ ทำให้เลือก 3 platform ได้ 3 คอนเทนต์ต่อวัน จากนั้น `generate-article` จะอ่าน `content_items.type` เพื่อเลือก prompt วิดีโอหรือบทความ แต่ค่า `type` ถูก hardcode เป็น `'article'` ในทุกจุด INSERT ทั้งใน `generate-plan`, `plan-items` (manual card) และ default ของ `content-items.php` ทำให้การเลือกวิดีโอใน `QuickCreateDialog` ไม่มีผล

Frontend `QuickCreateDialog` มี state `contentType` ('article' | 'video') และ `selPlatforms` (array) แล้ว แต่ `handleCreate` ส่งเฉพาะ `platforms` ไปยัง `generate-plan` โดยไม่ส่ง `type` ส่วน `ContentPlannerPage` (weekly/monthly) ไม่มีตัวเลือก type และควร default เป็น article

คอลัมน์ `content_items.platform` เป็น `varchar(100)` ค่าเดียว ไม่รองรับหลาย platform จึงต้องเพิ่มคอลัมน์ใหม่สำหรับเก็บรายการ

## Goals / Non-Goals

**Goals:**

- ให้การ generate 1 ครั้งสร้างคอนเทนต์ 1 รายการต่อวัน โดย platform เป็นช่องทางเผยแพร่ ไม่ใช่ตัวคูณจำนวนรายการ
- เก็บรายการ platform ที่เลือกไว้กับคอนเทนต์ พร้อมคง `platform` เดิมเป็นค่าแรก
- ให้ค่า `type` จากผู้ใช้ไหลจาก Frontend ไปบันทึกที่ Backend และมีผลต่อ AI prompt flow จริง
- รักษา compatibility ของฟีเจอร์เดิม (single platform, การเผยแพร่ตาม script)

**Non-Goals:**

- ไม่ผูก platform กับ `publish_channels` ที่มี credentials (การ map platform → channel จริงยังเป็นงานของ publish flow เดิม)
- ไม่ rewrite HTML ของคอนเทนต์ที่มีอยู่แล้ว
- ไม่แก้ schema ของ `content_plan_items` หรือสร้าง join table ใหม่
- ไม่เปลี่ยน UI ของ `ContentPlannerPage` (weekly/monthly) ให้เลือก type ใน change นี้

## Decisions

1. **เก็บรายการ platform ในคอลัมน์ JSON ใหม่ `content_items.platforms`**

   เพิ่มคอลัมน์ `platforms` (TEXT/JSON, nullable) เก็บ array ของ platform ที่เลือก คง `platform` เดิมเป็นค่าแรกเพื่อไม่ให้ query/feature เดิม (analytics-recalculate, list, publish) พัง การเลือก platform เดียวจะให้ทั้งสองคอลัมน์มีค่าเดียวกัน

   ทางเลือกที่พิจารณาแล้วไม่ใช้: join table `content_platforms` (เพิ่มความซับซ้อนโดยไม่จำเป็น เพราะ publish flow ใช้ `content_schedules` + `publish_channels` อยู่แล้ว) และ reuse `content_schedules` ตั้งแต่ generate (ต้องมี channel จริงซึ่งผู้ใช้ยังไม่ได้เลือก)

2. **`generate-plan` วน loop เฉพาะ `days` ไม่คูณ platform**

   ในโหมด multi-platform เดิมวน `days × platforms` เปลี่ยนเป็นวนเฉพาะ `days` และส่ง platform list เป็น "constraint" ให้ AI เลือก (เหมือนโหมดไม่มี platform แต่บังคับชุด platform) สร้าง `content_items` 1 รายการต่อ topic/generate พร้อม `platform` = ค่าแรก และ `platforms` = รายการเต็ม โดย 1 วันสามารถมีหลายรายการจากหลาย topic ได้ (loop ยังขับด้วย `days` ตาม granularity เดิม ไม่ได้จำกัดให้วันละ 1 รายการ)

3. **Backend อ่านและตรวจ `type` จาก body**

   เพิ่ม helper การ normalize type: รับ `$body['type']`, ลบช่องว่าง/ตัวพิมพ์เล็ก, ถ้าเป็น `video` → `video` มิฉะนั้น → `article` (ค่าไม่รู้จัก default เป็น article เพื่อไม่ให้ data เสีย) ใช้ค่านี้ในทุก INSERT แทน hardcode `'article'`

4. **Frontend ส่ง `type` และส่งรายการ platform ที่เลือก**

   `QuickCreateDialog.handleCreate` เพิ่ม `type: contentType` ใน body ของ `generate-plan` และส่ง `platforms: selPlatforms` ตามเดิม `plan-items` (manual card) รับ `type` จากฟอร์ม (ถ้ามี) และ default เป็น article

5. **`generate-article` ไม่ต้องเปลี่ยน logic หลัก**

   `generate-article` อ่าน `$item['type']` อยู่แล้ว (`$isVideo = strtolower(...) === 'video'`) เมื่อ type ถูกบันทึกถูกต้อง logic เลือก prompt จะทำงานถูกเอง จึงแก้เฉพาะจุด INSERT ที่ hardcode เพื่อให้ข้อมูลต้นทางถูกต้อง ไม่ rewrite prompt flow

## Risks / Trade-offs

- [คอลัมน์ `platform` เดิมยังเป็นค่าเดียว] → ใช้ `platforms` เป็น source of truth สำหรับรายการ และ `platform` เป็นค่าแรกเพื่อ back-compat; ฟีเจอร์ที่อ่าน `platform` เดียวจะเห็นค่าแรกซึ่งเป็นพฤติกรรมเดิมสำหรับ single-platform
- [AI อาจไม่เข้าใจ platform constraint หลายค่า] → เปลี่ยน prompt จาก "one platform per post" เป็น "list of target platforms" และยังเก็บผลจาก AI ที่เลือก platform เดียวเป็น fallback
- [ข้อมูลเก่าไม่มีค่า `platforms`] → ค่า nullable; พublish flow fallback ไป `platform` เมื่อ `platforms` ว่าง
- [การเปลี่ยน shared generate-plan กระทบ ContentPlannerPage] → วนเฉพาะวันเดิม จำนวนรายการลดลงแต่ content ยังครบตามวัน; ทดสอบทั้ง quick-create และ planner
- [type ที่ไม่รู้จักอาจทำ data เสีย] → normalize เป็น article อย่างชัดเจน ไม่เขียนค่าเปล่าเข้า enum

## Migration Plan

สร้าง migration เพิ่มคอลัมน์:

```sql
ALTER TABLE content_items
  ADD COLUMN platforms TEXT DEFAULT NULL COMMENT 'JSON array of selected publish platforms' AFTER platform;
```

Backfill ที่จำเป็น: ไม่ต้อง (ค่า nullable, publish flow fallback ไป `platform`) สำหรับแถวใหม่ `generate-plan` จะเขียน `platforms` เป็น JSON array เสมอ

Rollback: `ALTER TABLE content_items DROP COLUMN platforms;` แล้ว revert backend/frontend เป็น revision เดิม

## Open Questions

- ควรให้ `ContentPlannerPage` (weekly/monthly) มีตัวเลือก type ด้วยหรือไม่ → ตอนนี้ default article; แยกเป็น change ต่อถ้าต้องการ
