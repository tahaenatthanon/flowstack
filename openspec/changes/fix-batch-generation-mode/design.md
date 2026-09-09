## Context

`BatchGenerateDialog` ถูกรีดีไซน์ (commit `97f39ae`) จาก "1 หัวข้อ → แผนคอนเทนต์รายสัปดาห์" ไปเป็น "N หัวข้อที่ผู้ใช้พิมพ์เอง → N ชิ้นเนื้อหาอิสระ" (แต่ละหัวข้อมี Niche/Trigger/Skill/Platform/Language/KB ของตัวเอง) แต่ตอน refactor ไม่ได้อัปเดตการเรียก `generate-plan` ให้ตรงกับโมเดลใหม่ — ยังคงส่ง `days`/`week_start` แบบเดิมโดยไม่ส่ง `generation_mode`

ผลคือ backend (`api/lib/content-plan-prompt.php`) ตีความทุก request จาก Batch เป็น legacy "plan mode" (`content_plan_item_count(false, days)` = สูงสุด 7) แทนที่จะเป็น "direct mode" (1 item เสมอ) ที่ `QuickCreateDialog` ใช้อยู่แล้วผ่าน `generation_mode=direct` — ฟีเจอร์นี้มีอยู่แล้วในระบบและมี spec (`content-generation-single-item`) รองรับ เพียงแต่ไม่ได้ครอบคลุมถึง Batch

ช่อง "จำนวนวัน"/"เริ่มวันที่" ในฟอร์ม Batch เป็นซากตกค้างจาก UI แบบเก่า — ปัจจุบัน dialog ส่งค่าไปเฉยๆ ไม่เคยอ่าน `scheduled_date`/`day_order`/`day_label` กลับมาแสดงผลอะไรเลย

## Goals / Non-Goals

**Goals:**
- 1 หัวข้อใน Batch = 1 content item เสมอ ไม่ว่าจะเลือก content type หรือมีกี่หัวข้อ (เหมือน Quick Create)
- แต่ละหัวข้อได้ `scheduled_date` ที่มีความหมาย เรียงลำดับต่อเนื่องกันจาก "เริ่มวันที่" ที่ผู้ใช้ตั้งครั้งเดียว โดยไม่ต้องเลือกจำนวนวันแยก
- ไม่แก้โค้ด backend — ใช้ endpoint ที่มีอยู่แล้ว (`generate-plan` ที่รองรับ `generation_mode=direct` อยู่แล้ว, `plan-item-date` ที่ใช้กับ drag/drop บนปฏิทินอยู่แล้ว)
- ไม่กระทบ `QuickCreateDialog` หรือ flow content-plan แบบเดิม (Content Planner ที่ยังต้องการ weekly/day context)

**Non-Goals:**
- ไม่รวมการแจ้งเตือน SEO/AEO/Script quality gate ที่ Batch ยังขาดอยู่ (แยกเป็นงานถัดไป)
- ไม่เปลี่ยน mechanism การ research/generate-article (ใช้ `useResearchRun` เดิมทุกอย่าง)
- ไม่เพิ่ม toggle ให้ผู้ใช้เลือกกลับไปใช้ weekly-plan mode แบบเดิมใน Batch (ตัดออกทั้งหมด)

## Decisions

### 1. ใช้ `plan-item-date` (endpoint เดิม) แทนการแก้ backend ให้ `generate-plan` รับ `scheduled_date` ตรงๆ

**ตัดสินใจ:** เรียก `PUT action=plan-item-date` เป็นขั้นตอนแยกหลัง `generate-plan` สำเร็จ

**ทางเลือกที่พิจารณา:** แก้ backend เพิ่ม optional `scheduled_date` param ใน `generate-plan` ให้ direct mode รับค่าตรงๆ (ลดเหลือ 1 call ต่อหัวข้อแทน 2 call)

**เหตุผลที่เลือกใช้ endpoint เดิม:**
- `plan-item-date` มีอยู่แล้ว ผ่านการทดสอบจริงจาก use case drag/drop บนปฏิทิน — ความเสี่ยงต่ำกว่าแก้ shared function (`content_plan_scheduled_date`) ที่ `generate-plan` ใช้ร่วมกับ `QuickCreateDialog` และ Content Planner
- `content_plan_scheduled_date($isDirect, ...)` ปัจจุบัน hardcode คืน `null` เมื่อ `$isDirect=true` โดยตั้งใจ (ตาม spec `content-generation-single-item` requirement "Direct metadata SHALL not become content instructions") — การแก้ให้รับ override จะทำให้ต้องพิสูจน์ใหม่ว่าไม่กระทบ Quick Create ซึ่งไม่มี concept ของวันที่เลย
- แลกกับ 1 API call เพิ่มต่อหัวข้อ (Batch เรียกหลาย call ต่อหัวข้ออยู่แล้ว: generate-plan → research → analyze → generate-article) ถือว่า overhead น้อยเทียบกับความเสี่ยง

### 2. ลำดับเรียก: ตั้งวันที่ก่อน Research (ไม่ใช่หลัง)

**ตัดสินใจ:** `generate-plan(direct)` → `plan-item-date` (best-effort) → `runResearch`

**ทางเลือกที่พิจารณา:** ตั้งวันที่หลัง research เสร็จ (เฉพาะ item ที่ generate สำเร็จเท่านั้นถึงจะขึ้นปฏิทิน)

**เหตุผลที่เลือกตั้งก่อน:**
- Batch loop มี failure mode ที่ research/generate ล้มเหลวได้บ่อย (`topicHadError` → status `partial`) อยู่แล้วเป็นปกติ ถ้าตั้งวันที่หลัง research แล้ว research fail พอดี item จะกลายเป็น draft ที่ไม่มี `scheduled_date` เลย = หายไปจากปฏิทิน หาไม่เจอ ต้องไปไล่ดูใน Content list เอง
- ตั้งก่อนทำให้ item ปรากฏบนปฏิทินตรงตำแหน่งที่ควรจะเป็นเสมอ แม้เนื้อหาจะยังไม่สมบูรณ์ (`revision`/`partial`) — ผู้ใช้เห็นและแก้ต่อได้ทันที ไม่ใช่ของหาย

### 3. ตัดช่อง "จำนวนวัน" ออกทั้งหมด แทนที่จะเปลี่ยนความหมาย

**ตัดสินใจ:** ลบ Select "จำนวนวัน" (`days`/`daysNum`/`setDays`) ออกจาก state และ UI ทั้งหมด

**ทางเลือกที่พิจารณา:** เปลี่ยนความหมายเป็น "ระยะห่างระหว่างหัวข้อ (วัน)" ให้ผู้ใช้ตั้งเว้นช่วงเองได้ (เช่น ทุก 2 วัน/หัวข้อ)

**เหตุผลที่เลือกลบทิ้ง:** ผู้ใช้ยืนยันชัดเจนว่า "จำนวนวันที่ใช้ = จำนวนหัวข้อ" — ไม่มี use case ที่ต้องการเว้นระยะเองในตอนนี้ การเก็บ field ที่ไม่ใช้ไว้จะทำให้งงเหมือนปัญหาเดิม ถ้าอนาคตต้องการ spacing แบบกำหนดเองค่อยเพิ่มเป็นฟีเจอร์ใหม่แยก

### 4. การตั้งวันที่ล้มเหลว = non-fatal ต่อหัวข้อนั้น

**ตัดสินใจ:** wrap การเรียก `plan-item-date` ด้วย try/catch แยกจาก research — ถ้า fail ไม่ throw ต่อ ให้ topic ไปต่อที่ขั้น research ตามปกติ ไม่ถูกนับเป็น `failed`

**เหตุผล:** สอดคล้องกับ pattern ที่มีอยู่แล้วสำหรับ research failure (`topicHadError` → `partial` ไม่ใช่ `failed`) — ความล้มเหลวของ metadata ที่ไม่ใช่เนื้อหาหลัก ไม่ควรทำให้ทั้ง topic ถูกทิ้ง

## Risks / Trade-offs

- **[Risk]** เพิ่ม 1 API call ต่อหัวข้อ (network overhead, latency เพิ่มขึ้นเล็กน้อยต่อหัวข้อ) → **Mitigation**: เรียกแบบ fire-and-await ปกติในลูปเดิม ไม่ block การทำงานคู่ขนาน เพราะ Batch loop เป็น sequential อยู่แล้ว
- **[Risk]** ถ้า `plan-item-date` fail แล้วผู้ใช้ไม่รู้ว่า item ไหนไม่มีวันที่ (silent partial failure) → **Mitigation**: ไม่ throw แต่ยังนับเป็นส่วนหนึ่งของ error tracking ที่มีอยู่ (เพิ่มเข้า `errors[]` แสดงใน toast สรุปท้ายสุดว่ามีกี่หัวข้อที่ตั้งวันที่ไม่สำเร็จ โดยไม่เปลี่ยน topic status เป็น `failed`)
- **[Risk]** ผู้ใช้ที่คุ้นเคยกับช่อง "จำนวนวัน" เดิมอาจสับสนว่าหายไปไหน (แม้จะเป็น field ที่ไม่เคยทำงานถูกต้องอยู่แล้ว) → **Mitigation**: ไม่ต้องทำอะไรเพิ่ม เพราะพฤติกรรมเดิม (ระเบิดเป็น 7 items) เป็นบั๊กที่ไม่มีใครตั้งใจพึ่งพา

## Migration Plan

- ไม่มี schema/data migration — ใช้ endpoint และคอลัมน์ที่มีอยู่แล้วทั้งหมด
- Deploy เป็น frontend-only change ใน `BatchGenerateDialog.tsx` — ปลอดภัยต่อการ rollback (revert ไฟล์เดียว)
- ไม่มี feature flag — เปลี่ยนพฤติกรรม default ทันทีเพราะพฤติกรรมเดิมคือบั๊ก ไม่ใช่ฟีเจอร์ที่ตั้งใจ

## Open Questions

- ไม่มี — ประเด็นเปิดทั้งหมดจากขั้น explore ถูกตัดสินใจแล้ว (ดู Decisions ด้านบน)
