## ข้อกำหนดที่เปลี่ยนชื่อ

### Requirement: Status filter tabs ในรายการเนื้อหา
จาก: status key `review`
เป็น: status key `pending_approval`

## ข้อกำหนดที่แก้ไข

### Requirement: Status filter tabs ในรายการเนื้อหา

ระบบ SHALL แสดง Sub-tab สำหรับกรอง content items ตามสถานะ ภายในแท็บ "ผลงานทั้งหมด" (`ContentListTab`) โดยมีตัวเลือก: ทั้งหมด (`all`), ฉบับร่าง (`draft`), รอแก้ไข (`revision`), รอเผยแพร่ (`approved`), เผยแพร่แล้ว (`published`)

#### Scenario: User filters by draft status

- **WHEN** ผู้ใช้คลิก Sub-tab "ฉบับร่าง"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'draft'`

#### Scenario: User filters by revision status

- **WHEN** ผู้ใช้คลิก Sub-tab "รอแก้ไข"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'revision'`

#### Scenario: User filters by approved status (รอเผยแพร่)

- **WHEN** ผู้ใช้คลิก Sub-tab "รอเผยแพร่"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'approved'`

#### Scenario: User filters by published status

- **WHEN** ผู้ใช้คลิก Sub-tab "เผยแพร่แล้ว"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'published'`

#### Scenario: User selects "ทั้งหมด"

- **WHEN** ผู้ใช้คลิก Sub-tab "ทั้งหมด"
- **THEN** ระบบแสดง content items ทุกสถานะ

### Requirement: Review status label updated

Label ของสถานะ `pending_approval` ใน `STATUS_MAP` SHALL เป็น "รออนุมัติ"

#### Scenario: Label appears in status filter

- **WHEN** ระบบแสดง Status Sub-tab
- **THEN** Sub-tab สำหรับสถานะ `pending_approval` ไม่แสดง (content page ใช้ `approved` สำหรับ tab "รอเผยแพร่" แทน)

### Requirement: Draft status label

Label ของสถานะ `draft` ใน `STATUS_MAP` SHALL เป็น "ฉบับร่าง" แทน "ร่าง"

#### Scenario: Draft label appears in status filter

- **WHEN** ระบบแสดง Status Sub-tab
- **THEN** Sub-tab สำหรับสถานะ `draft` แสดงข้อความ "ฉบับร่าง"
