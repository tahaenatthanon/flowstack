## MODIFIED Requirements

### Requirement: action=overview คืนข้อมูล 7 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=overview` ที่คืนข้อมูลของแท็บภาพรวมจากข้อมูลทั้งหมดตามที่กำหนดใน `content-overview-bi` (ไม่มีพารามิเตอร์ช่วงเวลาและไม่มีค่าเปรียบเทียบ) ได้แก่ `kpi`, `funnel`, `status_summary`, `unpublished_aging`, `publishing_health`, `schedule_summary`, `engagement_trend`, `platform_performance` และข้อมูลของส่วนงานที่ต้องจัดการ `queue`, `aging` (ชื่อ requirement คงเดิมเพื่อความต่อเนื่อง แต่ไม่ได้จำกัดที่ 7 กลุ่มอีกต่อไป) กลุ่ม `social_snapshot`, `engagement_trend` แบบ 7/30/90, `platform_performance` แบบ rolling วัน/สัปดาห์/เดือน, `page_summary`, `assets` และ `funnel` แบบนับเฉพาะ timestamp ไม่ถูกคืนอีก พารามิเตอร์ `trend_range` และ `platform_period` ไม่ถูกใช้อีก

#### Scenario: response มีกลุ่มครบ
- **WHEN** เรียก `?action=overview`
- **THEN** response มีคีย์ `kpi`, `funnel`, `status_summary`, `unpublished_aging`, `publishing_health`, `schedule_summary`, `engagement_trend`, `platform_performance`, `queue`, `aging` ครบ

#### Scenario: ค่าที่ไม่มีข้อมูลเป็น null
- **WHEN** ค่าใดไม่มีข้อมูลในช่วง (เช่น Avg/Post เมื่อไม่มีโพสต์ที่วัดได้ หรือ Success Rate เมื่อไม่มีรายการจบ)
- **THEN** ค่านั้นเป็น `null` ไม่ใช่ `0` ส่วนจำนวนนับ (count) ที่เป็นศูนย์จริงคืน `0`

#### Scenario: queue และ aging ของส่วนงานคงรูปแบบเดิม
- **WHEN** เรียก `?action=overview`
- **THEN** กลุ่ม `queue` และ `aging` มีฟิลด์และความหมายเหมือนก่อน change นี้ (ไม่ผูกช่วงเวลา)

### Requirement: Widget คิวเผยแพร่ (นับสถานะ)
ส่วน "งานที่ต้องจัดการ" ของแท็บ "ภาพรวม" SHALL แสดง widget "คิวเผยแพร่" ที่นับจำนวนรายการใน `content_publish_queue` แยกตามสถานะ `pending`/`sent` เท่านั้น — `processing` (สถานะล็อกชั่วคราวระหว่าง cron กำลังส่ง) และ `failed` ไม่แสดงในการ์ดนี้ (`failed` ย้ายไปเป็น widget แยก "เผยแพร่ล้มเหลว" ในส่วนเดียวกัน; `processing` ไม่มีค่าที่ต้อง action จากผู้ใช้และเป็นสถานะที่ผ่านไปเร็ว จึงตัดออกจากการแสดงผลเพื่อลดความสับสน) และการ์ดนี้ไม่แสดงข้อความ "เลยกำหนด" ซ้ำ (แจ้งเตือนแสดงที่ banner ของส่วนงานที่ต้องจัดการเพียงจุดเดียว โดยใช้นิยามเดียวกับ `content-publish.php?action=overdue_count`)

#### Scenario: นับตามสถานะ ไม่รวม processing และ failed
- **WHEN** แท็บ "ภาพรวม" โหลดและเรียก `?action=overview`
- **THEN** widget "คิวเผยแพร่" แสดงจำนวน `pending` และ `sent` แยกกัน และไม่แสดงจำนวน `processing` หรือ `failed` ในการ์ดนี้ (endpoint ยังคำนวณและคืนค่าทั้ง `processing` และ `failed` เหมือนเดิม เพียงแต่ UI ไม่นำมาแสดง)

#### Scenario: ไม่แสดงข้อความเลยกำหนดซ้ำ
- **WHEN** `queue.overdue_pending` มากกว่า 0
- **THEN** widget "คิวเผยแพร่" ไม่แสดงข้อความแจ้งเตือนเลยกำหนดภายในการ์ด (แจ้งเตือนแสดงเฉพาะที่ banner ของส่วนงานที่ต้องจัดการ ซึ่งใช้ `useOverdueCount()` เดิม)

### Requirement: Widget เผยแพร่ล้มเหลว
ส่วน "งานที่ต้องจัดการ" ของแท็บ "ภาพรวม" SHALL แสดง widget "เผยแพร่ล้มเหลว" แสดงรายการสถานะ `failed` จาก `content_publish_queue` พร้อมปุ่ม "ลองส่งใหม่" และ Badge จำนวนรายการที่หัวการ์ด

#### Scenario: แสดงรายการ failed พร้อมปุ่มลองส่งใหม่
- **WHEN** มีรายการ `failed` อย่างน้อย 1 รายการ
- **THEN** widget แสดงรายการ failed (error_msg, retry_count, ชื่อคอนเทนต์, ชื่อ channel) และปุ่ม "ลองส่งใหม่" ที่เรียก action `send_now` เดิมของ `api/content-publish.php` (ไม่สร้าง endpoint ใหม่)

#### Scenario: แสดง Badge จำนวนรายการล้มเหลวที่หัวการ์ด
- **WHEN** widget "เผยแพร่ล้มเหลว" render และมีรายการ `failed` อย่างน้อย 1 รายการ
- **THEN** หัวการ์ด (`CardTitle`) แสดง `Badge` ตัวเลขจำนวนรายการ `failed`

#### Scenario: ไม่มีรายการล้มเหลว
- **WHEN** ไม่มีรายการสถานะ `failed`
- **THEN** การ์ดนี้ไม่แสดงเนื้อหาแยก — ถ้าคอนเทนต์ที่ยังไม่เผยแพร่ก็ว่างพร้อมกัน ส่วนงานที่ต้องจัดการแสดงข้อความว่างรวมแทน

### Requirement: Widget คอนเทนต์ค้างท่อ (Aging)
ส่วน "งานที่ต้องจัดการ" ของแท็บ "ภาพรวม" SHALL แสดง widget "คอนเทนต์ที่ยังไม่เผยแพร่" (ชื่อเดิม "คอนเทนต์ค้างท่อ" — ข้อมูลรวมฉบับร่างและที่ถูกปฏิเสธ จึงไม่ใช่เฉพาะงานที่ติด) ที่แบ่งรายการที่ `status <> 'published'` ตามช่วงอายุจาก `created_at` (0-7 / 8-30 / 31-90 / 90+ วัน)

#### Scenario: แบ่งช่วงอายุ
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** widget แสดงจำนวนรายการที่ยังไม่เผยแพร่ในแต่ละช่วงอายุ 0-7, 8-30, 31-90, และ 90+ วัน (นับจาก `created_at`)

#### Scenario: แสดงรายการที่เก่าสุด 5 รายการ
- **WHEN** มีคอนเทนต์ที่ยังไม่เผยแพร่
- **THEN** widget แสดงรายการ 5 รายการที่เก่าสุด (เรียงตาม `created_at` เก่า→ใหม่)

#### Scenario: แสดง platform badge แยกทีละแพลตฟอร์มในรายการที่เก่าสุด
- **WHEN** รายการที่เก่าสุดมี content item ที่มีหลายแพลตฟอร์ม (เช่น `platform="facebook,linkedin"`)
- **THEN** แถวของ item นั้นแสดง badge แยกทีละแพลตฟอร์มด้วย `PlatformBadgeList` (ไม่ใช่การ lookup `PLATFORM_MAP[item.platform]` ตรงๆ ซึ่งไม่แสดง badge ใดๆ เมื่อมีมากกว่า 1 แพลตฟอร์ม)

#### Scenario: ไม่แสดง platform badge เมื่อ content item ไม่มีแพลตฟอร์ม
- **WHEN** รายการที่เก่าสุดมี content item ที่ไม่มีแพลตฟอร์มเลย
- **THEN** แถวของ item นั้นแสดง badge สถานะ (`STATUS_MAP`) ตามปกติ แต่ไม่แสดง platform badge ใดๆ

#### Scenario: แสดง Badge จำนวนรวมที่หัวการ์ด
- **WHEN** widget "คอนเทนต์ที่ยังไม่เผยแพร่" render และมีรายการอย่างน้อย 1 รายการ
- **THEN** หัวการ์ด (`CardTitle`) แสดง `Badge` ตัวเลขจำนวนรวมทั้งหมดที่ยังไม่เผยแพร่ (`aging.total`)
