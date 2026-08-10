## ADDED Requirements

### Requirement: Status filter tabs in content list

ระบบ SHALL แสดง Sub-tab สำหรับกรอง content items ตามสถานะ ภายในแท็บ "ผลงานทั้งหมด" (`ContentListTab`) โดยมีตัวเลือก: ทั้งหมด (`all`), ฉบับร่าง (`draft`), รอแก้ไข (`revision`), รอเผยแพร่ (`review`), เผยแพร่แล้ว (`published`)

#### Scenario: User filters by draft status

- **WHEN** ผู้ใช้คลิก Sub-tab "ฉบับร่าง"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'draft'`

#### Scenario: User filters by revision status

- **WHEN** ผู้ใช้คลิก Sub-tab "รอแก้ไข"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'revision'`

#### Scenario: User filters by review status

- **WHEN** ผู้ใช้คลิก Sub-tab "รอเผยแพร่"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'review'`

#### Scenario: User filters by published status

- **WHEN** ผู้ใช้คลิก Sub-tab "เผยแพร่แล้ว"
- **THEN** ระบบแสดงเฉพาะ content items ที่มี `status === 'published'`

#### Scenario: User selects "ทั้งหมด"

- **WHEN** ผู้ใช้คลิก Sub-tab "ทั้งหมด"
- **THEN** ระบบแสดง content items ทุกสถานะ

### Requirement: Status count display

แต่ละ Status Sub-tab SHALL แสดงจำนวน content items ของสถานะนั้น โดยนับจากข้อมูล content items ที่มีอยู่จริง

#### Scenario: Count reflects actual data

- **WHEN** มี content items สถานะ `draft` จำนวน 5 รายการ
- **THEN** Sub-tab "ฉบับร่าง" แสดงตัวเลขนับ `5`

#### Scenario: Count updates when data changes

- **WHEN** ข้อมูล content items ถูก invalidate และ refetch
- **THEN** จำนวนนับในแต่ละ Sub-tab อัปเดตตามข้อมูลใหม่

### Requirement: Status filter placement order

Status Sub-tab SHALL วางอยู่ระหว่าง Tab หลัก (ใน `ContentPage`) และ Type Filter (ใน `ContentListTab`) ตามลำดับ: Tab หลัก → Status Sub-tab → Type Filter → Platform Filter → Search → Content Cards

#### Scenario: Visual order on desktop

- **WHEN** ผู้ใช้เปิดหน้า "ผลงานคอนเทนต์" บน desktop
- **THEN** Status Sub-tab ปรากฏใต้ Tab หลัก และอยู่เหนือ Type Filter

#### Scenario: Visual order on mobile

- **WHEN** ผู้ใช้เปิดหน้า "ผลงานคอนเทนต์" บน mobile
- **THEN** Status Sub-tab ยังคงอยู่ใต้ Tab หลัก และอยู่เหนือ Type Filter โดย tab ที่เกินความกว้างจอจะขึ้นบรรทัดใหม่ (wrap) และทุก tab ยังคงกดได้

### Requirement: Status `revision` available in database

`content_items.status` ENUM SHALL include the value `'revision'` (รอแก้ไข) เพื่อรองรับการกรองใน Status Sub-tab

#### Scenario: Migration adds revision enum value

- **WHEN** database migration รันสำเร็จ
- **THEN** `content_items.status` รองรับค่า `'revision'`

### Requirement: Review status label updated

Label ของสถานะ `review` ใน `STATUS_MAP` SHALL เป็น "รอเผยแพร่" แทน "รออนุมัติ"

#### Scenario: Label appears in status filter

- **WHEN** ระบบแสดง Status Sub-tab
- **THEN** Sub-tab สำหรับสถานะ `review` แสดงข้อความ "รอเผยแพร่"

#### Scenario: Revision label appears in status filter

- **WHEN** ระบบแสดง Status Sub-tab
- **THEN** Sub-tab สำหรับสถานะ `revision` แสดงข้อความ "รอแก้ไข"

#### Scenario: Label appears in content cards

- **WHEN** ระบบแสดง content item card ที่มี `status === 'review'`
- **THEN** badge/card แสดงข้อความ "รอเผยแพร่"

### Requirement: Icon consistency with existing design system

ไอคอนของ Status Sub-tab SHALL ใช้รูปแบบเดียวกับ Type Filter เดิม ทั้งขนาด (`h-3.5 w-3.5`) Icon Style และระยะห่าง (`gap-1.5`)

#### Scenario: Icon sizing matches type filter

- **WHEN** ผู้ใช้ดู Status Sub-tab และ Type Filter พร้อมกัน
- **THEN** ไอคอนทั้งสองชุดมีขนาดเท่ากัน (`h-3.5 w-3.5`)

#### Scenario: Spacing matches type filter

- **WHEN** ผู้ใช้ดู Status Sub-tab และ Type Filter พร้อมกัน
- **THEN** ระยะห่างระหว่างไอคอนกับข้อความเท่ากัน (`gap-1.5`)

#### Scenario: Type filter "ทั้งหมด" has icon

- **WHEN** ผู้ใช้ดู Type Filter
- **THEN** ปุ่ม "ทั้งหมด" มีไอคอนเช่นเดียวกับปุ่ม "บทความ", "วีดีโอ", "รูปภาพ"
