## MODIFIED Requirements

### Requirement: Content item ที่มีหลายแพลตฟอร์มต้องแสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง
ทุกจุด UI ที่ยังแสดงแพลตฟอร์มของ content item (`ContentCardDialog`, `ContentDetailView`, `PullFromContentDialog`, และการ์ด "คอนเทนต์ค้างท่อ"/"เนื้อหาล่าสุด" ของ `ContentDashboardPage`) SHALL parse ค่าแพลตฟอร์ม (ไม่ว่าจะมาจาก `platforms` แบบ JSON array หรือ `platform` แบบ comma-joined string) เป็นรายการแพลตฟอร์มแยกกัน แล้วแสดงแต่ละแพลตฟอร์มพร้อมไอคอน/สีของแพลตฟอร์มนั้นๆ โดยใช้ `PlatformBadgeList` เป็น component กลางร่วมกัน ห้ามนำค่าดิบทั้งก้อนไป lookup เป็นแพลตฟอร์มเดียว และห้ามเขียน logic parse/render แพลตฟอร์มแยกเอง

#### Scenario: Dialog แก้ไขคอนเทนต์แสดง badge แยกทีละแพลตฟอร์ม
- **WHEN** เปิด `ContentCardDialog` สำหรับ content item ที่มี `platforms=["facebook","linkedin","twitter","instagram","lineoa","wordpress","wix"]`
- **THEN** header แสดง badge แยก 7 อัน แต่ละอันมีไอคอนและสีตรงกับแพลตฟอร์มนั้นๆ ไม่ใช่ badge เดียวที่โชว์สตริงดิบ

#### Scenario: Content item ที่มีแพลตฟอร์มเดียวยังแสดงผลถูกต้องเหมือนเดิม
- **WHEN** content item มีแพลตฟอร์มเดียว (เช่น `platforms=["facebook"]`)
- **THEN** ทั้ง `ContentCardDialog`, `ContentDetailView`, `PullFromContentDialog`, และการ์ด "คอนเทนต์ค้างท่อ"/"เนื้อหาล่าสุด" ของ `ContentDashboardPage` แสดงไอคอน/สีของแพลตฟอร์มนั้นถูกต้อง เหมือนพฤติกรรมเดิม

#### Scenario: PullFromContentDialog แสดง badge แยกทีละแพลตฟอร์มในลิสต์เลือกคอนเทนต์
- **WHEN** เปิด `PullFromContentDialog` และมี content item ในลิสต์ที่มีหลายแพลตฟอร์ม (เช่น `platforms=["facebook","linkedin"]`)
- **THEN** แถวของ item นั้นแสดง badge แยก 2 อัน (Facebook, LinkedIn) แต่ละอันมีไอคอนและสีถูกต้อง ไม่ใช่ badge ว่างเปล่า

#### Scenario: PullFromContentDialog ไม่แสดง badge เมื่อ content item ไม่มีแพลตฟอร์ม
- **WHEN** content item ไม่มีแพลตฟอร์มเลย (parse ได้ array ว่าง)
- **THEN** แถวของ item นั้นไม่แสดง badge แพลตฟอร์มใดๆ (ไม่ใช่ badge ว่างเปล่าที่มองเห็น)

#### Scenario: การ์ด "คอนเทนต์ค้างท่อ" บนแดชบอร์ดแสดง badge แยกทีละแพลตฟอร์ม
- **WHEN** การ์ด "คอนเทนต์ค้างท่อ" ของ `ContentDashboardPage` แสดงรายการที่มี content item ที่มีหลายแพลตฟอร์ม (เช่น `platform="facebook,linkedin"`)
- **THEN** แถวของ item นั้นแสดง badge แยก 2 อัน (Facebook, LinkedIn) แต่ละอันมีไอคอนและสีถูกต้อง ไม่ใช่การไม่แสดง badge ใดๆ เลย

#### Scenario: การ์ด "เนื้อหาล่าสุด" บนแดชบอร์ดแสดง badge แยกทีละแพลตฟอร์ม
- **WHEN** การ์ด "เนื้อหาล่าสุด" ของ `ContentDashboardPage` แสดงรายการที่มี content item ที่มีหลายแพลตฟอร์ม (เช่น `platform="facebook,linkedin"`)
- **THEN** แถวของ item นั้นแสดง badge แยก 2 อัน (Facebook, LinkedIn) แต่ละอันมีไอคอนและสีถูกต้อง ไม่ใช่การไม่แสดง badge ใดๆ เลย

#### Scenario: การ์ดบนแดชบอร์ดไม่แสดง badge เมื่อ content item ไม่มีแพลตฟอร์ม
- **WHEN** content item ที่แสดงในการ์ด "คอนเทนต์ค้างท่อ" หรือ "เนื้อหาล่าสุด" ไม่มีแพลตฟอร์มเลย (parse ได้ array ว่าง)
- **THEN** แถวของ item นั้นไม่แสดง badge แพลตฟอร์มใดๆ (พฤติกรรมเดิม — ไม่เปลี่ยน)
