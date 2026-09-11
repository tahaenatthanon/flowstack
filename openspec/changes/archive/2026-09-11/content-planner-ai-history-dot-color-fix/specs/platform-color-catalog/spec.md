## MODIFIED Requirements

### Requirement: แหล่งข้อมูล label/สี/ไอคอนของแพลตฟอร์มต้องมีเพียงแหล่งเดียว
`src/lib/platformConfig.ts` SHALL เป็นแหล่งข้อมูลเดียวสำหรับ label, hex color (bg/text/border), และ Tailwind color class (รวม dark-mode variant) ของแต่ละแพลตฟอร์ม ห้ามมีการนิยาม label หรือสีของแพลตฟอร์มเดียวกันซ้ำในไฟล์อื่นนอกเหนือจาก variant ที่ตั้งใจแยกไว้ชัดเจน (เช่น badge สีทึบใน `ContentVideoView.tsx`)

#### Scenario: `PLATFORM_MAP` และ `getPlatformColors()` ให้ค่าตรงกัน
- **WHEN** เรียก `PLATFORM_MAP['facebook'].color` (Tailwind class) และ `getPlatformColors('facebook')` (hex) สำหรับแพลตฟอร์มเดียวกัน
- **THEN** ทั้งสองค่าอ้างอิงจากรายการสีชุดเดียวกันใน `platformConfig.ts` (hue/เฉดตรงกัน ไม่ใช่นิยามแยกกันคนละที่)

#### Scenario: `PLATFORM_MAP` ยังใช้งานได้จากทุกจุดที่ import เดิม
- **WHEN** ไฟล์ใดๆ ที่เคย `import { PLATFORM_MAP } from '@/components/content/types'` หรือ `import { getPlatformColors } from '@/lib/platformConfig'` อยู่ก่อนการเปลี่ยนแปลงนี้
- **THEN** ไฟล์นั้นยังคง import และเรียกใช้ได้โดยไม่ต้องแก้ import path หรือ signature ใดๆ

#### Scenario: ContentPlannerAI ไม่มีการนิยามสีแพลตฟอร์มซ้ำ
- **WHEN** `ContentPlannerAI.tsx` แสดงจุดสีข้าง item ในสไลด์บาร์ "แผนล่าสุด"
- **THEN** สีของจุดมาจาก `getPlatformColors()` (อ้างอิง `PLATFORM_CATALOG`) โดยใช้แพลตฟอร์มแรกของ item ที่ parse แล้ว ไม่มี ternary chain สีของตัวเองที่นิยามชื่อแพลตฟอร์ม/สีซ้ำ

#### Scenario: item หลายแพลตฟอร์มได้สีของแพลตฟอร์มแรก ไม่ใช่สีเทา default
- **WHEN** item ใน `ContentPlannerAI.tsx` มีหลายแพลตฟอร์ม (เช่น `platforms=["facebook","linkedin"]`)
- **THEN** จุดสีแสดงสีของ facebook (แพลตฟอร์มแรก) ไม่ใช่สีเทา default

#### Scenario: item ไม่มีแพลตฟอร์มยังคงได้สีเทา default
- **WHEN** item ใน `ContentPlannerAI.tsx` ไม่มีแพลตฟอร์มเลย (parse ได้ array ว่าง)
- **THEN** จุดสีแสดงสีเทา default เหมือนพฤติกรรมเดิมก่อนการเปลี่ยนแปลงนี้
