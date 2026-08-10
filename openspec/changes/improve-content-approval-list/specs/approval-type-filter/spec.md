## ADDED Requirements

### Requirement: Approval list supports type filter for content type
ระบบ SHALL แสดง Type Filter Dropdown สำหรับกรองรายการตาม `content_type` โดยมีตัวเลือก: ทั้งหมด, บทความ (`article`), และวีดีโอ (`video`) — โดย Type Filter วางอยู่ด้านหน้าของ Platform Filter ใน toolbar

#### Scenario: Display type filter with options
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ระบบแสดง Type Filter Dropdown พร้อมตัวเลือก "ทั้งหมด", "บทความ", "วีดีโอ" และค่าเริ่มต้นเป็น "ทั้งหมด"

#### Scenario: Filter by article type
- **WHEN** ผู้ใช้เลือก "บทความ" จาก Type Filter
- **THEN** ตารางแสดงเฉพาะ content items ที่มี `content_type` เป็น `article`

#### Scenario: Filter by video type
- **WHEN** ผู้ใช้เลือก "วีดีโอ" จาก Type Filter
- **THEN** ตารางแสดงเฉพาะ content items ที่มี `content_type` เป็น `video`

#### Scenario: Type filter only shows used types
- **WHEN** ไม่มี content items ที่เป็น `video` ในระบบ
- **THEN** Type Filter แสดงเฉพาะ "ทั้งหมด" และ "บทความ" (ไม่แสดง "วีดีโอ")

#### Scenario: Type filter placed before platform filter
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ช่องค้นหาอยู่ด้านหน้าสุดของ toolbar ตามด้วย Type Filter และ Platform Filter ตามลำดับ: Search → Type → Platform → Sort

#### Scenario: Type filter respects active tab and search
- **WHEN** ผู้ใช้เลือก Tab "รออนุมัติ", Type Filter "บทความ", และพิมพ์คำค้นหา
- **THEN** ผลลัพธ์แสดงเฉพาะรายการที่สถานะ `review`, `content_type` เป็น `article`, และชื่อตรงกับคำค้นหา
