## ADDED Requirements

### Requirement: Platform sub-tab ของ script แสดงเฉพาะ platform ที่มีจริง
ใน `ContentVideoView` sub-tab ที่ใช้เลือกดู script รายแพลตฟอร์ม SHALL แสดงเฉพาะ platform ที่มี key อยู่จริงใน `article_content.scripts` เท่านั้น — SHALL ไม่แสดงรายชื่อ platform ที่ hardcode ไว้ตายตัวโดยไม่เช็คว่ามี script อยู่จริงหรือไม่

#### Scenario: เลือกไว้ 2 platform เห็นแค่ 2 แท็บ
- **WHEN** content item มี `article_content.scripts` = `{"tiktok": "...", "facebook": "..."}` เท่านั้น (ไม่มี `youtube`, `instagram`)
- **THEN** `ContentVideoView` SHALL แสดง sub-tab แค่ `tiktok` และ `facebook`
- **AND** SHALL ไม่แสดง sub-tab ของ `youtube` หรือ `instagram`

#### Scenario: ไม่มี script เลยไม่มี sub-tab
- **WHEN** content item ไม่มี `article_content.scripts` หรือเป็น object ว่าง
- **THEN** `ContentVideoView` SHALL ไม่แสดง sub-tab ใดๆ ในส่วนนี้

#### Scenario: เพิ่ม platform ใหม่ภายหลังไม่ต้องแก้โค้ด
- **WHEN** `article_content.scripts` มี key ของ platform ที่ไม่เคยอยู่ในรายชื่อ hardcode เดิม (เช่น `linkedin`)
- **THEN** `ContentVideoView` SHALL แสดง sub-tab ของ platform นั้นด้วย โดยไม่ต้องแก้รายชื่อ platform ที่ hardcode ไว้ในโค้ด
