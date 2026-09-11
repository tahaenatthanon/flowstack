# platform-color-catalog Specification

## Purpose

ให้ label, สี (hex และ Tailwind class พร้อม dark mode), และไอคอนของแพลตฟอร์มเผยแพร่คอนเทนต์ (Facebook, Instagram, TikTok, Line OA, LinkedIn, Twitter/X, WordPress, Wix, Custom API, Lotus Notes/Domino, YouTube) มีแหล่งข้อมูลจริงเพียงแหล่งเดียวใน `src/lib/platformConfig.ts` ป้องกันไม่ให้สี/label ของแพลตฟอร์มเดียวกันถูกนิยามซ้ำแล้วดริฟท์ออกจากกันในหลายไฟล์เหมือนที่เคยเกิดขึ้น (`PLATFORM_MAP` ใน `types.ts` vs `getPlatformColors()` เดิมให้ค่าไม่ตรงกันเป๊ะ และไม่มี dark mode)

## Requirements

### Requirement: แหล่งข้อมูล label/สี/ไอคอนของแพลตฟอร์มต้องมีเพียงแหล่งเดียว
`src/lib/platformConfig.ts` SHALL เป็นแหล่งข้อมูลเดียวสำหรับ label, hex color (bg/text/border), และ Tailwind color class (รวม dark-mode variant) ของแต่ละแพลตฟอร์ม ห้ามมีการนิยาม label หรือสีของแพลตฟอร์มเดียวกันซ้ำในไฟล์อื่นนอกเหนือจาก variant ที่ตั้งใจแยกไว้ชัดเจน (เช่น badge สีทึบใน `ContentVideoView.tsx`)

#### Scenario: `PLATFORM_MAP` และ `getPlatformColors()` ให้ค่าตรงกัน
- **WHEN** เรียก `PLATFORM_MAP['facebook'].color` (Tailwind class) และ `getPlatformColors('facebook')` (hex) สำหรับแพลตฟอร์มเดียวกัน
- **THEN** ทั้งสองค่าอ้างอิงจากรายการสีชุดเดียวกันใน `platformConfig.ts` (hue/เฉดตรงกัน ไม่ใช่นิยามแยกกันคนละที่)

#### Scenario: `PLATFORM_MAP` ยังใช้งานได้จากทุกจุดที่ import เดิม
- **WHEN** ไฟล์ใดๆ ที่เคย `import { PLATFORM_MAP } from '@/components/content/types'` หรือ `import { getPlatformColors } from '@/lib/platformConfig'` อยู่ก่อนการเปลี่ยนแปลงนี้
- **THEN** ไฟล์นั้นยังคง import และเรียกใช้ได้โดยไม่ต้องแก้ import path หรือ signature ใดๆ

### Requirement: getPlatformColors ต้องรองรับ dark mode
`getPlatformColors()` SHALL คืนค่าสีที่มีคู่สำหรับ dark mode ให้ผู้เรียกเลือกใช้ได้ (ต่างจากพฤติกรรมเดิมที่มีแค่ค่าเดียวใช้ทุกธีม)

#### Scenario: เรียก getPlatformColors ได้ค่า dark mode
- **WHEN** โค้ดเรียก `getPlatformColors('facebook')`
- **THEN** ผลลัพธ์มี field สำหรับสี dark-mode (ไม่ใช่ `undefined` หรือค่าเดียวกับ light mode เสมอ)

### Requirement: AnalyticsSocialTab ต้องใช้ label จาก catalog กลางแทนการนิยามซ้ำ
`AnalyticsSocialTab.tsx` SHALL ไม่มี `PLATFORM_LABELS` ของตัวเอง และ SHALL เรียก label จาก catalog กลางแทน

#### Scenario: แสดง label แพลตฟอร์มใน Analytics Social Tab
- **WHEN** `AnalyticsSocialTab` ต้องแสดง label ของแพลตฟอร์ม (เช่น facebook, instagram)
- **THEN** label มาจาก catalog กลางใน `platformConfig.ts` ไม่ใช่ map ที่นิยามแยกในไฟล์นี้เอง

### Requirement: ContentVideoView คงสีของตัวเองแยกจาก catalog กลางโดยเจตนา
`ContentVideoView.tsx`'s `PLATFORM_COLORS` (โทนสีทึบสำหรับ badge ทับวิดีโอ) SHALL ไม่ถูกยุบรวมเข้า catalog กลาง เพราะเป็น visual variant ที่ตั้งใจแยกจากโทนสีอ่อนที่ใช้ในที่อื่น

#### Scenario: badge บนวิดีโอยังใช้โทนสีทึบเดิม
- **WHEN** `ContentVideoView` แสดง badge แพลตฟอร์มทับบนวิดีโอ
- **THEN** สียังเป็นโทนทึบเข้มตามที่กำหนดไว้ในไฟล์นั้นเอง ไม่เปลี่ยนไปใช้โทนอ่อนจาก catalog กลาง
