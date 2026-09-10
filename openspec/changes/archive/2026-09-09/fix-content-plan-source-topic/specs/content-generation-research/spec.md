## MODIFIED Requirements

### Requirement: Research Topic is the source of truth
ระบบ SHALL เก็บ Original Topic ไว้ใน `content_items.source_topic` เป็น source of truth แบบคงที่ต่อ item และ Research SHALL ใช้ค่านี้เป็น seed โดยไม่ใช้ `title`/`topic` ที่ AI rewrite หรือผู้ใช้แก้ไขภายหลังมาแทน — เมื่อผู้ใช้พิมพ์ Topic เอง (เช่น Direct mode) `source_topic` SHALL เป็นค่าที่ผู้ใช้พิมพ์ตรงตัว เมื่อไม่มี Topic ที่ผู้ใช้พิมพ์เอง (เช่น legacy Content Plan ที่ผู้ใช้ให้แค่ Trigger Instruction ระดับแผน และ AI เป็นผู้กำหนดหัวข้อของแต่ละ item เอง) `source_topic` SHALL เป็นค่า `topic` ที่ AI สร้างให้ item นั้นแช่แข็งไว้ ณ ตอนสร้าง item — ไม่ใช่ Trigger Instruction ระดับแผนที่ใช้ร่วมกันทุก item

#### Scenario: User enters YouTube
- **WHEN** ผู้ใช้กรอก Topic `YouTube` และระบบสร้าง Content Item
- **THEN** ระบบบันทึก `content_items.source_topic = YouTube`
- **AND** Research Fetch ใช้ `source_topic` เป็น seed หลัง trim/normalize
- **AND** การแก้ไข `title`/`topic` ภายหลังต้องไม่เปลี่ยน `source_topic`
- **AND** ห้ามใช้ AI-rewritten topic แทน seed เดิม

#### Scenario: Legacy Content Plan generates topic per item without an explicit user Topic
- **WHEN** ผู้ใช้สร้าง Content Plan ผ่าน Trigger Instruction เท่านั้น (ไม่มี Topic ที่พิมพ์เอง) และ AI สร้างหัวข้อของแต่ละ item เอง
- **THEN** ระบบบันทึก `content_items.source_topic` ของแต่ละ item เป็นค่า `topic` ที่ AI สร้างให้ item นั้นโดยเฉพาะ ณ ตอนสร้าง
- **AND** item ที่ต่างกันในแผนเดียวกันมี `source_topic` ต่างกันตามหัวข้อของตัวเอง ไม่ใช้ Trigger Instruction เดียวกันซ้ำทุก item
- **AND** การแก้ไข `title`/`topic` ของ item นั้นภายหลัง (รวมถึง regenerate) ต้องไม่เปลี่ยน `source_topic` ที่แช่แข็งไว้
