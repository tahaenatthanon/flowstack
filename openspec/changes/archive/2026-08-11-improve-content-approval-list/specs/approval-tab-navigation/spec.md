## ADDED Requirements

### Requirement: Approval list has tab navigation for status filtering
ระบบ SHALL แสดง Tab Navigation สำหรับกรองรายการตามสถานะ โดยใช้รูปแบบเดียวกับ Status Filter ในหน้าผลงานคอนเทนต์ (`ContentListTab.tsx`) — มี 5 Tab: ทั้งหมด, รออนุมัติ (`review`), อนุมัติแล้ว (`published`), ขอแก้ไข (`revision`), และปฏิเสธ (`rejected`) — TabsList ใช้ `h-auto p-1 flex flex-wrap gap-0.5`, TabsTrigger ใช้ `gap-1.5 text-xs sm:text-sm` พร้อม Icon `h-3.5 w-3.5` วางก่อนข้อความ และจำนวนรายการใน `<span>` badge ทรงกลมด้านหลังข้อความ

#### Scenario: Display tabs with flex-wrap layout matching Status filter pattern
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** TabsList ใช้ className `h-auto p-1 flex flex-wrap gap-0.5` — Tab เรียงต่อกันและ wrap ตามธรรมชาติเมื่อพื้นที่ไม่พอ

#### Scenario: Display tabs with icons and count badges matching Status filter pattern
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** แต่ละ TabsTrigger ใช้ className `gap-1.5 text-xs sm:text-sm` และแสดง Icon `h-3.5 w-3.5` ประกอบ: ทั้งหมด (`Layers`), รออนุมัติ (`Clock`), อนุมัติแล้ว (`CheckCircle2`), ขอแก้ไข (`AlertTriangle`), ปฏิเสธ (`XCircle`) — พร้อมจำนวนรายการใน `<span className="ml-1 text-[10px] px-1.5 py-0 rounded-full bg-muted font-semibold">{count}</span>` ด้านหลังข้อความ

#### Scenario: Filter by tab
- **WHEN** ผู้ใช้คลิก Tab "อนุมัติแล้ว"
- **THEN** ตารางแสดงเฉพาะ content items ที่มี status `published`

#### Scenario: Tab "ทั้งหมด" shows all items
- **WHEN** ผู้ใช้คลิก Tab "ทั้งหมด"
- **THEN** ตารางแสดง content items ทุกสถานะ

#### Scenario: Empty tab shows zero
- **WHEN** สถานะใดไม่มีรายการ
- **THEN** count badge แสดง "0" และเมื่อเลือก Tab นั้น ตารางแสดงข้อความ "ไม่มีรายการ"
