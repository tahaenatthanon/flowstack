## ADDED Requirements

### Requirement: แท็บเว็บไซต์แสดง stat card 4 ใบแบบ placeholder
sub-tab "เว็บไซต์" SHALL แสดง stat card 4 ใบ: "Traffic รวม", "ผู้เข้าชม", "Page Views", "Conversion Rate" โดยทุกใบแสดงค่าเป็น em dash "—" (ไม่ใช่ 0)

#### Scenario: แสดง stat card 4 ใบพร้อมโครงจริง
- **WHEN** ผู้ใช้เปิด sub-tab "เว็บไซต์"
- **THEN** เห็น 4 stat card พร้อม label, ไอคอน และสีตาม stat-card pattern เดิมของหน้า

#### Scenario: ค่าแสดง em dash
- **WHEN** sub-tab "เว็บไซต์" ถูก render
- **THEN** ค่าของ stat card ทั้ง 4 ใบแสดง "—" พร้อม hint "ยังไม่ได้เชื่อมต่อแหล่งข้อมูล"

#### Scenario: ไม่มี mock data
- **WHEN** sub-tab "เว็บไซต์" ถูก render
- **THEN** ไม่แสดงตัวเลขปลอมหรือ chart ที่มีข้อมูลปลอมใด ๆ

### Requirement: แท็บเว็บไซต์แสดง notice card
sub-tab "เว็บไซต์" SHALL แสดง notice card ที่อธิบายตรง ๆ ว่าต้องเชื่อม Google Analytics 4 / Search Console และระบบยังไม่มี integration นี้

#### Scenario: แสดง notice card อธิบาย
- **WHEN** ผู้ใช้เปิด sub-tab "เว็บไซต์"
- **THEN** ใต้ stat card แสดง notice card ภาษาไทยที่อธิบายว่าต้องเชื่อม Google Analytics 4 / Search Console และระบบยังไม่มี integration นี้
