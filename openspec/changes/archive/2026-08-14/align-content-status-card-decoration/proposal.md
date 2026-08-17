## Why

Status Card ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) ปัจจุบันใช้ `stat-card card-hover p-3 sm:p-5 border-{color}` ซึ่งมีสีกรอบ (border) ตามสีไอคอนของแต่ละ card และมี hover effect (`card-hover`: shadow + ยกตัวเมื่อ hover) — ต่างจาก Status Card ในหน้าโปรเจกต์ (`src/components/StatCards.tsx`) ที่ใช้กรอบ default + `bg-card` ตาม class `stat-card` โดยไม่เพิ่มสีกรอบพิเศษ และ hover effect ทำให้การ์ดขยับเมื่อเลื่อนเมาส์ไปวาง ทำให้รูปแบบการแสดงผลไม่คงที่

## What Changes

- ปรับ Status Card ในแดชบอร์ดคอนเทนต์ให้ใช้ class `stat-card` เป็น base decoration เดียวกับ Status Card หน้าโปรเจกต์ (`rounded-xl` + padding + default border + `bg-card`)
- ปรับ Status Card ให้มีสีพื้นหลังตาม Status โดยเพิ่ม field `bgColor` (`bg-{color}-500/10`) ให้แต่ละ card และใส่สีลงบนตัวการ์ดทั้งใบ — ใช้รูปแบบสีเดียวกับ Status Card หน้าโปรเจกต์ (`bg-{color}/10`)
- ปรับ Status Card ให้มีสีขอบ (border) ตาม Status โดยเพิ่ม field `border` (`border-{color}-600`) ให้แต่ละ card — ใช้สีขอบตรงกับสีไอคอนของ card นั้น
- ปรับสีของจำนวน (Count) ใน Stat Card ให้เป็นสีเดียวกับพื้นหลังของ Card แต่ใช้เฉดสีที่เข้มกว่า (เพิ่ม field `countColor` เช่น `text-{color}-700`) เพื่อให้ข้อความเด่นชัดและอ่านง่าย
- คงรูปแบบการจัดเรียงองค์ประกอบภายใน Status Card เดิมไว้ (หัวข้อด้านซ้าย, ไอคอนด้านขวา, จำนวนด้านล่าง) — ไม่เปลี่ยน Layout
- เอา hover effect (`card-hover`) ออกจาก Status Card เพื่อให้รูปแบบการแสดงผลคงที่เมื่อเลื่อนเมาส์ไปวาง

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ — ทั้งหมดเป็นการปรับ requirement เดิม -->

### Modified Capabilities

- `content-dashboard-stat-card-style`: เพิ่มสีขอบ `border-{color}-600` ตาม Status, เพิ่มสีพื้นหลังตาม Status (`bg-{color}/10` บนทั้งการ์ด), ปรับสีจำนวน (Count) เป็นเฉดเข้มเดียวกับพื้นหลัง, ใช้ class `stat-card` เป็น base decoration เดียวกับหน้าโปรเจกต์ โดยไม่มี hover effect และคง layout หัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง

## Impact

- `src/pages/ContentDashboardPage.tsx` — เพิ่ม field `bgColor` (`bg-{color}-500/10`) ลงบนตัวการ์ดทั้งใบ, เพิ่ม field `border` (`border-{color}-600`) ลงบนตัวการ์ด, เพิ่ม field `countColor` (`text-{color}-700`) ลงบนจำนวน (Count), className เป็น `stat-card p-3 sm:p-5 ${card.border} ${card.bgColor}`
- ไม่กระทบ API, DB, hooks, หรือ logic การคำนวณใดๆ
- ไม่กระทบ Progress Bar (ยังคงใช้สีประจำสถานะจาก `STATUS_MAP.progressColor`) หรือไอคอนสถานะ
