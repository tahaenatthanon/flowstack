## MODIFIED Requirements

### Requirement: Widget คิวเผยแพร่ (นับสถานะ)
แท็บ "ภาพรวม" SHALL แสดง widget "คิวเผยแพร่" ในคอลัมน์ภาพรวม ที่นับจำนวนรายการใน `content_publish_queue` แยกตามสถานะ `pending`/`processing`/`sent` เท่านั้น รายการ `failed` ไม่แสดงในการ์ดนี้ (ย้ายไปเป็น widget แยก "เผยแพร่ล้มเหลว" ในคอลัมน์ต้องดำเนินการ) และการ์ดนี้ไม่แสดงข้อความ "เลยกำหนด" ซ้ำ (แจ้งเตือนแสดงที่ banner บนสุดของหน้าเพียงจุดเดียว โดยใช้นิยามเดียวกับ `content-publish.php?action=overdue_count`)

#### Scenario: นับตามสถานะ ไม่รวม failed
- **WHEN** แท็บ "ภาพรวม" โหลดและเรียก `?action=overview`
- **THEN** widget "คิวเผยแพร่" แสดงจำนวน `pending`, `processing`, `sent` แยกกัน และไม่แสดงจำนวน `failed` ในการ์ดนี้

#### Scenario: ไม่แสดงข้อความเลยกำหนดซ้ำ
- **WHEN** `queue.overdue_pending` มากกว่า 0
- **THEN** widget "คิวเผยแพร่" ไม่แสดงข้อความแจ้งเตือนเลยกำหนดภายในการ์ด (แจ้งเตือนแสดงเฉพาะที่ banner บนสุดของหน้า ซึ่งใช้ `useOverdueCount()` เดิม)

### Requirement: Widget คอนเทนต์ค้างท่อ (Aging)
แท็บ "ภาพรวม" SHALL แสดง widget "คอนเทนต์ค้างท่อ" ที่แบ่งรายการที่ `status <> 'published'` ตามช่วงอายุจาก `created_at` (0-7 / 8-30 / 31-90 / 90+ วัน) พร้อม Badge จำนวนรวมที่หัวการ์ด

#### Scenario: แบ่งช่วงอายุ
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** widget แสดงจำนวนรายการที่ยังไม่เผยแพร่ในแต่ละช่วงอายุ 0-7, 8-30, 31-90, และ 90+ วัน (นับจาก `created_at`)

#### Scenario: แสดงรายการที่เก่าสุด 5 รายการ
- **WHEN** มีรายการค้างท่อ
- **THEN** widget แสดงรายการ 5 รายการที่เก่าสุด (เรียงตาม `created_at` เก่า→ใหม่)

#### Scenario: แสดง platform badge แยกทีละแพลตฟอร์มในรายการที่เก่าสุด
- **WHEN** รายการที่เก่าสุดมี content item ที่มีหลายแพลตฟอร์ม (เช่น `platform="facebook,linkedin"`)
- **THEN** แถวของ item นั้นแสดง badge แยกทีละแพลตฟอร์มด้วย `PlatformBadgeList` (ไม่ใช่การ lookup `PLATFORM_MAP[item.platform]` ตรงๆ ซึ่งไม่แสดง badge ใดๆ เมื่อมีมากกว่า 1 แพลตฟอร์ม)

#### Scenario: ไม่แสดง platform badge เมื่อ content item ไม่มีแพลตฟอร์ม
- **WHEN** รายการที่เก่าสุดมี content item ที่ไม่มีแพลตฟอร์มเลย
- **THEN** แถวของ item นั้นแสดง badge สถานะ (`STATUS_MAP`) ตามปกติ แต่ไม่แสดง platform badge ใดๆ

#### Scenario: แสดง Badge จำนวนรวมที่หัวการ์ด
- **WHEN** widget "คอนเทนต์ค้างท่อ" render และมีรายการค้างท่ออย่างน้อย 1 รายการ
- **THEN** หัวการ์ด (`CardTitle`) แสดง `Badge` ตัวเลขจำนวนรวมทั้งหมดที่ยังไม่เผยแพร่ (`aging.total`)

## ADDED Requirements

### Requirement: Widget เผยแพร่ล้มเหลว
แท็บ "ภาพรวม" SHALL แสดง widget "เผยแพร่ล้มเหลว" ในคอลัมน์ต้องดำเนินการ แสดงรายการสถานะ `failed` จาก `content_publish_queue` พร้อมปุ่ม "ลองส่งใหม่" และ Badge จำนวนรายการที่หัวการ์ด

#### Scenario: แสดงรายการ failed พร้อมปุ่มลองส่งใหม่
- **WHEN** มีรายการ `failed` อย่างน้อย 1 รายการ
- **THEN** widget แสดงรายการ failed (error_msg, retry_count, ชื่อคอนเทนต์, ชื่อ channel) และปุ่ม "ลองส่งใหม่" ที่เรียก action `send_now` เดิมของ `api/content-publish.php` (ไม่สร้าง endpoint ใหม่)

#### Scenario: แสดง Badge จำนวนรายการล้มเหลวที่หัวการ์ด
- **WHEN** widget "เผยแพร่ล้มเหลว" render และมีรายการ `failed` อย่างน้อย 1 รายการ
- **THEN** หัวการ์ด (`CardTitle`) แสดง `Badge` ตัวเลขจำนวนรายการ `failed`

#### Scenario: ไม่มีรายการล้มเหลว
- **WHEN** ไม่มีรายการสถานะ `failed`
- **THEN** การ์ดนี้ไม่แสดงเนื้อหาแยก — ถ้าคอนเทนต์ค้างท่อก็ว่างพร้อมกัน คอลัมน์ต้องดำเนินการแสดงข้อความว่างรวมแทน (ดู `content-dashboard-layout`)

## REMOVED Requirements

### Requirement: Widget Funnel การผลิต
**Reason**: เล่าเรื่องความคืบหน้าคล้ายกับการ์ด "ความคืบหน้าการผลิต" (สัดส่วนสถานะปัจจุบัน) แต่นับแบบสะสม ("เคยผ่าน") ทำให้ตัวเลขไม่ตรงกันเสมอไป (เช่น รายการที่เคยอนุมัติแล้วถูกตีกลับ draft) สร้างความสับสนมากกว่าให้ข้อมูลเพิ่มสำหรับผู้อนุมัติที่ต้องติดตามสถานะปัจจุบัน
**Migration**: ดูสัดส่วนสถานะปัจจุบันได้จากการ์ด "ความคืบหน้าการผลิต" แทน (`content-dashboard-work-progress`); ฟิลด์ `funnel` ใน `?action=overview` ยังคืนค่าเดิมจาก backend เผื่อนำกลับมาแสดงในอนาคต

### Requirement: Widget สถานะสร้างสื่อ AI
**Reason**: เป็นข้อมูล operational ของการผลิตสื่อ (image/video generation) ไม่ใช่สถานะคอนเทนต์ที่ผู้อนุมัติต้องตัดสินใจ ไม่จำเป็นสำหรับการติดตามสถานะคอนเทนต์บนแท็บภาพรวม
**Migration**: ไม่มี UI แสดงในแท็บภาพรวมอีกต่อไป; ฟิลด์ `assets` ใน `?action=overview` ยังคืนค่าเดิมจาก backend เผื่อนำกลับมาแสดงในอนาคต
