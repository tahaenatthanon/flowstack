## 1. Reorder Marketing Sidebar Items

- [x] 1.1 แก้ `src/components/AppSidebar.tsx` เรียง `items` กลุ่ม `key: 'marketing'` ใหม่เป็นลำดับ: แดชบอร์ดคอนเทนต์, คอนเทนต์โซเชียล, ปฏิทินคอนเทนต์, แคมเปญอีเมล, วิเคราะห์แคมเปญ, สตูดิโอสื่อ (คง `title`/`href`/`icon`/`menuKey` เดิมของแต่ละรายการ)
- [x] 1.2 ตรวจสอบว่าไม่มีการแก้กลุ่มเมนูอื่น และไม่มีการแก้ Route/`menuKey`/permission ใด ๆ

## 2. Verification

- [x] 2.1 รัน `pnpm lint` ผ่าน
- [x] 2.2 รัน `pnpm build` ผ่าน
- [x] 2.3 เปิด Sidebar กลุ่ม "การตลาด" ยืนยันลำดับเมนูตรงตาม spec และทุกเมนูยัง navigate ไป route เดิมได้
