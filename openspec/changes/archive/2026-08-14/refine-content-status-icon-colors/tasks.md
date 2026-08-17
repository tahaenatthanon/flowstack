## 1. อัปเดต STATUS_MAP ใน types.ts

- [x] 1.1 ใน `src/components/content/types.ts` เพิ่ม `Stamp` ใน import จาก lucide-react และลบ `BadgeCheck` (ถ้าไม่ใช้ที่อื่น)
- [x] 1.2 เปลี่ยน type ของ `STATUS_MAP` เป็น `{ label: string; color: string; icon: React.ElementType; iconColor: string; progressColor: string }`
- [x] 1.3 เปลี่ยน status `approved` เป็น `{ label: 'อนุมัติแล้ว', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300', icon: Stamp, iconColor: 'text-teal-600', progressColor: '[&>div]:bg-teal-600' }`
- [x] 1.4 เพิ่ม `progressColor` ให้ครบทุกสถานะ: published=`[&>div]:bg-green-600`, draft=`[&>div]:bg-gray-600`, revision=`[&>div]:bg-blue-600`, pending_approval=`[&>div]:bg-amber-600`, rejected=`[&>div]:bg-red-600`

## 2. ปรับ Stat Card border ใน ContentDashboardPage

- [x] 2.1 ใน `src/pages/ContentDashboardPage.tsx` เพิ่ม field `border` ใน `statCards` array ให้ตรงกับ `color` (border-blue-600, border-green-600, border-amber-600, border-gray-600, border-cyan-600, border-pink-600)
- [x] 2.2 เปลี่ยน `<Card key={card.label}>` เป็น `<Card key={card.label} className={card.border}>`

## 3. ปรับ Work Progress ใน ContentDashboardPage

- [x] 3.1 เปลี่ยน `<Progress value={percent} className="h-2" />` เป็น `<Progress value={percent} className={`h-1.5 ${info.progressColor}`} />` (progressColor มี `[&>div]:` รวมอยู่แล้ว)
- [x] 3.2 เปลี่ยนตัวเลข `{count} ชิ้น ({percent}%)` ให้ใช้ className รวม `info.iconColor` (สีเดียวกับสถานะ) คง label ฝั่งซ้ายเป็น `text-muted-foreground`

## 4. อัปเดต hardcode BadgeCheck ในหน้าอื่น

- [x] 4.1 ใน `ContentApprovalTab.tsx` เปลี่ยน `icon: BadgeCheck, color: 'text-success'` (approved) เป็น `icon: Stamp, color: 'text-teal-600'` พร้อมอัปเดต import
- [x] 4.2 ใน `ContentListTab.tsx` เปลี่ยน `<BadgeCheck .../>รอเผยแพร่` เป็น `<Stamp .../>รอเผยแพร่` พร้อมอัปเดต import

## 5. ตรวจสอบและทดสอบ

- [x] 5.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 5.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — สถานะ "อนุมัติแล้ว" ใช้ไอคอน Stamp สี teal แยกจาก "เผยแพร่แล้ว" (เขียว) ชัดเจน
- [ ] 5.3 ยืนยัน Status Card ทั้ง 6 ใบมีสีกรอบตรงกับไอคอน และ Work Progress ใช้สีประจำสถานะ + รูปแบบ `h-1.5` มาตรฐาน
- [ ] 5.4 ยืนยันหน้าผลงานคอนเทนต์และรายการอนุมัติใช้ไอคอน Stamp สำหรับ "อนุมัติแล้ว" ตรงกัน และ label/จำนวน/ฟังก์ชันเดิมไม่กระทบ

## 6. ปรับ Status Card ให้ใช้รูปแบบ stat-card เดียวกับหน้าโปรเจกต์

- [x] 6.1 ใน `ContentDashboardPage.tsx` เปลี่ยน markup Stat Card จาก `<Card>` + `<CardHeader>`/`<CardContent>` เป็น `div.stat-card.card-hover` pattern เดียวกับ `src/components/StatCards.tsx`
- [x] 6.2 เพิ่ม field `bgColor` ใน `statCards` array (`bg-blue-500/10`, `bg-green-500/10`, `bg-amber-500/10`, `bg-gray-500/10`, `bg-cyan-500/10`, `bg-pink-500/10`) ให้ตรงกับสีไอคอน
- [x] 6.3 โครงสร้างใหม่: ไอคอนในกล่องสี rounded ด้านบน, ค่าตัวเลข `text-xl sm:text-2xl font-bold font-heading`, label `text-xs sm:text-sm text-muted-foreground` ใต้ค่า

## 7. ปรับ Progress Bar ให้ใช้สีเดียวกับ Status Card

- [x] 7.1 ยืนยัน `progressColor` ของแต่ละสถานะตรงกับสี Status Card (icon/badge color) ของสถานะนั้น
- [x] 7.2 ตรวจสอบแถบ Progress ใน Work Progress ใช้สีเดียวกับ Status Card ของสถานะเดียวกัน (ไม่ใช้สี default)

## 8. ตรวจสอบและทดสอบ (ส่วนเพิ่ม)

- [x] 8.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 8.2 ทดสอบบนเบราว์เซอร์: Stat Card ใช้รูปแบบเดียวกับหน้าโปรเจกต์ และ Progress Bar ใช้สีเดียวกับ Status Card

## 9. ปรับ Status Card layout และ Progress Bar สีให้สอดคล้องจากแหล่งเดียว

- [x] 9.1 ใน `src/components/content/types.ts` เปลี่ยน `progressColor` ทุกสถานะให้เก็บ literal class เต็ม `[&>div]:bg-{color}-600` เดียวกับ `iconColor` (published=`[&>div]:bg-green-600`, draft=`[&>div]:bg-gray-600`, revision=`[&>div]:bg-blue-600`, pending_approval=`[&>div]:bg-amber-600`, approved=`[&>div]:bg-teal-600`, rejected=`[&>div]:bg-red-600`)
- [x] 9.2 ใน `src/pages/ContentDashboardPage.tsx` เปลี่ยน layout Stat Card เป็น: หัวข้อด้านซ้าย + ไอคอนด้านขวา (แถวเดียว) + จำนวนด้านล่าง (คง decoration `stat-card card-hover`)
- [x] 9.3 ตรวจสอบ Progress Bar ของสถานะที่ไม่มี Status Card (approved, revision) ใช้สีเดียวกับ Icon (`iconColor`)
- [x] 9.4 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 9.5 ทดสอบบนเบราว์เซอร์: Stat Card จัดวางหัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง และ Progress Bar สีสอดคล้องกับ Status Card/Icon

## 10. แก้ไข Progress Bar สีไม่ตรง (Tailwind JIT)

- [x] 10.1 ใน `src/components/content/types.ts` เปลี่ยน `progressColor` เป็น literal class เต็ม `[&>div]:bg-{color}-600` (ไม่ใช่ `bg-{color}-600`) เพื่อให้ Tailwind JIT generate CSS
- [x] 10.2 ใน `src/pages/ContentDashboardPage.tsx` เปลี่ยน `<Progress className={`h-1.5 [&>div]:${info.progressColor}`} />` เป็น `<Progress className={`h-1.5 ${info.progressColor}`} />`
- [x] 10.3 รัน `pnpm build` และยืนยันใน `dist/assets/index-*.css` มี `[&>div]:bg-{color}-600` ครบทั้ง 6 สี
