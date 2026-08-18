## ADDED Requirements

### Requirement: เพิ่มคอลัมน์เป้าหมายความถี่รายสัปดาห์
ระบบ SHALL เพิ่มคอลัมน์ `weekly_posts_target` ในตาราง `content_global_settings` ผ่าน migration โดยมีค่า default `0` (แปลว่า "ยังไม่ได้ตั้งเป้าหมาย") เพื่อใช้เป็นเป้าหมายความถี่การโพสต์รายสัปดาห์

#### Scenario: คอลัมน์มีค่า default เป็น 0
- **WHEN** migration รันสำเร็จบนฐานข้อมูล
- **THEN** ตาราง `content_global_settings` มีคอลัมน์ `weekly_posts_target` เป็นชนิด `TINYINT UNSIGNED` (หรือชนิดจำนวนเต็มที่เทียบเท่า) ที่มีค่า default `0`

### Requirement: คำนวณเวลาผลิตเฉลี่ยจาก approved_at
ระบบ SHALL มี endpoint ที่คืนค่าเวลาผลิตเฉลี่ย (lead time) คำนวณจากระยะเวลาระหว่าง `created_at` และ `approved_at` ของรายการ `content_items` ที่มี `approved_at` ไม่เป็น NULL

#### Scenario: มีรายการที่อนุมัติแล้ว
- **WHEN** มี `content_items` อย่างน้อย 1 รายการที่มี `approved_at` ไม่เป็น NULL และเรียก endpoint เมตริกผลลัพธ์
- **THEN** response มี `avg_production_hours` เป็นค่าจำนวนชั่วโมงเฉลี่ยของ `TIMESTAMPDIFF(HOUR, created_at, approved_at)` จากทุกรายการที่อนุมัติแล้ว

#### Scenario: ยังไม่มีรายการที่อนุมัติ
- **WHEN** ไม่มี `content_items` ใดที่มี `approved_at` ไม่เป็น NULL
- **THEN** response มี `avg_production_hours` เป็น `null` และ `approved_count` เป็น `0`

### Requirement: คำนวณความถี่การเผยแพร่จาก published_at
ระบบ SHALL คืนค่าความถี่การเผยแพร่เป็นจำนวนโพสต์ที่เผยแพร่ในช่วง 7 วันล่าสุด โดยนับจากคอลัมน์ `published_at` ของ `content_items`

#### Scenario: นับโพสต์ในช่วง 7 วันล่าสุด
- **WHEN** เรียก endpoint เมตริกผลลัพธ์
- **THEN** response มี `posts_last_7_days` เป็นจำนวนรายการ `content_items` ที่ `published_at` อยู่ในช่วง 7 วันล่าสุด (นับจากเวลาปัจจุบัน)

#### Scenario: ไม่มีโพสต์ที่เผยแพร่
- **WHEN** ไม่มี `content_items` ใดที่มี `published_at` ไม่เป็น NULL
- **THEN** response มี `posts_last_7_days` เป็น `0` และ `published_count` เป็น `0`

### Requirement: คืนค่าเป้าหมายความถี่จาก content_global_settings
ระบบ SHALL คืนค่า `weekly_posts_target` จาก `content_global_settings` ใน response ของ endpoint เมตริกผลลัพธ์ เพื่อให้ UI เปรียบเทียบความถี่จริงกับเป้าหมาย

#### Scenario: คืนค่าเป้าหมายที่ตั้งไว้
- **WHEN** เรียก endpoint เมตริกผลลัพธ์
- **THEN** response มี `weekly_posts_target` เป็นค่าจากคอลัมน์ `weekly_posts_target` ของ `content_global_settings` (เป็น `0` เมื่อยังไม่ได้ตั้งค่า)

### Requirement: บันทึกเป้าหมายความถี่ผ่าน global-settings
ระบบ SHALL รองรับการอ่านและเขียน `weekly_posts_target` ผ่าน action `global-settings` เดิมของ `api/brand-content.php`

#### Scenario: บันทึกเป้าหมายใหม่
- **WHEN** POST `/brand-content.php?action=global-settings` พร้อม body ที่มี `weekly_posts_target` เป็นจำนวนเต็ม
- **THEN** ค่า `weekly_posts_target` ถูกบันทึกลง `content_global_settings` ของ tenant นั้น

#### Scenario: อ่านเป้าหมายกลับ
- **WHEN** GET `/brand-content.php?action=global-settings`
- **THEN** response มี `weekly_posts_target` เป็นค่าที่บันทึกไว้ล่าสุด

### Requirement: แสดงการ์ดเมตริกผลลัพธ์บนแดชบอร์ด
แท็บ "วิเคราะห์" ของแดชบอร์ดคอนเทนต์ SHALL แสดงการ์ดเมตริกผลลัพธ์อย่างน้อย 2 ใบ ได้แก่ "เวลาผลิตเฉลี่ย" (จาก `avg_production_hours`) และ "ความถี่การโพสต์/สัปดาห์" (จาก `posts_last_7_days` เทียบกับ `weekly_posts_target`)

#### Scenario: แสดงเวลาผลิตเฉลี่ย
- **WHEN** แท็บ "วิเคราะห์" โหลดและเรียก endpoint เมตริกผลลัพธ์สำเร็จ
- **THEN** แสดงการ์ด "เวลาผลิตเฉลี่ย" พร้อมค่าจาก `avg_production_hours` (หรือข้อความ "ยังไม่มีข้อมูล" เมื่อเป็น `null`)

#### Scenario: แสดงความถี่เทียบเป้าหมาย
- **WHEN** แท็บ "วิเคราะห์" โหลดและเรียก endpoint เมตริกผลลัพธ์สำเร็จ
- **THEN** แสดงการ์ด "ความถี่การโพสต์/สัปดาห์" พร้อมค่า `posts_last_7_days` และเปรียบเทียบกับ `weekly_posts_target` (แสดงสถานะ "ยังไม่ได้ตั้งเป้าหมาย" เมื่อเป้าหมายเป็น `0`)

### Requirement: คืนค่าสถานะ has_data เมื่อไม่มีข้อมูลใด
ระบบ SHALL คืน `has_data` ใน response ของ endpoint เมตริกผลลัพธ์เพื่อให้ UI ทราบว่ามีข้อมูลผลลัพธ์จริงหรือไม่

#### Scenario: ไม่มีข้อมูลผลลัพธ์เลย
- **WHEN** ไม่มี `content_items` ใดที่มี `approved_at` หรือ `published_at` ไม่เป็น NULL
- **THEN** response มี `has_data` เป็น `false`

#### Scenario: มีข้อมูลผลลัพธ์
- **WHEN** มี `content_items` อย่างน้อย 1 รายการที่มี `approved_at` หรือ `published_at` ไม่เป็น NULL
- **THEN** response มี `has_data` เป็น `true`
