## ADDED Requirements

### Requirement: analytics-recalculate จัดกลุ่มด้วย published_at
`analytics-recalculate` (`api/brand-content.php`) SHALL จัดกลุ่มข้อมูล "เวลาโพสต์ที่ดีที่สุด" ด้วย `published_at` (ไม่ใช่ `created_at`) เพราะกำลังหาเวลาที่ *โพสต์* แล้วได้ engagement ดี ไม่ใช่เวลาที่ *สร้างดราฟต์*

#### Scenario: จัดกลุ่มตามวัน/ชั่วโมงที่เผยแพร่จริง
- **WHEN** เรียก `?action=analytics-recalculate` เมื่อมีคอนเทนต์ `published` เพียงพอ
- **THEN** ผลลัพธ์ `content_posting_analytics` ใช้ `DAYOFWEEK(published_at)` และ `HOUR(published_at)` ในการจัดกลุ่ม

#### Scenario: คอนเทนต์ที่เผยแพร่ช้ากว่าสร้างไม่ถูกนับผิดกลุ่ม
- **GIVEN** คอนเทนต์สร้างตอน 09:00 แต่เผยแพร่จริงตอน 20:00
- **WHEN** เรียก `analytics-recalculate`
- **THEN** แถวของคอนเทนต์นั้นถูกนับในกลุ่มชั่วโมง 20 (จาก `published_at`) ไม่ใช่ 09 (จาก `created_at`)

### Requirement: เกต ≥10 published รายงานจำนวนที่ขาด
เมื่อเรียก `analytics-recalculate` แล้วคอนเทนต์ `published` ยังไม่ถึง 10 รายการ ระบบ SHALL ตอบด้วยข้อความที่ระบุจำนวนที่ยังขาด เพื่อให้ผู้ใช้รู้ว่าต้องเผยแพร่เพิ่มอีกกี่ชิ้น

#### Scenario: บอกจำนวนที่ขาด
- **GIVEN** มีคอนเทนต์ `published` 3 รายการ
- **WHEN** เรียก `analytics-recalculate`
- **THEN** ตอบ error ที่ระบุว่าขาดอีก 7 รายการ (ไม่ใช่แค่ "Need at least 10 published posts")
