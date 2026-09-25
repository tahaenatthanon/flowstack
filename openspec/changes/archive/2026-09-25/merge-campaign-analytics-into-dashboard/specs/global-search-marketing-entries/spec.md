## MODIFIED Requirements

### Requirement: หน้าวิเคราะห์แคมเปญต้องค้นหาเจอใน GlobalSearch
`NAV_ITEMS` ใน `GlobalSearch.tsx` SHALL มีรายการ "วิเคราะห์แคมเปญ" ที่นำทางไปยังส่วนแคมเปญของแดชบอร์ดการตลาด (`/content-dashboard?section=campaign`) โดยตรง ไม่ผ่าน redirect ของ `/campaign-analytics`

#### Scenario: ค้นหาคำว่าวิเคราะห์แคมเปญ
- **WHEN** ผู้ใช้พิมพ์คำว่า "วิเคราะห์แคมเปญ" ใน GlobalSearch
- **THEN** ผลลัพธ์ SHALL แสดงรายการ "วิเคราะห์แคมเปญ" ที่นำทางไปยัง `/content-dashboard?section=campaign`

## ADDED Requirements

### Requirement: แดชบอร์ดการตลาดต้องค้นหาเจอใน GlobalSearch
`NAV_ITEMS` ใน `GlobalSearch.tsx` SHALL มีรายการ "แดชบอร์ดการตลาด" ที่นำทางไปยัง `/content-dashboard` ใช้ป้ายเดียวกับเมนูข้าง

#### Scenario: ค้นหาคำว่าแดชบอร์ดการตลาด
- **WHEN** ผู้ใช้พิมพ์คำว่า "แดชบอร์ดการตลาด" ใน GlobalSearch
- **THEN** ผลลัพธ์ SHALL แสดงรายการ "แดชบอร์ดการตลาด" ที่นำทางไปยัง `/content-dashboard`
