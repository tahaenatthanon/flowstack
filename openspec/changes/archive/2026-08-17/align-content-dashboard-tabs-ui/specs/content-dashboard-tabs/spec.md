# content-dashboard-tabs Specification (delta)

## ADDED Requirements

### Requirement: รูปแบบ tab bar สอดคล้องกับหน้าผลงานคอนเทนต์
tab bar "ภาพรวม"/"วิเคราะห์" ของแดชบอร์ดคอนเทนต์ SHALL ใช้รูปแบบการแสดงผล (visual style) เดียวกับ tab bar ระดับบนสุดของหน้า "ผลงานคอนเทนต์" (`ContentPage`): `TabsList` ที่มี `flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2` และ `TabsTrigger` แต่ละอันมี `gap-1 sm:gap-2 px-2 sm:px-3 shrink-0`

#### Scenario: TabsList ใช้ responsive grid 2 คอลัมน์
- **WHEN** แดชบอร์ดคอนเทนต์ render tab bar
- **THEN** `TabsList` ใช้ `flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2` (2 คอลัมน์ ตรงกับ 2 แท็บของแดชบอร์ด)

#### Scenario: TabsTrigger ใช้ spacing เดียวกับผลงานคอนเทนต์
- **WHEN** `TabsTrigger` ("ภาพรวม" หรือ "วิเคราะห์") ถูก render
- **THEN** ใช้ `gap-1 sm:gap-2 px-2 sm:px-3 shrink-0`

### Requirement: ไอคอนประจำแท็บ
แดชบอร์ดคอนเทนต์ SHALL แสดงไอคอน `lucide-react` บน trigger แต่ละแท็บ: "ภาพรวม" ใช้ `LayoutDashboard` และ "วิเคราะห์" ใช้ `BarChart3` โดยแต่ละอันใช้ `className="h-3.5 w-3.5 shrink-0"` และแสดงในทุกขนาดจอ

#### Scenario: แท็บภาพรวมมีไอคอน LayoutDashboard
- **WHEN** trigger แท็บ "ภาพรวม" ถูก render
- **THEN** แสดงไอคอน `LayoutDashboard` (`h-3.5 w-3.5 shrink-0`)

#### Scenario: แท็บวิเคราะห์มีไอคอน BarChart3
- **WHEN** trigger แท็บ "วิเคราะห์" ถูก render
- **THEN** แสดงไอคอน `BarChart3` (`h-3.5 w-3.5 shrink-0`)

### Requirement: ซ่อน label บนจอมือถือ
แดชบอร์ดคอนเทนต์ SHALL ห่อ label ข้อความของ trigger แต่ละแท็บด้วย `<span className="hidden sm:inline">` เพื่อให้เหลือเฉพาะไอคอนเมื่อจอต่ำกว่า breakpoint `sm` — สอดคล้องกับ "ผลงานคอนเทนต์"

#### Scenario: label ซ่อนบนจอแคบ
- **WHEN** แดชบอร์ดคอนเทนต์ render บนจอต่ำกว่า `sm`
- **THEN** label ของแท็บ ("ภาพรวม"/"วิเคราะห์") ถูกซ่อน เหลือเฉพาะไอคอน

#### Scenario: label แสดงบนจอ sm ขึ้นไป
- **WHEN** แดชบอร์ดคอนเทนต์ render บนจอ `sm` ขึ้นไป
- **THEN** label ของแท็บ ("ภาพรวม"/"วิเคราะห์") แสดงควบคู่กับไอคอน
