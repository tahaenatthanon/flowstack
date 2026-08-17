## Context

หน้าคอนเทนต์แดชบอร์ด (`src/pages/ContentDashboardPage.tsx`) แสดง widget 3 ตัวในคอลัมน์ขวา (หรือคอลัมน์เดียวบนมือถือ) ตามลำดับปัจจุบัน:

1. กำหนดการโพสต์ถัดไป (Upcoming Schedule)
2. สถานะช่องทาง (Channels)
3. แพลตฟอร์ม (Platform Distribution)

ผู้ใช้ต้องการให้ "แพลตฟอร์ม" ขึ้นก่อน "สถานะช่องทาง" เพราะข้อมูลจำนวนคอนเทนต์รายแพลตฟอร์มเป็นภาพรวมที่ควรเห็นก่อนรายละเอียดการเชื่อมต่อรายช่องทาง

## Goals / Non-Goals

**Goals:**
- สลับตำแหน่งเฉพาะ JSX ของ Card "สถานะช่องทาง" กับ Card "แพลตฟอร์ม" เท่านั้น
- คงลำดับของ "กำหนดการโพสต์ถัดไป" ไว้ที่ตำแหน่งแรกเหมือนเดิม
- เพิ่มไอคอนสำหรับแพลตฟอร์ม YouTube ให้แสดง logo/ชื่อ/สีได้ครบถ้วน

**Non-Goals:**
- ไม่แก้ข้อมูล, ตรรกะการคำนวณ, hook, หรือ API ใด ๆ
- ไม่แก้สไตล์/เนื้อหาภายใน widget

## Decisions

- **สลับ block JSX โดยตรง** — ย้าย block `{/* Channels */}` ไปไว้หลัง block `{/* Platform Distribution */}` (หรือย้าย platform ขึ้นก่อน channels) แทนการเปลี่ยน CSS order เพราะเป็นวิธีที่ชัดเจน ตรวจสอบง่าย และไม่สร้าง side effect
- **คง widget "กำหนดการโพสต์ถัดไป" ไว้ที่แรก** — ไม่มี requirement ให้ขยับ จึงไม่แตะ
- **เพิ่มไอคอน YouTube** — เพิ่ม case `youtube` ใน `PlatformIcon.tsx` (SVG กล่องมุมมน + ปุ่มเล่นสามเหลี่ยม), เพิ่ม `youtube` ใน `PLATFORM_MAP` (`types.ts`, label "YouTube" สีแดง), และเพิ่ม `youtube` ใน `PLATFORM_COLORS`/`PLATFORM_LABELS` (`platformConfig.ts`) เพื่อให้ widget "แพลตฟอร์ม" และ "สถานะช่องทาง" แสดง logo, ชื่อ และจำนวนคอนเทนต์ได้ครบถ้วน

## Risks / Trade-offs

- [ความเสี่ยงจากการย้าย block ผิดช่วง] → ใช้ comment marker `{/* Channels */}` และ `{/* Platform Distribution */}` เป็นจุดอ้างอิงในการย้าย และตรวจสอบผลด้วย lint/build

## Migration Plan

ไม่มี — เป็นการจัดเรียง UI ล้วน ๆ หลัง deploy หน้าจะแสดงผลใหม่ทันที
