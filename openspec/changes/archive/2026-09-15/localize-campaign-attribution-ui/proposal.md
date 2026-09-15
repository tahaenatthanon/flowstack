## Why

หน้า "แคมเปญอีเมล" (`MarketingPage.tsx`) และแท็บย่อย "Attribution" (`AttributionTab.tsx`) ยังมีคำอังกฤษหลุดอยู่จำนวนมาก ขัดกับกฎ CLAUDE.md ที่บังคับให้ข้อความที่ผู้ใช้เห็นต้องเป็นภาษาไทยทั้งหมด — ตั้งแต่ชื่อแท็บ ("Templates", "Attribution"), หัวข้อ ("Email Templates", "Marketing Attribution"), ไปจนถึงหัวตารางเกือบทั้งหมดในแท็บ Attribution ("Leads", "Won", "Win Rate", "Revenue", "Opens", "Clicks" ฯลฯ) นอกจากนี้ยังมีหัวคอลัมน์หนึ่งจุดที่ป้ายกำกับผิดความหมาย ("อีเมล" ที่จริงคือจำนวนอีเมลที่ส่ง ไม่ใช่ที่อยู่อีเมล) และคอลัมน์ "Revenue Bar" ที่เป็นแท่งแสดงสัดส่วนเปล่าๆ ไม่มีตัวเลขให้อ่าน

## What Changes

- แก้หัวคอลัมน์ที่ป้ายกำกับผิดความหมายในแท็บ "ลูกค้า" ของ `MarketingPage.tsx` จาก "อีเมล" เป็น "ส่งอีเมลแล้ว"
- แปลป้ายแท็บและข้อความที่เป็นอังกฤษใน `MarketingPage.tsx`: แท็บ "Templates" → "เทมเพลต", หัวข้อ "Email Templates" → "เทมเพลตอีเมล", แท็บ "Attribution" → "แอตทริบิวชัน" (ทับศัพท์), ข้อความ/ปุ่มที่มีคำว่า "template" ปนอยู่ → เป็นไทยทั้งหมด
- แปลข้อความภาษาอังกฤษเกือบทั้งหมดใน `AttributionTab.tsx` เป็นไทย (หัวข้อ component, การ์ด KPI 4 ใบ, หัวข้อกราฟ/ตาราง 2 ตัว, badge, chart tooltip) โดยอิงคำศัพท์ที่มีบรรทัดฐานอยู่แล้วในระบบ (เช่น "อัตราชนะ" จาก `HomePage.tsx`, "ดีล" จาก `SalesPage.tsx`, คงคำว่า "Ticket" ไว้ตามที่ `SupportPage.tsx` ทำอยู่แล้ว)
- **เพิ่มฟีเจอร์เล็กน้อย:** คอลัมน์สัดส่วนรายได้ (เดิมชื่อ "Revenue Bar" เป็นแท่งเปล่าไม่มีตัวเลข) ให้แสดง % สัดส่วนเทียบกับแหล่งที่มาที่มีรายได้สูงสุดกำกับบนแท่งด้วย ไม่ใช่แค่แท่งภาพอย่างเดียว
- **ไม่เปลี่ยน** `src/lib/labels.ts` (`STAGE_LABELS`) หรือหน้าที่ใช้ค่านั้นอยู่ (`SalesPage.tsx`, `CreateOpportunityDialog.tsx`, `ImpactOSPage.tsx`) — คำแปลใน `AttributionTab.tsx` ครั้งนี้เป็น string อิสระเฉพาะไฟล์นี้ ไม่ใช่การแก้ที่ต้นตอร่วม (ดูเหตุผลใน design.md)

## Capabilities

### New Capabilities
- `email-campaign-page-thai-labels`: กำหนดให้ป้ายแท็บ, หัวข้อ, และหัวคอลัมน์บนหน้า "แคมเปญอีเมล" (`MarketingPage.tsx`) เป็นภาษาไทยทั้งหมดและสื่อความหมายตรงกับข้อมูลที่แสดง
- `marketing-attribution-report-localization`: กำหนดให้แท็บ "Attribution" (`AttributionTab.tsx`) แสดงผลเป็นภาษาไทยทั้งหมด (ยกเว้นคำที่ไม่มีบรรทัดฐานแปลในระบบอย่าง "Ticket") และคอลัมน์สัดส่วนรายได้ต้องมีตัวเลข % กำกับ ไม่ใช่แท่งภาพเปล่า

### Modified Capabilities
(ไม่มี — ยังไม่มี spec เดิมที่ครอบคลุมสองไฟล์นี้)

## Impact

- **Frontend:** `src/pages/MarketingPage.tsx` (แก้ label หลายจุด, ไม่กระทบ logic/state), `src/components/marketing/AttributionTab.tsx` (แก้ label เกือบทั้งไฟล์ + เพิ่มการคำนวณ/แสดง % บนคอลัมน์สัดส่วนรายได้)
- **ไม่มีการเปลี่ยนแปลง API/backend** — `api/marketing-attribution.php` ส่งข้อมูล `won_value` มาอยู่แล้ว การคำนวณ % สัดส่วนทำได้ฝั่ง client จากข้อมูลที่มีอยู่แล้ว (เหมือนที่คำนวณความกว้างแท่ง `barPct` อยู่แล้วในปัจจุบัน)
- **ไม่มีการเปลี่ยนแปลง database schema**
- **ไม่กระทบ** `src/lib/labels.ts`, `SalesPage.tsx`, `CreateOpportunityDialog.tsx`, `ImpactOSPage.tsx` — ยังคงใช้ label ภาษาอังกฤษเดิมสำหรับ stage ของดีล (out of scope โดยตั้งใจ)
