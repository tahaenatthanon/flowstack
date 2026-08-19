## MODIFIED Requirements

### Requirement: แท็บวิเคราะห์แสดงข้อมูลเชิง insight
The "วิเคราะห์" tab SHALL be split into 3 sub-tabs — "โซเชียล" (social), "เว็บไซต์" (website), and "เนื้อหา" (content) — where the "เนื้อหา" sub-tab SHALL contain the insight/engagement sections: the content stat cards (เนื้อหาทั้งหมด, เผยแพร่แล้ว, Engagement รวม, Content Performance), "แพลตฟอร์ม", "เนื้อหายอดนิยม", "เวลาที่ดีที่สุดในการโพสต์", "ประสิทธิภาพการผลิต", "แนวโน้ม Throughput รายเดือน", "Lead time แยกตามขั้น", "ความสมบูรณ์ SEO", "Plan → Content conversion", and "อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม".

#### Scenario: แท็บวิเคราะห์มี sub-tab ครบ 3 แท็บ
- **WHEN** the "วิเคราะห์" tab is active
- **THEN** it shows sub-tabs "โซเชียล", "เว็บไซต์", and "เนื้อหา"

#### Scenario: sub-tab เนื้อหามี section ครบ
- **WHEN** the "เนื้อหา" sub-tab is active
- **THEN** it shows the content stat cards, "แพลตฟอร์ม", "เนื้อหายอดนิยม", "เวลาที่ดีที่สุดในการโพสต์", "ประสิทธิภาพการผลิต", "แนวโน้ม Throughput รายเดือน", "Lead time แยกตามขั้น", "ความสมบูรณ์ SEO", "Plan → Content conversion", and "อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม"

#### Scenario: แท็บวิเคราะห์ไม่มี widget เชิงปฏิบัติการ
- **WHEN** the "วิเคราะห์" tab is active
- **THEN** it does NOT show the production stat cards, "สุขภาพคิวเผยแพร่", "Funnel การผลิต", "คอนเทนต์ค้างท่อ", "สถานะสร้างสื่อ AI", "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", or "สถานะช่องทาง"
