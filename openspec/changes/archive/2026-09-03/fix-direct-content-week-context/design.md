## Context

`QuickCreateDialog.tsx` มี `contentType`, `topic`, `selPlatforms`, `researchEnabled` อยู่แล้ว และ `handleCreate()` เรียก `POST /brand-content.php?action=generate-plan` พร้อม `week_start`, `platforms`, `type` และ `days: 1` จากนั้นจึงเรียก `generate-article` หรือ `useResearchRun` สำหรับ item แรก

ใน `api/brand-content.php?action=generate-plan` ปัจจุบัน `$planType` default เป็น `weekly`, `$maxDays` ถูกบังคับอย่างน้อย 1 วัน และมี `$allDayDefs` ที่เริ่มจาก `จันทร์` จากนั้น prompt ถูกสร้างเป็น `สัปดาห์เริ่มต้น: {$weekStart}` และ `สร้างโพสต์สำหรับวัน{$dayLabel}` ทุกครั้งที่ generate-plan ถูกเรียก ดังนั้น Direct Creation จึงได้รับ weekly/day context โดยไม่ตั้งใจ

`generate-article` โหลด `ci.title AS topic` และข้อมูล `day_label/day_order` แต่ใน prompt ของ `generate-article` ปัจจุบัน `itemCtx` ใช้หัวข้อ/แพลตฟอร์ม/แคปชั่นเป็นหลัก ดังนั้นข้อความ “เริ่มต้นสัปดาห์” ส่วนใหญ่ถูกสร้างตั้งแต่ `generate-plan` แล้วถูกเก็บเป็น `content_items.title/topic` ก่อนเข้าสู่ generate-article

## Goals / Non-Goals

**Goals:**
- แยก Direct Content Creation ออกจาก Content Plan ด้วย mode ที่ explicit
- Direct Creation สร้าง 1 item โดยไม่มี day/week context ใน prompt
- Original User Topic/Seed ต้องถูกส่งผ่านเป็นค่าต้นฉบับสำหรับ Research และ Generation
- Content Plan ต้องคงพฤติกรรม weekly/day เดิม
- ไม่เปลี่ยน SEO Checklist หรือ publish flow

**Non-Goals:**
- ไม่ลบระบบวันใน `content_plan_items`
- ไม่เปลี่ยนวิธีสร้าง Content Plan รายสัปดาห์/รายเดือน
- ไม่เปลี่ยน SEO rules หรือ SEO Quality Gate
- ไม่เพิ่ม database migration เพียงเพื่อเก็บ source topic หากมีวิธีส่งผ่าน request/context เดิมได้

## Decisions

### 1. ใช้ `generation_mode` แยก Direct กับ Plan

Frontend จะส่ง `generation_mode: 'direct'` จาก `QuickCreateDialog` ทุกครั้งที่เป็นการสร้าง content เดี่ยว ส่วน flow ของ Content Planner ไม่ต้องส่งค่าใหม่นี้และ backend จะคง default เป็น mode เดิม/plan เพื่อ backward compatibility

Backend จะตรวจ mode ก่อนสร้าง day context:
- `direct`: สร้าง 1 item และไม่สร้าง day/week prompt context
- mode อื่น/ไม่ระบุ: ใช้ logic เดิมของ Content Plan

ไม่ใช้ `days: 1` เป็นตัวบอกว่าเป็น Direct เพราะ `days` เป็นจำนวนรายการของ plan และเป็นต้นเหตุที่ทำให้สอง flow ปะปนกัน

### 2. Direct prompt ต้องไม่มี weekly/day metadata

ใน direct mode `userMsg` ควรประกอบด้วยเฉพาะข้อมูลที่เกี่ยวข้อง เช่น trigger/topic, platform constraint และข้อกำหนดที่จำเป็นต่อ content type โดยไม่ใส่:
- `สัปดาห์เริ่มต้น`
- `สร้างโพสต์สำหรับวัน...`
- `วันจันทร์`/วันอื่น ๆ
- ข้อความเชิง weekly planning

ผล JSON ของ direct mode สามารถใช้ `day_label=''`, `day_order=0` และ `scheduled_date=null` เป็น metadata ที่ไม่มีความหมายด้านเนื้อหา เพื่อคง schema/storage เดิม โดยไม่ส่งค่าเหล่านี้เข้า prompt

### 3. Preserve Original User Topic/Seed

`QuickCreateDialog` จะเก็บ `topic.trim()` เป็นค่า source เดิม และส่งให้ generate-plan อย่างชัดเจนใน field ที่เหมาะสม เช่น `source_topic`/`seed_keyword` ตาม contract ที่ backend รองรับ

Backend ต้องไม่ใช้ topic ที่ AI สร้างจาก plan เป็นตัวแทนของ user seed ใน Research flow โดยเฉพาะเมื่อ `researchEnabled=true`: `useResearchRun` ต้องเรียก fetch ด้วย Original User Topic/Seed

หาก `content_items.title` ถูก AI ปรับในขั้น plan เพื่อเป็น presentation title จะไม่ถือว่าค่านั้นเป็น source seed สำหรับ Research

### 4. Direct mode ไม่เปลี่ยน Content Plan

เมื่อ request มาจาก Content Planner และไม่มี `generation_mode=direct` ระบบยังคง:
- คำนวณ `$maxDays` จาก `days`
- สร้าง day definitions
- ส่ง `week_start` และ day context ให้ AI
- บันทึก `day_label`, `day_order`, `scheduled_date` ตามเดิม

### 5. AI Research ต้องใช้ source topic เดิม

เมื่อ Direct Creation เปิด Research ให้ flow เป็น:

`Original User Topic/Seed → fetch → analyze → generate-article(research_job_id)`

ไม่ใช้ generated plan topic เป็น seed ใหม่ และไม่เพิ่ม day/week context เข้า research seed

## Risks / Trade-offs

- **Schema เดิมของ plan item ต้องการ day fields** → ใช้ค่า neutral (`day_label=''`, `day_order=0`, `scheduled_date=null`) สำหรับ Direct แทนการเพิ่ม schema
- **Backend ถูกเรียกจาก client อื่นที่ไม่มี generation_mode** → default ยังคงเป็น Plan/legacy behavior เพื่อ backward compatibility
- **มี trigger command ที่ผู้ใช้เลือก** → trigger command ยังส่งตามเดิม แต่หาก trigger เองมีข้อความ “Content Plan สัปดาห์หน้า” ผู้ใช้เป็นผู้เลือก trigger นั้นเอง จึงไม่ควรลบความหมายจาก input ของผู้ใช้
- **Research hook อาจยังใช้ topic จาก item** → ต้องตรวจ/แก้ contract ของ `useResearchRun` ให้รับ source topic ที่ส่งจาก dialog โดยตรง และเพิ่ม regression test ว่า seed ไม่เปลี่ยน

## Verification

1. Direct Article: topic `YouTube`, Research OFF → AI prompt ไม่มี day/week context และ content โฟกัส YouTube
2. Direct Article: topic `YouTube`, Research ON → fetch ใช้ seed `YouTube` และ generate ใช้ research job เดิม
3. Direct Video → ไม่มี day/week context เช่นเดียวกับ Article
4. Content Planner weekly → ยังคงมี day context และสร้างตามวันเดิม
5. Content Planner monthly/quarterly/yearly → date instruction เดิมยังทำงาน
6. SEO evaluation/gate → behavior เดิม ไม่มี regression
