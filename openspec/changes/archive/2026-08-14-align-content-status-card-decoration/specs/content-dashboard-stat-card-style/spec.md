# content-dashboard-stat-card-style Specification (delta)

## MODIFIED Requirements

### Requirement: Stat card ใช้รูปแบบเดียวกับ Status Card ในหน้าโปรเจกต์
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL ใช้ class `stat-card` เป็น base decoration เดียวกับ Status Card ในหน้าโปรเจกต์ (`src/components/StatCards.tsx`) (`rounded-xl` + padding + default border + `bg-card`) โดยไม่มี hover effect และคงการจัดวางองค์ประกอบภายในเดิม (หัวข้อด้านซ้าย, ไอคอนด้านขวา, จำนวนด้านล่าง)

#### Scenario: decoration base เดียวกับหน้าโปรเจกต์
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card ใช้ class `stat-card` เป็น base (`rounded-xl` + padding + default border + `bg-card`) — ตรงกับ decoration ของ Status Card ในหน้าโปรเจกต์

#### Scenario: ไม่มี hover effect
- **WHEN** ผู้ใช้เลื่อนเมาส์ไปวาง (hover) บน Stat Card
- **THEN** การ์ดไม่ขยับ/ไม่เพิ่มเงา (ไม่มี class `card-hover`) — รูปแบบการแสดงผลคงที่

#### Scenario: คง layout หัวข้อซ้าย ไอคอนขวา จำนวนล่าง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card คงการจัดวางภายในเดิม — หัวข้อ (label) ด้านซ้าย, ไอคอนด้านขวาในแถวเดียวกัน, จำนวน (count) ด้านล่าง — ไม่เปลี่ยน Layout

## ADDED Requirements

### Requirement: Stat card แสดงสีพื้นหลังตาม Status
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL มีสีพื้นหลังตาม Status ของแต่ละ card โดยใช้รูปแบบสีเดียวกับ Status Card หน้าโปรเจกต์ (`bg-{color}/10`)

#### Scenario: สีพื้นหลังตรงกับ Status
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card มีสีพื้นหลัง (`bg-{color}/10`) ตรงกับ Status (เนื้อหาทั้งหมด = `bg-blue-500/10`, เผยแพร่แล้ว = `bg-green-500/10`, รออนุมัติ = `bg-amber-500/10`, ฉบับร่าง = `bg-gray-500/10`, ยอดวิวรวม = `bg-cyan-500/10`, ยอดไลก์รวม = `bg-pink-500/10`) — ตรงกับ pattern ของ Status Card หน้าโปรเจกต์

#### Scenario: คง layout หลังเพิ่มสีพื้นหลัง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** การเพิ่มสีพื้นหลังไม่เปลี่ยน layout ภายใน — หัวข้อยังอยู่ซ้าย, ไอคอนยังอยู่ขวา, จำนวนยังอยู่ล่าง

### Requirement: Stat card มีสีขอบ (border) ตาม Status
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL มีสีขอบ (border) ตาม Status ของแต่ละ card โดยใช้ `border-{color}-600` ตรงกับสีไอคอน

#### Scenario: ขอบสีเดียวกับไอคอน
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card มีสีขอบ `border-{color}-600` ตรงกับ Status (เนื้อหาทั้งหมด = `border-blue-600`, เผยแพร่แล้ว = `border-green-600`, รออนุมัติ = `border-amber-600`, ฉบับร่าง = `border-gray-600`, ยอดวิวรวม = `border-cyan-600`, ยอดไลก์รวม = `border-pink-600`) — ตรงกับสีไอคอนของ card นั้น

#### Scenario: คง layout หลังปรับขอบ
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** การปรับขอบไม่เปลี่ยน layout ภายใน — หัวข้อยังอยู่ซ้าย, ไอคอนยังอยู่ขวา, จำนวนยังอยู่ล่าง

### Requirement: จำนวน (Count) ใช้เฉดเข้มเดียวกับพื้นหลัง
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL แสดงจำนวน (Count) ด้วยสีเดียวกับพื้นหลังของ Card แต่ใช้เฉดสีที่เข้มกว่า เพื่อให้ข้อความเด่นชัดและอ่านง่าย

#### Scenario: จำนวนใช้เฉดเข้มเดียวกับพื้นหลัง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** จำนวน (Count) ใช้สี `text-{color}-700` เดียวกับพื้นหลังของ card นั้น (เนื้อหาทั้งหมด = `text-blue-700`, เผยแพร่แล้ว = `text-green-700`, รออนุมัติ = `text-amber-700`, ฉบับร่าง = `text-gray-700`, ยอดวิวรวม = `text-cyan-700`, ยอดไลก์รวม = `text-pink-700`) — เด่นชัดและอ่านง่ายบนพื้นหลัง `bg-{color}/10`
