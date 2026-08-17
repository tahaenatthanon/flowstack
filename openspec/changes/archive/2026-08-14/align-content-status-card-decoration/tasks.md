## 1. ปรับ Status Card decoration ใน ContentDashboardPage

- [x] 1.1 ใน `src/pages/ContentDashboardPage.tsx` ใช้ class `stat-card` เป็น base decoration เดียวกับหน้าโปรเจกต์ (`rounded-xl` + padding + default border + `bg-card`)
- [x] 1.2 เอา hover effect ออก (ลบ `card-hover` ออกจาก className)
- [x] 1.3 คง layout ภายในเดิม (หัวข้อด้านซ้าย + ไอคอนด้านขวาในแถวเดียวกัน + จำนวนด้านล่าง)

## 2. เพิ่มสีพื้นหลังตาม Status

- [x] 2.1 เพิ่ม field `bgColor` ใน `statCards` array (`bg-blue-500/10`, `bg-green-500/10`, `bg-amber-500/10`, `bg-gray-500/10`, `bg-cyan-500/10`, `bg-pink-500/10`) ให้ตรงกับสีไอคอน
- [x] 2.2 ใส่ `bgColor` ลงบนตัวการ์ดทั้งใบ (`className={`stat-card p-3 sm:p-5 ${card.bgColor}`}`) — ไอคอนแสดงแบบ plain โดยไม่ห่อกล่องสีแยก
- [x] 2.3 ตรวจสอบแต่ละ Status Card แสดงสีพื้นหลังถูกต้องตาม Status ที่กำหนด

## 3. เพิ่มสีขอบ (border) ตาม Status

- [x] 3.1 เพิ่ม field `border` ใน `statCards` array (`border-blue-600`, `border-green-600`, `border-amber-600`, `border-gray-600`, `border-cyan-600`, `border-pink-600`) ให้ตรงกับสีไอคอน
- [x] 3.2 ใส่ `border` ลงบนตัวการ์ด (`className={`stat-card p-3 sm:p-5 ${card.border} ${card.bgColor}`}`)
- [x] 3.3 ตรวจสอบแต่ละ Status Card แสดงสีขอบถูกต้องตาม Status ที่กำหนด

## 4. ปรับสีจำนวน (Count) เป็นเฉดเข้มเดียวกับพื้นหลัง

- [x] 4.1 เพิ่ม field `countColor` ใน `statCards` array (`text-blue-700`, `text-green-700`, `text-amber-700`, `text-gray-700`, `text-cyan-700`, `text-pink-700`) ให้ตรงกับสีพื้นหลัง
- [x] 4.2 ใส่ `countColor` ลงบนจำนวน (`<p className={`text-xl sm:text-2xl font-bold font-heading tabular-nums ${card.countColor}`}>`)
- [x] 4.3 ตรวจสอบจำนวนแต่ละ Stat Card แสดงสีเข้มขึ้นและอ่านง่าย ตรงกับสีพื้นหลังของ card นั้น

## 5. ตรวจสอบและทดสอบ

- [x] 5.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 5.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — Status Card ใช้ base decoration เดียวกับหน้าโปรเจกต์, ไม่มี hover effect, มีขอบสี + พื้นหลังสี + จำนวนเข้มตาม Status และ layout ภายในคงเดิม

