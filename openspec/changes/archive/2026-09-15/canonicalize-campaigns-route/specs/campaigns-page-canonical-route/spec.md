## ADDED Requirements

### Requirement: หน้าจัดการแคมเปญอีเมลต้องมี /campaigns เป็น canonical route
Route `/campaigns` SHALL render หน้าจัดการแคมเปญอีเมล (component `CampaignsPage.tsx`) โดยตรง ไม่ผ่าน redirect

#### Scenario: เข้าหน้าแคมเปญอีเมลผ่าน /campaigns
- **WHEN** ผู้ใช้เข้า URL `/campaigns` โดยตรง
- **THEN** ระบบ SHALL แสดงหน้าจัดการแคมเปญอีเมล โดยไม่มีการ redirect URL เปลี่ยนไปเป็น `/marketing`

### Requirement: /marketing ต้อง redirect ไป /campaigns เพื่อ backward compatibility
Route `/marketing` SHALL redirect ไปยัง `/campaigns` เสมอ เพื่อรองรับลิงก์หรือ bookmark เก่าที่ยังอ้างอิง URL เดิม

#### Scenario: เข้าหน้าเดิมผ่าน /marketing
- **WHEN** ผู้ใช้เข้า URL `/marketing` (เช่นจาก bookmark เก่า)
- **THEN** ระบบ SHALL redirect ไปยัง `/campaigns` และแสดงหน้าจัดการแคมเปญอีเมลตามปกติ

### Requirement: ทุกจุดนำทางภายในแอปต้องชี้ไป /campaigns
ลิงก์นำทางภายในแอป (sidebar, breadcrumb) ที่ไปยังหน้าจัดการแคมเปญอีเมล SHALL ใช้ `/campaigns` เป็นปลายทาง ไม่ใช่ `/marketing`

#### Scenario: คลิกเมนู "แคมเปญอีเมล" ใน sidebar
- **WHEN** ผู้ใช้คลิกรายการ "แคมเปญอีเมล" ใน sidebar
- **THEN** ระบบ SHALL นำทางไปยัง `/campaigns` โดยตรง ไม่ผ่าน redirect

#### Scenario: คลิก breadcrumb จากหน้าที่เกี่ยวข้อง
- **WHEN** ผู้ใช้คลิก breadcrumb ที่ชี้ไปหน้าแคมเปญอีเมลจากหน้า `CampaignAnalyticsPage`, `ContentPage`, `ContentPlannerPage`, หรือ `ContentDashboardPage`
- **THEN** ระบบ SHALL นำทางไปยัง `/campaigns` โดยตรง ไม่ผ่าน redirect
