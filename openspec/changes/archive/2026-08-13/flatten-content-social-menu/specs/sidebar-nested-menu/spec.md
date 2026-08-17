## MODIFIED Requirements

### Requirement: Marketing menu flattened
เมนู "การตลาด" SHALL มีโครงสร้างแบบแบนราบ (ไม่มี sub-group "คอนเทนต์โซเชียล") โดย "แดชบอร์ดคอนเทนต์" อยู่เป็นรายการแรกสุด:
- แดชบอร์ดคอนเทนต์ (`/content-dashboard`)
- แคมเปญอีเมล (`/marketing`)
- คอนเทนต์โซเชียล (`/content`)
- ปฏิทินคอนเทนต์ (`/content-planner`)
- วิเคราะห์แคมเปญ (`/campaign-analytics`)
- สตูดิโอสื่อ (`/media-studio`)

#### Scenario: Marketing menu renders flat items
- **WHEN** ผู้ใช้ขยายกลุ่ม "การตลาด" ใน sidebar
- **THEN** เห็น 6 รายการหลักแบบแบนราบ: แดชบอร์ดคอนเทนต์, แคมเปญอีเมล, คอนเทนต์โซเชียล, ปฏิทินคอนเทนต์, วิเคราะห์แคมเปญ, สตูดิโอสื่อ

#### Scenario: Dashboard is first item
- **WHEN** ผู้ใช้เปิดกลุ่ม "การตลาด"
- **THEN** "แดชบอร์ดคอนเทนต์" อยู่เป็นรายการบนสุด (ก่อน "แคมเปญอีเมล" และรายการอื่นทั้งหมด)

#### Scenario: No content social sub-group
- **WHEN** ผู้ใช้เปิดกลุ่ม "การตลาด"
- **THEN** ไม่มี sub-group "คอนเทนต์โซเชียล" ให้คลิกขยาย — รายการคอนเทนต์ทั้งหมด (คอนเทนต์โซเชียล, แดชบอร์ดคอนเทนต์, ปฏิทินคอนเทนต์) แสดงเป็นเมนูหลักระดับเดียวกัน

## RENAMED Requirements

- FROM: `### Requirement: Marketing menu restructured with children items`
- TO: `### Requirement: Marketing menu flattened`
