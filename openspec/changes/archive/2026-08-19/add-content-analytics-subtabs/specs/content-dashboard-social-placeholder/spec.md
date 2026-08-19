## ADDED Requirements

### Requirement: แท็บโซเชียลแสดง stat card 4 ใบแบบ placeholder
sub-tab "โซเชียล" SHALL แสดง stat card 4 ใบ: "ผู้ติดตามรวม", "Engagement รวม", "Reach รวม", "Engagement Rate" โดยทุกใบแสดงค่าเป็น em dash "—" (ไม่ใช่ 0)

#### Scenario: แสดง stat card 4 ใบพร้อมโครงจริง
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** เห็น 4 stat card พร้อม label, ไอคอน และสีตาม stat-card pattern เดิมของหน้า

#### Scenario: ค่าแสดง em dash
- **WHEN** sub-tab "โซเชียล" ถูก render
- **THEN** ค่าของ stat card ทั้ง 4 ใบแสดง "—" พร้อม hint "ยังไม่ได้เชื่อมต่อแหล่งข้อมูล"

#### Scenario: ไม่มี mock data
- **WHEN** sub-tab "โซเชียล" ถูก render
- **THEN** ไม่แสดงตัวเลขปลอมหรือ chart ที่มีข้อมูลปลอมใด ๆ

### Requirement: แท็บโซเชียลแสดง notice card
sub-tab "โซเชียล" SHALL แสดง notice card ที่อธิบายตรง ๆ ว่าเมตริกกลุ่มนี้ต้องเชื่อมต่อ API ของแพลตฟอร์ม (Facebook Graph / Instagram / TikTok) หรือกรอกข้อมูลย้อนหลัง ระบบยังไม่มีตารางเก็บ followers/reach/impressions และจะเปิดใช้งานในเฟสถัดไป

#### Scenario: แสดง notice card อธิบาย
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** ใต้ stat card แสดง notice card ภาษาไทยที่อธิบายว่าเมตริกนี้ยังไม่ได้เชื่อมต่อแหล่งข้อมูล และจะเปิดในเฟสถัดไป
