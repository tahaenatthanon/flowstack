## Why

หน้าแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) ปัจจุบันแสดงแค่การ์ดสถิติ 4 ใบ (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง) พร้อมสัดส่วนแพลตฟอร์มและรายการเนื้อหาล่าสุด ยังไม่มีภาพรวมของ "ความคืบหน้าการผลิต" (Work Progress), "เนื้อหายอดนิยม" (Top Content), "คิวรออนุมัติ", "กำหนดการโพสต์ถัดไป" และ "สถานะช่องทางเชื่อมต่อ" ซึ่งเป็นส่วนประกอบหลักของแดชบอร์ดตาม mockup (`mockup/index.php`) ทำให้ผู้ใช้ต้องเปิดหน้าอื่นเพื่อดูข้อมูลเหล่านี้ ทั้งที่ข้อมูลทั้งหมดมีอยู่ใน API เดิมแล้ว

## What Changes

- เพิ่ม Stat Cards "ยอดวิวรวม" และ "ยอดไลก์รวม" คำนวณจาก `views`/`likes` ใน `content_items` (ข้อมูลถูกส่งกลับมาจาก `GET /content-items.php` แล้ว)
- เพิ่ม widget **Work Progress** แสดงแถบ % ของแต่ละสถานะ (เผยแพร่แล้ว, รออนุมัติ, อนุมัติแล้ว, รอแก้ไข, ฉบับร่าง) พร้อมจำนวนชิ้นและยอดรวม
- เพิ่ม widget **Top Content** แสดงเนื้อหายอดนิยม 5 อันดับแรกเรียงตาม `views`
- เพิ่ม widget **คิวรออนุมัติ** แสดงรายการสถานะ `pending_approval` เรียงตาม `requested_at` พร้อมปุ่มลัดไปหน้า `/content-approval`
- เพิ่ม widget **กำหนดการโพสต์ถัดไป** แสดงรายการโพสต์ที่ `scheduled_date` อยู่ในอนาคต
- เพิ่ม widget **สถานะช่องทาง** แสดงช่องเชื่อมต่อ (active/inactive) จาก `brand-content.php?action=channels`
- จัด layout ใหม่เป็น grid หลายแถว รองรับ widget ทั้งหมดโดยไม่ต้องเปลี่ยน API หรือ database
- ใช้ UI/Design System เดิมของระบบ (shadcn-ui primitives + `STATUS_MAP`/`TYPE_MAP`/`PLATFORM_MAP` + Tailwind tokens) สำหรับ widget ใหม่ทั้งหมด โดยไม่สร้างรูปแบบ Component/สี/Typography/Spacing ใหม่ที่ขัดกับ Design System เดิม

## Capabilities

### New Capabilities
- `content-dashboard-stats`: Stat Cards ยอดวิวรวมและยอดไลก์รวม คำนวณจาก `views`/`likes` ของ `content_items`
- `content-dashboard-work-progress`: Widget แสดงแถบความคืบหน้าตามสถานะคอนเทนต์ (เผยแพร่แล้ว, รออนุมัติ, อนุมัติแล้ว, รอแก้ไข, ฉบับร่าง) พร้อมจำนวนชิ้นและยอดรวม
- `content-dashboard-top-content`: Widget แสดงเนื้อหายอดนิยม 5 อันดับแรกเรียงตามยอดวิว
- `content-dashboard-pending-queue`: Widget แสดงคิวรออนุมัติ (สถานะ `pending_approval`) เรียงตาม `requested_at` พร้อมปุ่มลัดไปหน้า `/content-approval`
- `content-dashboard-schedule-channels`: Widget แสดงกำหนดการโพสต์ถัดไป (จาก `scheduled_date`) และสถานะช่องทางเชื่อมต่อ (active/inactive)

### Modified Capabilities

_(ไม่มี — ไม่มีการเปลี่ยนแปลง requirement ของ capability เดิม)_

## Impact

- `src/pages/ContentDashboardPage.tsx` — ปรับปรุง UI หลัก: เพิ่ม Stat Cards วิว/ไลก์, Work Progress, Top Content, คิวรออนุมัติ, กำหนดการโพสต์ถัดไป และสถานะช่องทาง; จัด layout grid ใหม่
- `src/hooks/useContent.ts` — ใช้ hook ที่มีอยู่แล้ว (`useContentItems`, `useAllSchedules`, `usePublishChannels`) ไม่ต้องเพิ่ม hook ใหม่
- `src/components/content/types.ts` — อ้างอิง `STATUS_MAP`, `TYPE_MAP`, `PLATFORM_MAP`, `ContentSchedule`, `PublishChannel` ที่มีอยู่แล้ว (ไม่ต้องแก้)
- `src/components/ui/*` — ใช้เฉพาะ shadcn-ui primitives ที่มีอยู่แล้ว (`Card`, `Badge`, `Table`, `Button`, `Progress`) ไม่สร้าง component UI ใหม่
- **ไม่มีการแก้ไข API และ database** — ใช้ข้อมูลจาก `GET /content-items.php`, `brand-content.php?action=all-schedules`, `brand-content.php?action=channels` เดิม
