## MODIFIED Requirements

### Requirement: Widget คอนเทนต์ค้างท่อ (Aging)
แท็บ "ภาพรวม" SHALL แสดง widget "คอนเทนต์ค้างท่อ" ที่แบ่งรายการที่ `status <> 'published'` ตามช่วงอายุจาก `created_at` (0-7 / 8-30 / 31-90 / 90+ วัน)

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
