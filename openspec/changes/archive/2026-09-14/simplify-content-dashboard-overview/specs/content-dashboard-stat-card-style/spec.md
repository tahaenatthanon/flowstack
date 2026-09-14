## REMOVED Requirements

### Requirement: Stat cards แสดงหัวข้อและไอคอนในแถวเดียวกัน โดยจำนวนอยู่ด้านล่าง
**Reason**: การ์ด stat card 4 ใบบนสุดของแท็บภาพรวม (เนื้อหาทั้งหมด/เผยแพร่แล้ว/รออนุมัติ/ฉบับร่าง) ยุบรวมเข้ากับการ์ด "ความคืบหน้าการผลิต" (`content-dashboard-work-progress`) เพื่อไม่ให้ตัวเลขชุดเดียวกันแสดงซ้ำ 2 จุดในหน้าเดียว
**Migration**: ดูจำนวนรวมและสัดส่วนแต่ละสถานะได้จากการ์ด "ความคืบหน้าการผลิต" แทน

### Requirement: Stat cards update on data change
**Reason**: widget ที่ requirement นี้อ้างอิงถูกลบตามเหตุผลข้างต้น
**Migration**: การ์ด "ความคืบหน้าการผลิต" อัปเดตอัตโนมัติตาม React Query อยู่แล้ว (ดู `content-dashboard-work-progress`)

### Requirement: Stat card border ตรงกับสีไอคอน
**Reason**: widget ที่ requirement นี้อ้างอิงถูกลบตามเหตุผลข้างต้น
**Migration**: ไม่มี stat card แยกให้ต้องกำหนดสีกรอบอีกต่อไปในแท็บภาพรวม

### Requirement: Stat card ใช้รูปแบบเดียวกับ Status Card ในหน้าโปรเจกต์
**Reason**: widget ที่ requirement นี้อ้างอิงถูกลบตามเหตุผลข้างต้น
**Migration**: ไม่มี stat card แยกให้ต้องคง decoration นี้อีกต่อไปในแท็บภาพรวม

### Requirement: Stat card แสดงสีพื้นหลังตาม Status
**Reason**: widget ที่ requirement นี้อ้างอิงถูกลบตามเหตุผลข้างต้น
**Migration**: ไม่มี stat card แยกให้ต้องกำหนดสีพื้นหลังอีกต่อไปในแท็บภาพรวม

### Requirement: จำนวน (Count) ใช้เฉดเข้มเดียวกับพื้นหลัง
**Reason**: widget ที่ requirement นี้อ้างอิงถูกลบตามเหตุผลข้างต้น
**Migration**: การ์ด "ความคืบหน้าการผลิต" ใช้สีตาม `STATUS_MAP.iconColor` อยู่แล้ว (ดู `content-dashboard-work-progress`)
