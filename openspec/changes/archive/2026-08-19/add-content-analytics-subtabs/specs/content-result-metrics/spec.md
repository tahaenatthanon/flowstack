## MODIFIED Requirements

### Requirement: คำนวณเวลาผลิตเฉลี่ยจาก approved_at
ระบบ SHALL มี endpoint ที่คืนค่าเวลาผลิตเฉลี่ย (lead time) คำนวณจากระยะเวลาระหว่าง `created_at` และ `approved_at` ของรายการ `content_items` ที่มี `approved_at` ไม่เป็น NULL และ respect ช่วงวันที่ `from`/`to` เมื่อถูกส่งมา (กรองด้วย `created_at` หรือ `approved_at` ตามความหมายของเมตริก)

#### Scenario: มีรายการที่อนุมัติแล้ว
- **WHEN** มี `content_items` อย่างน้อย 1 รายการที่มี `approved_at` ไม่เป็น NULL และเรียก endpoint เมตริกผลลัพธ์
- **THEN** response มี `avg_production_hours` เป็นค่าจำนวนชั่วโมงเฉลี่ยของ `TIMESTAMPDIFF(HOUR, created_at, approved_at)` จากทุกรายการที่อนุมัติแล้ว

#### Scenario: ยังไม่มีรายการที่อนุมัติ
- **WHEN** ไม่มี `content_items` ใดที่มี `approved_at` ไม่เป็น NULL
- **THEN** response มี `avg_production_hours` เป็น `null` และ `approved_count` เป็น `0`

#### Scenario: respect ช่วงวันที่
- **WHEN** เรียก endpoint เมตริกผลลัพธ์พร้อม `from`/`to`
- **THEN** ค่า `avg_production_hours` คำนวณเฉพาะรายการที่ timestamp อยู่ในช่วงวันที่นั้น

### Requirement: คำนวณความถี่การเผยแพร่จาก published_at
ระบบ SHALL คืนค่าความถี่การเผยแพร่เป็นจำนวนโพสต์ที่เผยแพร่ในช่วง 7 วันล่าสุด โดยนับจากคอลัมน์ `published_at` ของ `content_items` (เป็น snapshot ไม่ผูกช่วงวันที่ from/to)

#### Scenario: นับโพสต์ในช่วง 7 วันล่าสุด
- **WHEN** เรียก endpoint เมตริกผลลัพธ์
- **THEN** response มี `posts_last_7_days` เป็นจำนวนรายการ `content_items` ที่ `published_at` อยู่ในช่วง 7 วันล่าสุด (นับจากเวลาปัจจุบัน)

#### Scenario: ไม่มีโพสต์ที่เผยแพร่
- **WHEN** ไม่มี `content_items` ใดที่มี `published_at` ไม่เป็น NULL
- **THEN** response มี `posts_last_7_days` เป็น `0` และ `published_count` เป็น `0`

### Requirement: แสดง widget ประสิทธิภาพการผลิตบน sub-tab เนื้อหา
sub-tab "เนื้อหา" ของแท็บ "วิเคราะห์" SHALL แสดง widget "ประสิทธิภาพการผลิต" ที่รวมเมตริกเดิม 2 ตัวคือ "เวลาผลิตเฉลี่ย" (จาก `avg_production_hours`) และ "ความถี่การโพสต์/สัปดาห์" (จาก `posts_last_7_days` เทียบกับ `weekly_posts_target`) โดยคงตัวเลขและ hint เดิมทุกอย่าง ห้ามลบเมตริกนี้ออกจากหน้า

#### Scenario: แสดงเวลาผลิตเฉลี่ยใน widget
- **WHEN** sub-tab "เนื้อหา" โหลดและเรียก endpoint เมตริกผลลัพธ์สำเร็จ
- **THEN** widget "ประสิทธิภาพการผลิต" แสดงค่า "เวลาผลิตเฉลี่ย" จาก `avg_production_hours` (หรือข้อความ "ยังไม่มีข้อมูล" เมื่อเป็น `null`) พร้อม hint เดิม

#### Scenario: แสดงความถี่เทียบเป้าหมายใน widget
- **WHEN** sub-tab "เนื้อหา" โหลดและเรียก endpoint เมตริกผลลัพธ์สำเร็จ
- **THEN** widget "ประสิทธิภาพการผลิต" แสดงค่า "ความถี่การโพสต์/สัปดาห์" จาก `posts_last_7_days` และเปรียบเทียบกับ `weekly_posts_target` (แสดงสถานะ "ยังไม่ได้ตั้งเป้าหมาย" เมื่อเป้าหมายเป็น `0`) พร้อม hint เดิม

#### Scenario: ความถี่การโพสต์เป็น snapshot ไม่ผูกช่วงวันที่
- **WHEN** widget "ประสิทธิภาพการผลิต" ถูก render
- **THEN** ส่วน "ความถี่การโพสต์/สัปดาห์" มี label "ไม่ผูกช่วงวันที่ที่เลือก" (เพราะนับ 7 วันล่าสุดเสมอ)
