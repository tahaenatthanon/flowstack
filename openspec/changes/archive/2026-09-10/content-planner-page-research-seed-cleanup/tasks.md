## 1. Swap to researchSeedTopic()

- [x] 1.1 แก้ `src/pages/ContentPlannerPage.tsx`: เพิ่ม `researchSeedTopic` เข้า import จาก `@/hooks/useResearchRun` (บรรทัด import เดิมมีแค่ `useResearchRun`)
- [x] 1.2 `handleRequestAI`: เปลี่ยน `const seedTopic = (item.source_topic ?? '').trim() || data.topic.trim();` เป็น `const seedTopic = researchSeedTopic(item.source_topic, data.topic);` — ไม่แตะ logic อื่นในฟังก์ชัน (early-return/toast เดิมคงไว้)
- [x] 1.3 `handleGenerate`: เปลี่ยน `const itemTopic = (item.source_topic ?? '').trim() || (item.topic || '').trim();` เป็น `const itemTopic = researchSeedTopic(item.source_topic, item.topic);` — ไม่แตะ logic อื่นในลูป

## 2. Tests (mock apiFetch ทั้งหมด — ไม่มีการเรียก AI/OpenRouter จริง ไม่เสีย credit)

- [x] 2.1 เพิ่ม `src/__tests__/content/ContentPlannerPage.researchSeed.test.tsx` — mock `@/lib/api` (`apiFetch`) ทั้งหมดตามแบบที่ `QuickCreateDialog.scheduleDate.test.tsx`/`BatchGenerateDialog.test.tsx` ทำอยู่แล้ว (ครอบคลุม endpoint ที่ hook ต่างๆ ของหน้านี้เรียก: plans, skills, contexts, triggers, channels, ai-settings, analytics, generate-plan, plan-item-date, content-research fetch/analyze, generate-article) — ไม่มี request ไหนแตะ backend จริงเลย — พบระหว่างเขียน test ว่า `handleRequestAI` อ่าน `editingItem` ตรงๆ (ไม่ใช่ `selectedDateItems[0]`) จึงต้อง trigger ผ่าน List view's `onEditItem` เท่านั้น ไม่ใช่ Calendar's `onDateClick`
- [x] 2.2 Test case สำหรับ `handleRequestAI` (3 cases): มี source_topic ใช้ source_topic, ไม่มี source_topic fallback ไป topic จาก dialog, ไม่มีทั้งคู่แจ้ง toast ไม่เรียก Research — ยืนยัน `seed_keyword` ตรงกับพฤติกรรมเดิมก่อน swap ทุกกรณี
- [x] 2.3 Test case สำหรับ `handleGenerate` (2 cases): item หลายตัวบางตัวมี/ไม่มี source_topic ยืนยัน `seed_keyword` ต่อ item ถูกต้องตามกติกาเดิม + item ที่ไม่มีทั้งคู่ถูกข้ามไม่เรียก Research
- [x] 2.4 รัน `pnpm lint` ให้ผ่าน
- [x] 2.5 รัน `pnpm test` ให้ผ่านทั้งหมด (รวม test ใหม่และ regression suite เดิม)
