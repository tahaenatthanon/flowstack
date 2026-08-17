# content-dashboard-tabs Specification (delta)

## ADDED Requirements

### Requirement: แบ่งแดชบอร์ดคอนเทนต์เป็น 2 แท็บ
The content dashboard SHALL be split into two tabs — "ภาพรวม" (Overview) and "วิเคราะห์" (Analytics) — rendered using the existing `Tabs` primitive from `@/components/ui/tabs`.

#### Scenario: แสดงแท็บทั้งสอง
- **WHEN** the content dashboard renders
- **THEN** a `TabsList` shows two triggers: "ภาพรวม" and "วิเคราะห์"

#### Scenario: ใช้ Tabs primitive จาก Design System
- **WHEN** the content dashboard renders the tab structure
- **THEN** it uses `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` from `@/components/ui/tabs`

### Requirement: แท็บภาพรวมเป็นค่าเริ่มต้น
The "ภาพรวม" (Overview) tab SHALL be the default active tab.

#### Scenario: เปิดหน้าโดยไม่มี query parameter
- **WHEN** the user opens `/content-dashboard` without a `tab` query parameter
- **THEN** the "ภาพรวม" tab is active and its content is shown

### Requirement: สถานะแท็บผูกกับ URL query parameter
The active tab SHALL be driven by the `tab` URL query parameter, where `tab=overview` shows "ภาพรวม" and `tab=analytics` shows "วิเคราะห์"; an unrecognized or missing value SHALL default to "ภาพรวม".

#### Scenario: เปิดแท็บวิเคราะห์ผ่าน query
- **WHEN** the user navigates to `/content-dashboard?tab=analytics`
- **THEN** the "วิเคราะห์" tab is active and its content is shown

#### Scenario: refresh คงแท็บเดิม
- **WHEN** the user is on the "วิเคราะห์" tab and refreshes the page
- **THEN** the "วิเคราะห์" tab remains active (because the `tab` parameter is preserved in the URL)

#### Scenario: ค่า query ไม่รู้จักกลับไปภาพรวม
- **WHEN** the `tab` query parameter has an unrecognized value
- **THEN** the "ภาพรวม" tab is active

### Requirement: แท็บภาพรวมแสดงข้อมูลเชิงปฏิบัติการ
The "ภาพรวม" tab SHALL contain the operational/action sections: the production stat cards (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง), the overdue alert, "ภาพรวมสถานะคอนเทนต์" (Work Progress), "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", and "สถานะช่องทาง".

#### Scenario: แท็บภาพรวมไม่มี widget วิเคราะห์
- **WHEN** the "ภาพรวม" tab is active
- **THEN** it does NOT show the "แพลตฟอร์ม", "เนื้อหายอดนิยม", or "เวลาที่ดีที่สุดในการโพสต์" widgets

#### Scenario: แท็บภาพรวมมี section ครบ
- **WHEN** the "ภาพรวม" tab is active
- **THEN** it shows the production stat cards, overdue alert (when applicable), Work Progress, "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", and "สถานะช่องทาง"

### Requirement: แท็บวิเคราะห์แสดงข้อมูลเชิง insight
The "วิเคราะห์" tab SHALL contain the insight/engagement sections: the engagement stat cards (ยอดวิวรวม/ยอดไลก์รวม), "แพลตฟอร์ม", "เนื้อหายอดนิยม", and "เวลาที่ดีที่สุดในการโพสต์".

#### Scenario: แท็บวิเคราะห์มี section ครบ
- **WHEN** the "วิเคราะห์" tab is active
- **THEN** it shows the engagement stat cards, "แพลตฟอร์ม", "เนื้อหายอดนิยม", and "เวลาที่ดีที่สุดในการโพสต์"

#### Scenario: แท็บวิเคราะห์ไม่มี widget เชิงปฏิบัติการ
- **WHEN** the "วิเคราะห์" tab is active
- **THEN** it does NOT show the production stat cards, "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", or "สถานะช่องทาง"
