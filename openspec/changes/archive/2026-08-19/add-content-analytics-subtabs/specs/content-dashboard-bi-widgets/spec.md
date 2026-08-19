## MODIFIED Requirements

### Requirement: Widget แนวโน้ม Throughput รายเดือน
sub-tab "เนื้อหา" ของแท็บ "วิเคราะห์" SHALL แสดง widget "แนวโน้ม Throughput รายเดือน" เป็นกราฟ (recharts) ย้อนหลัง 12 เดือน มี 4 เส้น: สร้าง / ขออนุมัติ / อนุมัติ / เผยแพร่ โดยแต่ละเมตริกนับในเดือนของ timestamp ตัวเอง และ respect ช่วงวันที่จากตัวกรอง (default 12 เดือน)

#### Scenario: 4 เส้นต่อเดือนครบ
- **WHEN** sub-tab "เนื้อหา" โหลดและเรียก `?action=analytics`
- **THEN** กราฟแสดง 4 เส้น (สร้าง/ขออนุมัติ/อนุมัติ/เผยแพร่) บนแกนเวลา 12 เดือนย้อนหลัง

#### Scenario: แกนเวลาหนาแน่น
- **WHEN** บางเดือนไม่มีข้อมูล (0 รายการ)
- **THEN** เดือนนั้นยังปรากฏบนแกนเวลาด้วยค่า 0 (ไม่ถูกข้าม)

#### Scenario: respect ช่วงวันที่ที่เลือก
- **WHEN** ผู้ใช้เปลี่ยนช่วงวันที่เป็นช่วงที่สั้นลง
- **THEN** กราฟคำนวณใหม่จากรายการที่ timestamp อยู่ในช่วงวันที่นั้น

### Requirement: Widget แพลตฟอร์มเป็น Donut Chart
sub-tab "เนื้อหา" SHALL แสดง widget "แพลตฟอร์ม" เป็น Donut Chart (recharts `PieChart` พร้อม `innerRadius`) แทน list เดิม พร้อม legend และคงสี platform จาก `getPlatformColors()` ใน `src/lib/platformConfig.ts`

#### Scenario: แสดง Donut Chart
- **WHEN** sub-tab "เนื้อหา" โหลดและมี `content_items`
- **THEN** widget "แพลตฟอร์ม" แสดง PieChart แบบ donut (มี innerRadius) แทนรายการ list

#### Scenario: ใช้สี platform จาก getPlatformColors
- **WHEN** แสดง donut chart
- **THEN** แต่ละ slice ใช้สีจาก `getPlatformColors(platform)`

#### Scenario: แสดง legend
- **WHEN** แสดง donut chart
- **THEN** แสดง legend ระบุชื่อและจำนวนของแต่ละแพลตฟอร์ม

#### Scenario: แสดง empty state
- **WHEN** ไม่มี `content_items`
- **THEN** widget แสดง empty-state message

### Requirement: Widget อัตราสำเร็จการเผยแพร่เป็น Bar Chart
sub-tab "เนื้อหา" SHALL แสดง widget "อัตราสำเร็จการเผยแพร่" เป็น Bar Chart (recharts `BarChart` แบบ stacked `sent`/`failed`) แยกตามแพลตฟอร์ม แทน Progress bar เดิม พร้อม error ที่พบบ่อยสุดต่อแพลตฟอร์ม

#### Scenario: แสดง Bar Chart stacked sent/failed
- **WHEN** sub-tab "เนื้อหา" โหลดและมีรายการเผยแพร่
- **THEN** widget แสดง BarChart แบบ stacked แยก `sent` และ `failed` ต่อแพลตฟอร์ม

#### Scenario: แสดง error ที่พบบ่อย
- **WHEN** แพลตฟอร์มมีรายการ failed
- **THEN** widget แสดง error ที่พบบ่อยสุดของแพลตฟอร์มนั้น

#### Scenario: success rate เป็น null เมื่อยังไม่มีรายการจบ
- **WHEN** แพลตฟอร์มยังไม่มีรายการที่จบ (`sent` หรือ `failed`)
- **THEN** success rate ของแพลตฟอร์มนั้นเป็น `null` (คิวที่ยังไม่เคยส่ง ≠ 0%)
