# content-dashboard-social-placeholder Specification

## Purpose

กำหนด sub-tab "โซเชียล" ของแท็บ "วิเคราะห์" — การ์ด "Engagement รวม" แสดงข้อมูลจริงจาก Facebook/Instagram ส่วนการ์ดผู้ติดตาม/Reach/Rate ยังเป็น em dash พร้อม notice card ภาษาไทยอธิบายขอบเขต

## Requirements

### Requirement: แท็บโซเชียลแสดง stat card 4 ใบแบบ placeholder
sub-tab "โซเชียล" SHALL แสดง stat card 4 ใบ: "ผู้ติดตามรวม", "Engagement รวม", "Reach รวม", "Engagement Rate" โดยการ์ด "Engagement รวม" SHALL แสดงข้อมูลจริงจาก Facebook/Instagram (เมื่อมีข้อมูลจาก cron ซิงก์) พร้อม label ระบุขอบเขตแพลตฟอร์ม ส่วนการ์ด "ผู้ติดตามรวม", "Reach รวม", "Engagement Rate" ยังแสดงค่าเป็น em dash "—" (ไม่ใช่ 0) เพราะระบบยังไม่มีแหล่งข้อมูล followers/reach ในเฟสนี้

#### Scenario: แสดง stat card 4 ใบพร้อมโครงจริง
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** เห็น 4 stat card พร้อม label, ไอคอน และสีตาม stat-card pattern เดิมของหน้า

#### Scenario: Engagement รวม แสดงข้อมูลจริงเมื่อมี
- **WHEN** sub-tab "โซเชียล" ถูก render และ `content_items` มีค่า views/likes จาก cron ซิงก์
- **THEN** การ์ด "Engagement รวม" แสดงค่าจริง พร้อม label ระบุว่า "เฉพาะ Facebook/Instagram"

#### Scenario: การ์ดที่ไม่มีแหล่งข้อมูลยังเป็น em dash
- **WHEN** sub-tab "โซเชียล" ถูก render
- **THEN** การ์ด "ผู้ติดตามรวม", "Reach รวม", "Engagement Rate" แสดง "—" พร้อม hint "ยังไม่ได้เชื่อมต่อแหล่งข้อมูล"

#### Scenario: ไม่มี mock data
- **WHEN** sub-tab "โซเชียล" ถูก render
- **THEN** ไม่แสดงตัวเลขปลอมหรือ chart ที่มีข้อมูลปลอมใด ๆ

### Requirement: แท็บโซเชียลแสดง notice card
sub-tab "โซเชียล" SHALL แสดง notice card ที่อธิบายตรง ๆ ว่าเมตริก engagement ที่แสดงครอบคลุมเฉพาะ Facebook/Instagram ส่วนเมตริกกลุ่มผู้ติดตาม/Reach/Impressions ยังต้องเชื่อมต่อ API เพิ่มเติม (Facebook Graph / Instagram / TikTok) และจะเปิดใช้งานในเฟสถัดไป

#### Scenario: แสดง notice card อธิบายขอบเขต
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** ใต้ stat card แสดง notice card ภาษาไทยที่อธิบายว่าตัวเลข engagement ครอบคลุมเฉพาะ Facebook/Instagram และเมตริกผู้ติดตาม/Reach ยังไม่ได้เชื่อมต่อแหล่งข้อมูล
