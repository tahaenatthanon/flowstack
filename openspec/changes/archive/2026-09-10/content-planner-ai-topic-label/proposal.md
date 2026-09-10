## Why

`ContentPlannerAI.tsx` มีช่อง input เดียวที่ label ว่า "Trigger Command" แต่ในทางปฏิบัติ (หลังการแก้ไขใน `fix-content-plan-source-topic` และ `content-plan-prompt-topic-guard`) ค่าที่กรอกในช่องนี้ทำหน้าที่เป็น topic/theme ของแผนจริงๆ — กลายเป็น prompt topic fallback และ plan title เมื่อไม่มี `source_topic` แยก (ซึ่ง legacy Content Plan mode ไม่มีช่อง `source_topic` แยกอยู่แล้ว) label ปัจจุบันจึงไม่ตรงกับบทบาทจริงของ field นี้ ทำให้ผู้ใช้สับสนได้ว่าต้องพิมพ์ "คำสั่ง" หรือ "หัวข้อ"

## What Changes

- `ContentPlannerAI.tsx`: เปลี่ยน label ของช่อง input จาก "Trigger Command" เป็น "หัวข้อ/คำสั่งสำหรับแผน" และเพิ่ม helper text อธิบายว่า "AI จะคิดหัวข้อย่อยของแต่ละโพสต์เองจากคำสั่งนี้" ใต้ช่อง
- Placeholder คงเดิม (เช่น "แผนคอนเทนต์เดือนนี้" — อ่านเหมือนหัวข้ออยู่แล้ว ไม่ต้องแก้)
- ไม่มี **BREAKING** change — เป็นการแก้ copy/label ล้วนๆ ไม่แตะ state, request body, หรือ backend ใดๆ

## Capabilities

### New Capabilities

- `content-planner-ai-topic-label`: label และ helper text ของช่อง input หลักใน "AI สร้างแผน" panel ต้องสื่อสารบทบาทจริงของ field (หัวข้อ/ธีมของแผน ไม่ใช่แค่คำสั่ง) โดยไม่เปลี่ยนพฤติกรรมการสร้างแผนหรือ Research

### Modified Capabilities

(ไม่มี — ไม่มี capability เดิมที่ครอบคลุม UI copy ของไฟล์นี้มาก่อน และ change นี้ไม่เปลี่ยน requirement เชิงพฤติกรรมใดๆ ของ `content-generation-research` หรือ capability อื่น)

## Impact

- `src/components/content/dialogs/ContentPlannerAI.tsx` (ที่ถูกต้องคือ `src/components/content/ContentPlannerAI.tsx`) เท่านั้น — ไม่แตะ `brand-content.php`, ไม่แตะ request body ที่ส่งไป `generate-plan` (`trigger_command` ยังชื่อ/ค่าเดิมทุกประการในโค้ด แค่ label ที่ผู้ใช้เห็นเปลี่ยน)
- ไม่กระทบ Research behavior — `source_topic` ต่อ item ยังคงแช่แข็งจาก topic ที่ AI คิดเองต่อ item ตามที่ `fix-content-plan-source-topic` (Option B) กำหนดไว้ ไม่ใช่ shared topic เดียวกันทุก item
- ไม่กระทบ QuickCreateDialog.tsx, BatchGenerateDialog.tsx, หรือ backend ใดๆ
- ไม่ปิด gap เรื่อง `trigger_ids` multi-select ที่พบระหว่างสำรวจ (ContentPlannerAI ยังใช้ free-text "Quick Triggers" preset แทน trigger multi-select จริงแบบ QuickCreate/Batch) — เป็นงานคนละก้อน นอก scope
