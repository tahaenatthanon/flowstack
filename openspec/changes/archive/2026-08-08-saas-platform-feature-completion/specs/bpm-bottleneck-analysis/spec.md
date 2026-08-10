## ADDED Requirements

### Requirement: Stage Bottleneck Metrics
ระบบ SHALL คำนวณและแสดง bottleneck metrics ต่อแต่ละ stage ใน workflow journey ได้แก่: average time in stage (วัน), queue depth (จำนวน instances ที่อยู่ใน stage นั้นตอนนี้), throughput (instances/week), และ SLA breach rate (%)

#### Scenario: View bottleneck analysis
- **WHEN** user เปิด BPM workflow journey detail
- **THEN** ระบบแสดง stage metrics bar/heatmap เรียงตาม stage order พร้อมไฮไลต์ stage ที่มี avg time สูงสุด

#### Scenario: Identify bottleneck stage
- **WHEN** avg time ของ stage ใดเกิน threshold ที่กำหนด (หรือ SLA breach rate > 20%)
- **THEN** ระบบแสดง badge "คอขวด" บน stage นั้นใน UI

### Requirement: SLA Breach Alerts
ระบบ SHALL ส่ง notification เมื่อ workflow journey instance อยู่ใน stage เกิน SLA time ที่กำหนดต่อ stage

#### Scenario: SLA breach detected
- **WHEN** instance อยู่ใน stage เกิน SLA hours ที่ตั้งค่าไว้
- **THEN** ระบบสร้าง notification ให้ owner และแสดง status badge "เกิน SLA" บน instance

#### Scenario: Configure stage SLA
- **WHEN** admin แก้ไข workflow journey stage
- **THEN** ระบบอนุญาตให้ตั้งค่า `sla_hours` ต่อ stage และบันทึกลง DB

### Requirement: Bottleneck Report Export
ระบบ SHALL อนุญาตให้ export bottleneck report เป็น CSV

#### Scenario: Export bottleneck data
- **WHEN** user คลิก "ส่งออก CSV" ใน bottleneck view
- **THEN** ระบบ download CSV ที่มีข้อมูล stage, avg_time, queue_depth, throughput, sla_breach_rate
