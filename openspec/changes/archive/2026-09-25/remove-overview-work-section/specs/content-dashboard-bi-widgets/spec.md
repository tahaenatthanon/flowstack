## MODIFIED Requirements

### Requirement: action=overview คืนข้อมูล 7 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=overview` ที่คืนข้อมูลของแท็บภาพรวมจากข้อมูลทั้งหมดตามที่กำหนดใน `content-overview-bi` (ไม่มีพารามิเตอร์ช่วงเวลาและไม่มีค่าเปรียบเทียบ) ได้แก่ `kpi`, `funnel`, `status_summary`, `unpublished_aging`, `publishing_health`, `schedule_summary`, `engagement_trend`, `platform_performance` (ชื่อ requirement คงเดิมเพื่อความต่อเนื่อง แต่ไม่ได้จำกัดที่ 7 กลุ่มอีกต่อไป) กลุ่ม `queue`, `aging`, `social_snapshot`, `page_summary`, `assets`, `engagement_trend` แบบ 7/30/90, `platform_performance` แบบ rolling วัน/สัปดาห์/เดือน และ `funnel` แบบนับเฉพาะ timestamp SHALL NOT ถูกคืน พารามิเตอร์ `trend_range` และ `platform_period` ไม่ถูกใช้

#### Scenario: response มีกลุ่มครบ
- **WHEN** เรียก `?action=overview`
- **THEN** response มีคีย์ `kpi`, `funnel`, `status_summary`, `unpublished_aging`, `publishing_health`, `schedule_summary`, `engagement_trend`, `platform_performance` ครบ และไม่มีคีย์ `queue` หรือ `aging`

#### Scenario: ค่าที่ไม่มีข้อมูลเป็น null
- **WHEN** ค่าใดไม่มีข้อมูล (เช่น Avg/Post เมื่อไม่มีโพสต์ที่วัดได้ หรือ Success Rate เมื่อไม่มีรายการจบ)
- **THEN** ค่านั้นเป็น `null` ไม่ใช่ `0` ส่วนจำนวนนับ (count) ที่เป็นศูนย์จริงคืน `0`

## REMOVED Requirements

### Requirement: Widget คิวเผยแพร่ (นับสถานะ)
**Reason**: ส่วน "งานที่ต้องจัดการ" ถูกลบออกจากแท็บภาพรวม — ตัวเลขชุดเดียวกันแสดงที่ Publishing Health ในส่วน "การเผยแพร่" (`content-overview-bi`)
**Migration**: ใช้ Publishing Health (รอดำเนินการ / ส่งสำเร็จ / ส่งไม่สำเร็จ / Success Rate)

### Requirement: Widget เผยแพร่ล้มเหลว
**Reason**: ส่วน "งานที่ต้องจัดการ" ถูกลบออกจากแท็บภาพรวมตามการตัดสินใจของผู้ใช้ รายการล้มเหลวย้ายไปแสดงใต้ Success Rate ในกล่อง "ภาพรวมการเผยแพร่" (`content-overview-bi` requirement Publishing Health) แบบไม่มีปุ่มลองส่งใหม่
**Migration**: ดูรายการล้มเหลว (ชื่อคอนเทนต์, แพลตฟอร์ม, สาเหตุ, สถานะ) ในกล่องภาพรวมการเผยแพร่ และส่งใหม่จากหน้ารายละเอียดคอนเทนต์ (ปุ่ม "ส่งทันที" ซึ่งเรียก `send_now` เดิม)

### Requirement: Widget คอนเทนต์ค้างท่อ (Aging)
**Reason**: ตัวเลข 4 ช่วงอายุซ้ำกับกล่อง "คอนเทนต์ที่ยังไม่เผยแพร่" ในส่วน "การผลิต" (`content-overview-bi`) และส่วนงานถูกลบ
**Migration**: ใช้กล่อง "คอนเทนต์ที่ยังไม่เผยแพร่" ในส่วนการผลิต (`unpublished_aging`) และหน้าคอนเทนต์สำหรับรายการรายชิ้น
