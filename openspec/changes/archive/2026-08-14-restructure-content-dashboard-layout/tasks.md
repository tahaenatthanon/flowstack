## 1. เตรียม import

- [x] 1.1 ใน `src/pages/ContentDashboardPage.tsx` เพิ่ม import `Tabs, TabsContent, TabsList, TabsTrigger` จาก `@/components/ui/tabs`

## 2. ปรับ Stat Cards

- [x] 2.1 เปลี่ยน grid จาก `lg:grid-cols-6` เป็น `xl:grid-cols-6`
- [x] 2.2 เปลี่ยน `{card.value}` เป็น `{card.value.toLocaleString()}` และเพิ่ม `tabular-nums` ใน className ของ `div` ค่า
- [x] 2.3 เปลี่ยนยอดรวม "เนื้อหาทั้งหมด" (`{totalItems} ชิ้น`) เป็น `{totalItems.toLocaleString()} ชิ้น`

## 3. สร้าง master layout 2 คอลัมน์

- [x] 3.1 ครอบส่วน "ความคืบหน้าการผลิต" + ตาราง และ widget ฝั่งขวา ด้วย `grid grid-cols-1 xl:grid-cols-3 gap-6`
- [x] 3.2 ย้าย "ความคืบหน้าการผลิต" เข้าคอลัมน์ซ้าย (`xl:col-span-2`)
- [x] 3.3 ย้าย "คิวรออนุมัติ", "กำหนดการโพสต์ถัดไป", "สถานะช่องทาง", "แพลตฟอร์ม" เข้าคอลัมน์ขวา (เรียงตามลำดับใหม่นี้)

## 4. รวม "เนื้อหายอดนิยม" + "เนื้อหาล่าสุด" เป็น Tabs

- [x] 4.1 ครอบด้วย `<Tabs defaultValue="top">` ที่ระดับ `<Card>` (Card เดียวในคอลัมน์ซ้าย)
- [x] 4.2 ย้าย `TabsList` (2 `TabsTrigger`: `top` = เนื้อหายอดนิยม, `recent` = เนื้อหาล่าสุด) ไปที่ `CardHeader`
- [x] 4.3 วางตาราง `topContent` ใน `<TabsContent value="top">` และตาราง `recentItems` ใน `<TabsContent value="recent">` ภายใน `CardContent className="p-0"`

## 5. ตรวจสอบและทดสอบ

- [x] 5.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 5.2 ทดสอบบนเบราว์เซอร์ (จอกว้าง ≥1280px): แสดง master 2 คอลัมน์, คิวรออนุมัติบนสุดของคอลัมน์ขวา, Tabs สลับระหว่างยอดนิยม/ล่าสุดได้
- [ ] 5.3 ทดสอบจอแคบ (<1280px): ทุก section กลับเป็น stacked column เดียว ไม่ overflow
- [ ] 5.4 ยืนยัน count, ยอดวิว/ไลก์, และปุ่มลัดทั้งหมดทำงานเหมือนเดิม
