# content-dashboard-stat-card-style Specification (delta)

## ADDED Requirements

### Requirement: Stat card border ตรงกับสีไอคอน
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL มีสีกรอบ (border) ตรงกับสีไอคอนของแต่ละ card เพื่อบ่งชี้สถานะได้ชัดเจนขึ้น

#### Scenario: สีกรอบตรงกับสีไอคอน
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card มี `border-{color}` ระดับเดียวกับสีไอคอน (เช่น เนื้อหาทั้งหมด = `border-blue-600`, เผยแพร่แล้ว = `border-green-600`, รออนุมัติ = `border-amber-600`, ฉบับร่าง = `border-gray-600`, ยอดวิวรวม = `border-cyan-600`, ยอดไลก์รวม = `border-pink-600`)

### Requirement: Stat card ใช้รูปแบบเดียวกับ Status Card ในหน้าโปรเจกต์
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL ใช้รูปแบบการตกแต่งเดียวกับ Status Card ในหน้าโปรเจกต์ (`src/components/StatCards.tsx`) โดยจัดวางหัวข้อด้านซ้าย, ไอคอนด้านขวา, และจำนวนด้านล่าง เพื่อให้ UI มีรูปแบบและสไตล์ที่สอดคล้องกัน

#### Scenario: หัวข้อซ้าย ไอคอนขวา จำนวนล่าง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card ใช้ pattern `stat-card card-hover` — หัวข้อ (label) อยู่ด้านซ้ายและไอคอนอยู่ด้านขวาในแถวเดียวกัน, จำนวน (count) แสดงอยู่ด้านล่าง — คง layout นี้เพื่อความสอดคล้องกับ UI ของระบบ
