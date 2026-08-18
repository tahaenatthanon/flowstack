## MODIFIED Requirements

### Requirement: แท็บภาพรวมแสดงข้อมูลเชิงปฏิบัติการ
The "ภาพรวม" tab SHALL contain the operational/action sections: the production stat cards (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง), the overdue alert, "ภาพรวมสถานะคอนเทนต์" (Work Progress), "สุขภาพคิวเผยแพร่", "Funnel การผลิต", "คอนเทนต์ค้างท่อ", "สถานะสร้างสื่อ AI", "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", and "สถานะช่องทาง".

#### Scenario: แท็บภาพรวมไม่มี widget วิเคราะห์
- **WHEN** the "ภาพรวม" tab is active
- **THEN** it does NOT show the "แพลตฟอร์ม", "เนื้อหายอดนิยม", or "เวลาที่ดีที่สุดในการโพสต์" widgets

#### Scenario: แท็บภาพรวมมี section ครบ
- **WHEN** the "ภาพรวม" tab is active
- **THEN** it shows the production stat cards, overdue alert (when applicable), Work Progress, "สุขภาพคิวเผยแพร่", "Funnel การผลิต", "คอนเทนต์ค้างท่อ", "สถานะสร้างสื่อ AI", "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", and "สถานะช่องทาง"

### Requirement: แท็บวิเคราะห์แสดงข้อมูลเชิง insight
The "วิเคราะห์" tab SHALL contain the insight/engagement sections: the engagement stat cards (ยอดวิวรวม/ยอดไลก์รวม), "แพลตฟอร์ม", "เนื้อหายอดนิยม", "เวลาที่ดีที่สุดในการโพสต์", "แนวโน้ม Throughput รายเดือน", "Lead time แยกตามขั้น", "ความสมบูรณ์ SEO", "Plan → Content conversion", and "อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม".

#### Scenario: แท็บวิเคราะห์มี section ครบ
- **WHEN** the "วิเคราะห์" tab is active
- **THEN** it shows the engagement stat cards, "แพลตฟอร์ม", "เนื้อหายอดนิยม", "เวลาที่ดีที่สุดในการโพสต์", "แนวโน้ม Throughput รายเดือน", "Lead time แยกตามขั้น", "ความสมบูรณ์ SEO", "Plan → Content conversion", and "อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม"

#### Scenario: แท็บวิเคราะห์ไม่มี widget เชิงปฏิบัติการ
- **WHEN** the "วิเคราะห์" tab is active
- **THEN** it does NOT show the production stat cards, "สุขภาพคิวเผยแพร่", "Funnel การผลิต", "คอนเทนต์ค้างท่อ", "สถานะสร้างสื่อ AI", "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", or "สถานะช่องทาง"
