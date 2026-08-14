## Why

Widget "แพลตฟอร์ม" ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) แสดงชื่อแพลตฟอร์มเป็น Badge (ซ้ำกับแนวคิดเดิม) และยังไม่มี Logo Icon ประกอบ ทำให้ไม่สอดคล้องกับส่วน "สถานะช่องทาง" ที่เพิ่งปรับให้แสดง Logo Icon + ชื่อเพียงครั้งเดียว และการเรียงลำดับปัจจุบันเรียงเฉพาะตามจำนวนคอนเทนต์ (มาก→น้อย) โดยไม่มี tie-break ตามชื่อแพลตฟอร์มเมื่อจำนวนเท่ากัน

## What Changes

- ใน widget "แพลตฟอร์ม" แสดง Icon Logo (`PlatformIcon`) + ชื่อแพลตฟอร์มในรูปแบบเดียวกับส่วน "สถานะช่องทาง" (กล่องสีตามแพลตฟอร์ม + ชื่อ)
- แสดงชื่อแพลตฟอร์มเพียงครั้งเดียว — เอา Badge ที่แสดงชื่อซ้ำออก
- แสดงจำนวนคอนเทนต์ของแต่ละแพลตฟอร์มตามข้อมูลจริงในระบบ (`platformCounts` จาก `content_items`)
- เรียงลำดับแพลตฟอร์มตามจำนวนคอนเทนต์จากมากไปน้อยโดยอัตโนมัติ
- หากจำนวนเท่ากัน ให้เรียงตามชื่อแพลตฟอร์ม A–Z (ใช้ label ของแพลตฟอร์ม)

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ -->

### Modified Capabilities

- `content-dashboard-schedule-channels`: (เกี่ยวข้อง) — ปรับ widget "แพลตฟอร์ม" ให้ใช้รูปแบบเดียวกับ "สถานะช่องทาง" (logo + ชื่อ + จำนวน), เรียงตามจำนวนมาก→น้อย และชื่อ A–Z เมื่อเท่ากัน

## Impact

- `src/pages/ContentDashboardPage.tsx` — ปรับ widget "แพลตฟอร์ม": ใช้ `PlatformIcon` + `getPlatformColors`, เอา Badge ชื่อซ้ำออก, เรียง `sort((a, b) => count desc || name A-Z)`
- `src/components/content/PlatformIcon.tsx` + `src/lib/platformConfig.ts` — reuse ที่มีอยู่แล้ว (ไม่ต้องแก้)
- ไม่กระทบ API, DB, hooks, หรือ logic การคำนวณจำนวนใดๆ
