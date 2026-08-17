## Why

Widget "สถานะช่องทาง" ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) แสดงชื่อช่องทางซ้ำ 2 ตำแหน่งในแต่ละรายการ: ชื่อช่องทาง (`ch.name`, เช่น "WordPress", "Facebook", "Line OA") และ Badge แพลตฟอร์ม (`PLATFORM_MAP[ch.platform].label`) ที่เป็นชื่อเดียวกัน — ทำให้ข้อมูลซ้ำซ้อนและรกตา

## What Changes

- ใน widget "สถานะช่องทาง" แสดงชื่อช่องทางเพียงครั้งเดียวในแต่ละรายการ (คง `ch.name`)
- เอา Badge ที่แสดงชื่อช่องทางซ้ำออก (เช่น WordPress, Facebook, Line OA, TikTok, Lotus Notes / Domino) — ลบ `PLATFORM_MAP[ch.platform].label` Badge ออกจากแถว channel
- เพิ่ม Logo Icon ของแต่ละช่องทาง (`PlatformIcon` ตาม `ch.platform`) ไว้ด้านหน้าชื่อช่องทาง — แสดงในกล่องสีตามแพลตฟอร์ม (bg/text จาก `getPlatformColors`)

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ -->

### Modified Capabilities

- `content-dashboard-schedule-channels`: widget "สถานะช่องทาง" แสดงชื่อช่องทางเพียงครั้งเดียว (ไม่มี Badge แพลตฟอร์มซ้ำ) พร้อม Logo Icon ด้านหน้าชื่อ

## Impact

- `src/pages/ContentDashboardPage.tsx` — ลบ `<Badge variant="outline" className={platform.color}>{platform.label}</Badge>` ออกจากแถว channel และเพิ่ม `<PlatformIcon platform={ch.platform} />` ด้านหน้าชื่อ (ในกล่องสี `getPlatformColors`)
- `src/components/content/PlatformIcon.tsx` + `src/lib/platformConfig.ts` — reuse ที่มีอยู่แล้ว (ไม่ต้องแก้)
- ไม่กระทบ API, DB, hooks, หรือ logic การคำนวณใดๆ
