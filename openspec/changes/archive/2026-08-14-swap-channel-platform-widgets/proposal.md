## Why

Widget "แพลตฟอร์ม" ควรปรากฏก่อน "สถานะช่องทาง" เพราะเป็นข้อมูลสรุป (จำนวนคอนเทนต์รายแพลตฟอร์ม) ที่ผู้ใช้ต้องการเห็นก่อนรายละเอียดการเชื่อมต่อแต่ละช่องทาง ทำให้ลำดับการอ่านข้อมูลเป็นไปตามความสำคัญจากภาพรวมไปยังรายละเอียด

## What Changes

- สลับตำแหน่ง Widget "สถานะช่องทาง" กับ Widget "แพลตฟอร์ม" ในหน้าคอนเทนต์แดชบอร์ด
- Widget "แพลตฟอร์ม" ย้ายไปอยู่ในตำแหน่งเดิมของ "สถานะช่องทาง" (ถัดจาก "กำหนดการโพสต์ถัดไป")
- Widget "สถานะช่องทาง" ย้ายไปอยู่ในตำแหน่งเดิมของ "แพลตฟอร์ม" (เป็น widget สุดท้ายของคอลัมน์)
- เพิ่มไอคอนสำหรับแพลตฟอร์ม YouTube (`youtube`) ให้แสดง logo, ชื่อ และสีได้เหมือนแพลตฟอร์มอื่น

## Capabilities

### New Capabilities

_ไม่มี — ไม่ได้เพิ่ม capability ใหม่_

### Modified Capabilities

- `content-dashboard-schedule-channels`: เปลี่ยนลำดับการแสดงผลของ widget "สถานะช่องทาง" และ "แพลตฟอร์ม" ในแดชบอร์ด และเพิ่มไอคอนสำหรับแพลตฟอร์ม YouTube

## Impact

- `src/pages/ContentDashboardPage.tsx`: สลับลำดับ JSX ของ Card "สถานะช่องทาง" กับ Card "แพลตฟอร์ม"
- `src/components/content/PlatformIcon.tsx`: เพิ่ม case `youtube` (SVG ไอคอน YouTube)
- `src/components/content/types.ts`: เพิ่ม `youtube` ใน `PLATFORM_MAP`
- `src/lib/platformConfig.ts`: เพิ่ม `youtube` ใน `PLATFORM_COLORS` และ `PLATFORM_LABELS`
- ไม่มีการแก้ API, database, หรือ dependency ใด ๆ
