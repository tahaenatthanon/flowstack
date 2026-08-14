## 1. เพิ่มการตรวจสอบการเชื่อมต่อจริงใน backend

- [x] 1.1 ใน `api/brand-content.php` refactor logic ของ `test-channel` เป็น helper `testChannelConnection($db, $channel)` คืน `['ok' => bool, 'message' => string]`
- [x] 1.2 เพิ่ม action `channels-connection-status` (GET) ที่ loop ทุก channel ของ tenant แล้วรัน helper คืน array `[{ id, name, ok, message }]` (channel ที่ `is_active === 0` → `ok: false` ทันที)

## 2. ดึงสถานะจริงใน frontend

- [x] 2.1 ใน `src/hooks/useContent.ts` เพิ่ม hook `useChannelConnectionStatus()` ที่เรียก `/brand-content.php?action=channels-connection-status`
- [x] 2.2 ใน `src/pages/ContentDashboardPage.tsx` เอา Status Badge เดิม (จุดสี) ออก และใช้ผลจาก hook แสดง "จุดสี + ข้อความ" ด้านหลังข้อมูล (ไม่มีพื้นหลัง/Status Badge): `ok === true` → จุดสีเขียว + "เชื่อมต่อแล้ว", `ok === false` → จุดสีแดง + "ไม่เชื่อมต่อ"

## 3. ตรวจสอบและทดสอบ

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 3.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — แต่ละช่องทางแสดง "จุดสี + ข้อความ" (ไม่มีพื้นหลัง/Status Badge) ("เชื่อมต่อแล้ว" จุดเขียว / "ไม่เชื่อมต่อ" จุดแดง) สะท้อนผลการเชื่อมต่อจริง ไม่ใช่แค่ `is_active`
