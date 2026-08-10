# sidebar-nested-menu Specification

## ADDED Requirements

### Requirement: Sidebar supports three-level menu nesting
`NavItem` interface SHALL รองรับ `children?: NavItem[]` property สำหรับการสร้างเมนูย่อยแบบ recursive

#### Scenario: Render nested sub-items
- **WHEN** `NavItem` มี `children` property
- **THEN** `CollapsibleGroup` component แสดงผลเป็น sub-group ที่ยุบ-ขยายได้ (collapsible) ภายในกลุ่มหลัก

#### Scenario: Active state for nested items
- **WHEN** URL ปัจจุบันตรงกับ `href` ของ item ใน children
- **THEN** sub-group parent แสดงสถานะ active (highlight) และขยายอัตโนมัติ

### Requirement: Marketing menu restructured with children items
เมนู "การตลาด" SHALL มีโครงสร้าง:
- แคมเปญอีเมล (`/marketing`)
- คอนเทนต์โซเชียล (sub-group มี children 4 รายการเรียงติดกัน)
  - แดชบอร์ด (`/content-dashboard`)
  - ผลงานคอนเทนต์ (`/content`)
  - รายการอนุมัติ (`/content-approval`)
  - ปฏิทินคอนเทนต์ (`/content-planner`)
- วิเคราะห์แคมเปญ (`/campaign-analytics`)
- สตูดิโอสื่อ (`/media-studio`)

#### Scenario: Marketing menu renders correctly
- **WHEN** ผู้ใช้ขยายกลุ่ม "การตลาด" ใน sidebar
- **THEN** เห็น 4 รายการหลัก: แคมเปญอีเมล, คอนเทนต์โซเชียล (ยุบ-ขยายได้), วิเคราะห์แคมเปญ, สตูดิโอสื่อ

#### Scenario: Content social sub-group expands
- **WHEN** ผู้ใช้คลิก "คอนเทนต์โซเชียล" เพื่อขยาย
- **THEN** เห็น 4 รายการย่อยเรียงติดกัน: แดชบอร์ด, ผลงานคอนเทนต์, รายการอนุมัติ, ปฏิทินคอนเทนต์

### Requirement: Non-marketing groups remain unchanged
กลุ่มเมนูอื่น (จัดการโปรเจค, การขายและ CRM, สนับสนุน, ImpactOS, การจัดการระบบ) SHALL คงโครงสร้าง 2 ระดับเหมือนเดิม

#### Scenario: Other groups unaffected
- **WHEN** ผู้ใช้เปิดกลุ่ม "จัดการโปรเจค"
- **THEN** เห็นรายการย่อยแบบแบนราบเหมือนเดิม ไม่มีการเปลี่ยนแปลง
