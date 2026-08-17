## ADDED Requirements

### Requirement: Tenant Registration
ระบบ SHALL ให้ผู้ใช้ใหม่ลงทะเบียนสร้าง workspace ใหม่ผ่านหน้า public registration form โดยไม่ต้องมีบัญชีอยู่ก่อน

#### Scenario: New tenant registration
- **WHEN** ผู้ใช้กรอก workspace name, email, password และ submit
- **THEN** ระบบสร้าง tenant record, สร้าง admin user, activate trial period 14 วัน และส่ง verification email

#### Scenario: Duplicate workspace name
- **WHEN** ผู้ใช้กรอก workspace name ที่มีอยู่แล้ว
- **THEN** ระบบแสดง error "ชื่อ workspace นี้ถูกใช้แล้ว" และไม่สร้าง tenant

### Requirement: Trial Activation
ระบบ SHALL activate trial plan อัตโนมัติเมื่อ registration สำเร็จ กำหนด trial_ends_at = now + 14 วัน

#### Scenario: Trial period active
- **WHEN** tenant อยู่ในช่วง trial
- **THEN** ระบบแสดง banner แจ้งวันหมดอายุ trial และ CTA "อัปเกรด"

#### Scenario: Trial expired
- **WHEN** trial_ends_at ผ่านไปแล้วและยังไม่ได้ subscribe
- **THEN** ระบบจำกัดการเข้าถึง (read-only) และแสดงหน้า upgrade required

### Requirement: Stripe Payment Integration
ระบบ SHALL ให้ผู้ใช้ชำระเงินผ่าน Stripe Checkout (hosted) เพื่อ activate paid plan

#### Scenario: Initiate checkout
- **WHEN** user คลิก "อัปเกรด" และเลือก plan
- **THEN** ระบบสร้าง Stripe Checkout session และ redirect ไปยัง Stripe hosted page

#### Scenario: Payment successful
- **WHEN** Stripe webhook `checkout.session.completed` ถูกรับ
- **THEN** ระบบอัปเดต subscription status เป็น active และส่ง confirmation email

#### Scenario: Payment failed or cancelled
- **WHEN** user cancel checkout หรือ payment ล้มเหลว
- **THEN** ระบบ redirect กลับและแสดง message ที่เหมาะสม, subscription status ไม่เปลี่ยน

### Requirement: Setup Wizard
ระบบ SHALL แสดง setup wizard สำหรับ workspace ใหม่ที่ยังไม่ได้ตั้งค่า ครอบคลุม: ข้อมูลบริษัท, invite สมาชิก, ตั้งค่า email SMTP, และ เลือก modules ที่ใช้

#### Scenario: First login triggers wizard
- **WHEN** admin login ครั้งแรกหลัง registration
- **THEN** ระบบ redirect ไปยัง `/setup` wizard แทน dashboard

#### Scenario: Complete wizard
- **WHEN** admin ทำ setup wizard ครบทุกขั้นตอนและ submit
- **THEN** ระบบบันทึก company_settings ทั้งหมดและ redirect ไปยัง dashboard พร้อมแสดง welcome message

#### Scenario: Skip wizard
- **WHEN** admin คลิก "ข้ามการตั้งค่า"
- **THEN** ระบบ skip ไปยัง dashboard และ wizard สามารถเข้าถึงได้จาก Admin settings ภายหลัง
