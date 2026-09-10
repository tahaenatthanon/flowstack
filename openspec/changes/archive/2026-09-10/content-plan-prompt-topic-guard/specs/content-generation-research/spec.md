## ADDED Requirements

### Requirement: Generation prompt never carries an empty topic placeholder
ระบบ SHALL ไม่ส่งบรรทัด `Original User Topic/Seed (SOURCE OF TRUTH):` ที่มีค่าว่างเข้า AI generation prompt เมื่อสร้าง Content Plan item — หากไม่มีทั้ง Topic ที่ผู้ใช้พิมพ์เองและ Trigger Instruction ที่ใช้แทนได้ SHALL ตัดบรรทัดนั้นออกทั้งบรรทัดแทนการส่งค่าว่างหรือ placeholder ข้อความอื่น

#### Scenario: Legacy Content Plan has both a topic source and trigger instructions
- **WHEN** สร้าง Content Plan item แบบ non-direct และมี `source_topic` หรือ Trigger command อย่างน้อยหนึ่งค่าไม่ว่าง
- **THEN** prompt มีบรรทัด `Original User Topic/Seed (SOURCE OF TRUTH):` พร้อมค่าที่ resolve ได้ (ให้ความสำคัญกับ `source_topic` ก่อน ถ้าไม่มีจึงใช้ Trigger command ตัวแรกที่ไม่ว่าง)

#### Scenario: No topic and no trigger instruction are available
- **WHEN** สร้าง Content Plan item แบบ non-direct และทั้ง `source_topic`, `trigger_command`, `trigger_commands` ว่างสนิททุกแหล่ง (หลัง trim)
- **THEN** prompt ต้องไม่มีบรรทัด `Original User Topic/Seed (SOURCE OF TRUTH):` เลย ไม่ว่าจะเป็นค่าว่างหรือข้อความ placeholder อื่นใด
- **AND** บรรทัดอื่นของ prompt (Trigger Instructions ถ้ามี, สัปดาห์เริ่มต้น, วันที่, Platform, reminder) ยังคงพิมพ์ตามปกติ
