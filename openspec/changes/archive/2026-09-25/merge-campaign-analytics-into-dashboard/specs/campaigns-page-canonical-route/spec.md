## MODIFIED Requirements

### Requirement: ทุกจุดนำทางภายในแอปต้องชี้ไป /campaigns
ลิงก์นำทางภายในแอป (sidebar, breadcrumb) ที่ไปยังหน้าจัดการแคมเปญอีเมล SHALL ใช้ `/campaigns` เป็นปลายทาง ไม่ใช่ `/marketing`

#### Scenario: คลิกเมนู "แคมเปญอีเมล" ใน sidebar
- **WHEN** ผู้ใช้คลิกรายการ "แคมเปญอีเมล" ใน sidebar
- **THEN** ระบบ SHALL นำทางไปยัง `/campaigns` โดยตรง ไม่ผ่าน redirect

#### Scenario: คลิก breadcrumb จากหน้าที่เกี่ยวข้อง
- **WHEN** ผู้ใช้คลิก breadcrumb ที่ชี้ไปหน้าแคมเปญอีเมลจากหน้า `ContentPage`, `ContentPlannerPage`, หรือ `ContentDashboardPage` (รวมเมื่ออยู่ส่วนแคมเปญ)
- **THEN** ระบบ SHALL นำทางไปยัง `/campaigns` โดยตรง ไม่ผ่าน redirect
