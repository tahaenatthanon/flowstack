## Why

แดชบอร์ดคอนเทนต์ปัจจุบันมี widget "เนื้อหายอดนิยม" และ "เนื้อหาล่าสุด" รวมกันใน Card เดียวผ่าน `Tabs` ทำให้คอลัมน์ซ้ายสูงกว่าคอลัมน์ขวาอย่างไม่สมดุล และข้อมูล "เนื้อหายอดนิยม" (Top Content) ไม่ได้ถูกใช้งานอย่างคุ้มค่า จึงควรนำออกและให้ "เนื้อหาล่าสุด" เป็นตารางหลักแทน เพื่อให้เลย์เอาต์โดยรวมสมดุลและเป็นระเบียบ

## What Changes

- ลบ widget "เนื้อหายอดนิยม" (Top Content) ออกจากแดชบอร์ดคอนเทนต์ทั้งหมด
- แทนที่ Card ที่ใช้ `Tabs` (เนื้อหายอดนิยม/เนื้อหาล่าสุด) ด้วย Card เดียวที่แสดง "เนื้อหาล่าสุด" (Recent Content) เป็นตารางหลัก
- ปรับระยะห่างและขนาด Column ของตาราง "เนื้อหาล่าสุด" ให้สอดคล้องกับเลย์เอาต์แดชบอร์ด
- ปรับขนาดและระยะห่างด้านบน–ด้านล่างของ Section ฝั่งซ้ายและฝั่งขวาให้เท่ากัน เพื่อให้เลย์เอาต์โดยรวมสมดุล

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `content-dashboard-top-content`: ยกเลิก requirement ของ widget "เนื้อหายอดนิยม" (Top Content) ออกจากแดชบอร์ดคอนเทนต์ (ลบ widget และ Tabs "เนื้อหายอดนิยม")
- `content-dashboard-layout`: เปลี่ยน Card ที่มี `Tabs` เป็น Card เดียวแสดง "เนื้อหาล่าสุด" เป็นตารางหลัก และปรับระยะ/ขนาด Column ของตาราง รวมถึงปรับความสมดุลของ Section ฝั่งซ้าย–ขวา

## Impact

- `src/pages/ContentDashboardPage.tsx`: ไฟล์หลักที่ถูกแก้ (ลบ `topContent`, `Tabs`/`TabsContent value="top"`, ปรับโครงสร้าง Card และ grid/spacing)
- ไม่กระทบ API, database schema, หรือ dependency
- อิมพอร์ตที่เลิกใช้: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, และ icon `TrendingUp` (ถ้าไม่ได้ใช้ที่อื่นในไฟล์)
