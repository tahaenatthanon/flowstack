## Why

`ContentPlannerPage.tsx` มี 2 จุด (`handleRequestAI`, `handleGenerate`) ที่เขียน fallback logic ของตัวเองเพื่อ resolve Research seed topic (`source_topic` ก่อน แล้ว fallback ไป topic ปัจจุบัน) แทนที่จะเรียก `researchSeedTopic()` ที่มีอยู่แล้วใน `useResearchRun.ts` — ทั้งที่ docblock ของ `researchSeedTopic()` เขียนไว้ชัดเจนว่า "ทุก Generation Entry Point ต้องเรียกฟังก์ชันนี้ ห้าม resolve seed เองซ้ำ" ตรวจสอบแล้วว่า logic ทั้งสองจุดเทียบเท่า `researchSeedTopic()` ทุกกรณีจริง (ไม่ใช่แค่คล้ายกัน) การ swap จึงเป็น cleanup ล้วนๆ ไม่เปลี่ยนพฤติกรรม แต่ลดความเสี่ยงที่โค้ดสองจุดนี้จะ drift ออกจากกฎเดียวกันในอนาคตถ้ามีคนแก้แค่จุดเดียว

## What Changes

- `ContentPlannerPage.tsx`: `handleRequestAI` เปลี่ยนจาก `(item.source_topic ?? '').trim() || data.topic.trim()` เป็นเรียก `researchSeedTopic(item.source_topic, data.topic)`
- `ContentPlannerPage.tsx`: `handleGenerate` เปลี่ยนจาก `(item.source_topic ?? '').trim() || (item.topic || '').trim()` เป็นเรียก `researchSeedTopic(item.source_topic, item.topic)`
- เพิ่ม `researchSeedTopic` เข้า import จาก `@/hooks/useResearchRun` (ปัจจุบัน import แค่ `useResearchRun`)
- ไม่มี **BREAKING** change — พิสูจน์แล้วว่า logic เดิมและ `researchSeedTopic()` ให้ผลลัพธ์เหมือนกันทุกกรณี (ดู design.md)

## Capabilities

### New Capabilities

- `content-generation-research-seed-consistency`: บังคับให้ทุก Generation Entry Point ที่ resolve Research seed topic ต้องเรียก `researchSeedTopic()` แทนการเขียน fallback logic ของตัวเอง (ยกระดับกฎที่มีอยู่แล้วในระดับ docblock ของโค้ดให้เป็น spec requirement ที่ตรวจสอบได้)

### Modified Capabilities

(ไม่มี — ไม่เปลี่ยน requirement ของ `content-generation-research` เพราะ Mandatory Research flow และผลลัพธ์ของ seed resolution เหมือนเดิมทุกประการ)

## Impact

- `src/pages/ContentPlannerPage.tsx` เท่านั้น — ไม่แตะ `useResearchRun.ts`, `ContentCardDialog.tsx`, `QuickCreateDialog.tsx`, `BatchGenerateDialog.tsx`, หรือ backend ใดๆ
- ไม่เปลี่ยนพฤติกรรมที่สังเกตได้จาก UI — seed topic ที่ส่งเข้า Research เหมือนเดิมทุกกรณี (พิสูจน์ด้วยการเทียบ logic ทีละเงื่อนไขแล้วในขั้น explore)
