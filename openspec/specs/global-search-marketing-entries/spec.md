# global-search-marketing-entries

## Purpose

รายการนำทาง (`NAV_ITEMS`) ใน `GlobalSearch.tsx` ที่เกี่ยวข้องกับโมดูลการตลาด (แคมเปญอีเมล, วิเคราะห์แคมเปญ) ต้องตรงกับป้ายและปลายทางที่ปรากฏใน `AppSidebar.tsx` ไม่มีรายการซ้ำซ้อนที่ชี้ไปหน้าเดียวกัน และครอบคลุมหน้าที่มีอยู่จริงทั้งหมด

## Requirements

### Requirement: รายการ GlobalSearch ของหน้าแคมเปญอีเมลต้องตรงกับเมนูข้าง
รายการนำทางใน `GlobalSearch.tsx` (`NAV_ITEMS`) ที่เกี่ยวกับหน้าจัดการแคมเปญอีเมล SHALL ใช้ป้ายและปลายทางเดียวกับที่ปรากฏใน `AppSidebar.tsx`

#### Scenario: ป้ายตรงกับ Sidebar
- **WHEN** ผู้ใช้เปิด GlobalSearch (Cmd+K) และดูรายการที่เกี่ยวกับแคมเปญอีเมล
- **THEN** ป้ายชื่อ SHALL เป็น "แคมเปญอีเมล" ตรงกับป้ายใน `AppSidebar.tsx`

#### Scenario: ปลายทางไปหน้าที่ถูกต้อง
- **WHEN** ผู้ใช้เลือกรายการ "แคมเปญอีเมล" ใน GlobalSearch
- **THEN** ระบบ SHALL นำทางไปยัง `/campaigns` ซึ่งจะ redirect ไปแสดงหน้าจัดการแคมเปญอีเมล

### Requirement: ไม่มีรายการ GlobalSearch ซ้ำซ้อนที่ชี้ไปหน้าเดียวกัน
`NAV_ITEMS` ใน `GlobalSearch.tsx` SHALL NOT มีมากกว่าหนึ่งรายการที่นำทางไปยังหน้าจัดการแคมเปญอีเมลหน้าเดียวกัน

#### Scenario: ค้นหาคำว่าแคมเปญ
- **WHEN** ผู้ใช้พิมพ์คำว่า "แคมเปญ" ใน GlobalSearch
- **THEN** ผลลัพธ์ SHALL แสดงรายการที่นำไปสู่หน้าจัดการแคมเปญอีเมลเพียงรายการเดียว ไม่ซ้ำกัน

### Requirement: หน้าวิเคราะห์แคมเปญต้องค้นหาเจอใน GlobalSearch
`NAV_ITEMS` ใน `GlobalSearch.tsx` SHALL มีรายการที่นำทางไปยัง `/campaign-analytics`

#### Scenario: ค้นหาคำว่าวิเคราะห์แคมเปญ
- **WHEN** ผู้ใช้พิมพ์คำว่า "วิเคราะห์แคมเปญ" ใน GlobalSearch
- **THEN** ผลลัพธ์ SHALL แสดงรายการ "วิเคราะห์แคมเปญ" ที่นำทางไปยัง `/campaign-analytics`
