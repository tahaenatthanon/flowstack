## 1. เอา Badge แพลตฟอร์มซ้ำออกจาก widget "สถานะช่องทาง"

- [x] 1.1 ใน `src/pages/ContentDashboardPage.tsx` ลบ `<Badge variant="outline" className={platform.color}>{platform.label}</Badge>` ออกจากแถว channel (คงเฉพาะ `ch.name` + สถานะ)
- [x] 1.2 ยืนยันแต่ละรายการแสดงชื่อช่องทางเพียงครั้งเดียว

## 2. เพิ่ม Logo Icon ด้านหน้าชื่อช่องทาง

- [x] 2.1 ใน `src/pages/ContentDashboardPage.tsx` นำเข้า `PlatformIcon` จาก `@/components/content/PlatformIcon` และ `getPlatformColors` จาก `@/lib/platformConfig`
- [x] 2.2 เพิ่มกล่อง logo (`w-8 h-8 rounded-lg` ตาม `getPlatformColors(ch.platform)`) + `<PlatformIcon platform={ch.platform} size={18} />` ไว้ด้านหน้าชื่อ channel
- [x] 2.3 ยืนยัน logo แสดงถูกต้องตามแพลตฟอร์มของแต่ละ channel

## 3. ตรวจสอบและทดสอบ

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 3.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — widget "สถานะช่องทาง" แสดงชื่อช่องทางครั้งเดียว พร้อม Logo Icon ด้านหน้า และไม่มี Badge แพลตฟอร์มซ้ำ
