## ADDED Requirements

### Requirement: Show reject reason in content card dialog
ระบบ SHALL แสดงเหตุผลที่ขอแก้ไข/ปฏิเสธ (`reject_reason`) ในกล่องแก้ไขเนื้อหา (`ContentCardDialog`) ที่เปิดจาก Tab "ผลงานทั้งหมด" เมื่อ content item มีสถานะ `revision` หรือ `rejected` และมี `reject_reason` ไม่ว่าง

#### Scenario: Show revision reason in content list
- **WHEN** ผู้ใช้เปิดกล่องแก้ไขเนื้อหาจาก Tab "ผลงานทั้งหมด" ของรายการที่มีสถานะ `revision` และ `reject_reason` ไม่ว่าง
- **THEN** ระบบแสดงแบนเนอร์พร้อมข้อความ "เหตุผลที่ขอแก้ไข" และเนื้อหาของ `reject_reason`

#### Scenario: Show rejection reason in content list
- **WHEN** ผู้ใช้เปิดกล่องแก้ไขเนื้อหาจาก Tab "ผลงานทั้งหมด" ของรายการที่มีสถานะ `rejected` และ `reject_reason` ไม่ว่าง
- **THEN** ระบบแสดงแบนเนอร์พร้อมข้อความ "เหตุผลที่ปฏิเสธ" และเนื้อหาของ `reject_reason`

#### Scenario: No reason banner when reason is empty
- **WHEN** ผู้ใช้เปิดกล่องแก้ไขเนื้อหาจาก Tab "ผลงานทั้งหมด" ของรายการที่มีสถานะ `revision` หรือ `rejected` แต่ `reject_reason` เป็นค่าว่างหรือ NULL
- **THEN** ระบบไม่แสดงแบนเนอร์เหตุผล

### Requirement: PlanItem carries reject reason
`PlanItem` type SHALL มี field `reject_reason?: string | null` และ `ContentListTab.asPlanItem` SHALL map ค่า `reject_reason` จาก `ContentItem` ไปยัง `PlanItem`

#### Scenario: PlanItem reject_reason mapped
- **WHEN** `ContentListTab` สร้าง `PlanItem` จาก `ContentItem` ที่มี `reject_reason`
- **THEN** `PlanItem.reject_reason` มีค่าเท่ากับ `ContentItem.reject_reason`

### Requirement: Show reject reason in content list row
ระบบ SHALL แสดงเหตุผลที่ขอแก้ไข/ปฏิเสธ (`reject_reason`) ในแถวรายการของ Tab "ผลงานทั้งหมด" (`ContentListTab`) ใต้ชื่อรายการโดยตรง เมื่อ content item มีสถานะ `revision` หรือ `rejected` และมี `reject_reason` ไม่ว่าง

#### Scenario: Show revision reason in row
- **WHEN** รายการใน Tab "ผลงานทั้งหมด" มีสถานะ `revision` และ `reject_reason` ไม่ว่าง
- **THEN** ระบบแสดงข้อความ "เหตุผลขอแก้ไข: <reject_reason>" ใต้ชื่อรายการโดยตรง

#### Scenario: Show rejection reason in row
- **WHEN** รายการใน Tab "ผลงานทั้งหมด" มีสถานะ `rejected` และ `reject_reason` ไม่ว่าง
- **THEN** ระบบแสดงข้อความ "เหตุผลปฏิเสธ: <reject_reason>" ใต้ชื่อรายการโดยตรง

#### Scenario: No reason text when reason is empty
- **WHEN** รายการมีสถานะ `revision` หรือ `rejected` แต่ `reject_reason` เป็นค่าว่างหรือ NULL
- **THEN** ระบบไม่แสดงข้อความเหตุผลใต้ชื่อรายการ

#### Scenario: Long reason is clamped
- **WHEN** `reject_reason` ยาวเกิน 2 บรรทัด
- **THEN** ข้อความถูกตัดด้วย `line-clamp-2` และแสดงเต็มเมื่อ hover (title attribute)
