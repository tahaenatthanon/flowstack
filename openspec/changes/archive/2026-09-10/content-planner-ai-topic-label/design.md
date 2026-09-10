## Context

`ContentPlannerAI.tsx` มี input เดียว (state `triggerCmd`) label ว่า "Trigger Command" ที่ส่งเป็น `trigger_command` ไปยัง `generate-plan` เสมอ — ไม่มีช่อง `source_topic` แยกในไฟล์นี้เลย (ต่างจาก `QuickCreateDialog.tsx`/`BatchGenerateDialog.tsx` ที่มีทั้ง Topic input และ Trigger multi-select แยกกัน)

หลังการแก้ไขก่อนหน้านี้ (`fix-content-plan-source-topic`, `content-plan-prompt-topic-guard`) backend ใช้ `$triggerCommand` เป็น fallback ของทั้ง prompt topic (`$promptTopic`) และ plan title (`$planTitle`) เมื่อไม่มี `source_topic` — ซึ่งเป็นกรณีปกติของ flow นี้เสมอ (ไม่มีช่องให้กรอก `source_topic` เลย) field นี้จึงทำหน้าที่ topic/theme ในทางปฏิบัติ แม้ label จะบอกว่าเป็น "Trigger Command"

สำรวจแล้วยืนยันว่า **legacy Content Plan generation สร้างหลาย item ต่อแผน โดย AI คิดหัวข้อของแต่ละ item เองแตกต่างกัน** (ป้องกันไว้ด้วย `content_plan_item_source_topic()` — แต่ละ item แช่แข็ง topic ของตัวเอง ไม่ใช้ค่าเดียวกันซ้ำ) การเพิ่มช่อง "หัวข้อ" แยกแล้วผูกกับ `source_topic` ตรงๆ จะเปลี่ยน Research semantics ของ legacy mode ให้กลายเป็น shared-topic-ทุก-item เหมือน Direct mode — เป็นการเปลี่ยนพฤติกรรมที่ใหญ่กว่าที่ change นี้ตั้งใจทำ จึงเลือกไม่ทำ (ดู Non-Goals)

## Goals / Non-Goals

**Goals:**
- ผู้ใช้เห็น label และคำอธิบายที่สื่อสารบทบาทจริงของ field (หัวข้อ/ธีมของแผน) แทน "Trigger Command" ที่ทำให้เข้าใจผิดว่าต้องพิมพ์เป็นคำสั่ง
- ไม่เปลี่ยนพฤติกรรมการสร้างแผนหรือ Research ใดๆ ทั้งสิ้น

**Non-Goals:**
- ไม่เพิ่มช่อง "หัวข้อ" แยกจาก field เดิม (Option A ที่พิจารณาไว้ในขั้น explore แต่ไม่เลือก เพราะเปลี่ยน Research semantics)
- ไม่เปลี่ยน state variable name (`triggerCmd`), ไม่เปลี่ยน request field name (`trigger_command`) — ทั้งสองยังเป็นชื่อเดิมในโค้ด เปลี่ยนแค่สิ่งที่ผู้ใช้เห็น (label/helper text)
- ไม่แก้ gap เรื่อง `trigger_ids` multi-select ที่พบระหว่างสำรวจ (ContentPlannerAI ยังใช้ "Quick Triggers" แบบ text-fill preset ไม่ใช่ multi-select จริง) — เป็นงานคนละก้อน
- ไม่แตะ `QuickCreateDialog.tsx`, `BatchGenerateDialog.tsx`, หรือ backend ใดๆ

## Decisions

### 1. เปลี่ยนเฉพาะ label และเพิ่ม helper text — ไม่แตะ placeholder
Label เปลี่ยนจาก `"Trigger Command *"` เป็น `"หัวข้อ/คำสั่งสำหรับแผน *"` เพิ่ม helper text เล็กๆ (สีเทา, `text-[10px] text-muted-foreground`) ใต้ input: `"AI จะคิดหัวข้อย่อยของแต่ละโพสต์เองจากคำสั่งนี้"` — อธิบายพฤติกรรมจริงตรงๆ (AI แตกหัวข้อย่อยเอง ไม่ใช่ topic เดียวกันทุกโพสต์) แทนที่จะแค่เปลี่ยนชื่อเฉยๆ
Placeholder (`เช่น "แผนคอนเทนต์เดือนนี้"`) คงเดิม เพราะตัวอย่างที่มีอยู่แล้วอ่านเหมือนหัวข้อ/ธีมอยู่แล้วโดยธรรมชาติ ไม่จำเป็นต้องแก้

### 2. ไม่แตะ state/request field name
State `triggerCmd`/`setTriggerCmd` และ request field `trigger_command` คงชื่อเดิมในโค้ดทั้งหมด — เปลี่ยนแค่ JSX ที่ render ออกมาให้ผู้ใช้เห็น การเปลี่ยนชื่อตัวแปรภายในจะเพิ่มความเสี่ยง diff โดยไม่มีประโยชน์เพิ่ม (ไม่มีใครอ่านชื่อ state ยกเว้นตอน debug โค้ด)

## Risks / Trade-offs

- **[Risk]** Label ใหม่ยาวกว่าเดิม ("หัวข้อ/คำสั่งสำหรับแผน" ยาวกว่า "Trigger Command") อาจ wrap บรรทัดในพื้นที่แคบของ side panel (`w-80`) → **Mitigation**: ตรวจด้วยตาหลัง apply เสร็จผ่าน dev server จริง ถ้า wrap ไม่สวยให้ปรับ font-size/wording แทนที่จะย่อความหมาย
- **[Risk]** ผู้ใช้ที่คุ้นเคยกับคำว่า "Trigger Command" เดิมอาจสับสนชั่วคราวตอน label เปลี่ยน → **Mitigation**: เป็นการเปลี่ยน UI ครั้งเดียว ไม่กระทบข้อมูลหรือ workflow ที่มีอยู่ ความเสี่ยงต่ำ

## Migration Plan

ไม่มี — เป็นการแก้ copy/label ใน component เดียว ไม่มี state หรือ data ที่ต้อง migrate
