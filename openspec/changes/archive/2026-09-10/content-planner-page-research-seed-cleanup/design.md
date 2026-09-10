## Context

`useResearchRun.ts` มี `researchSeedTopic(sourceTopic, currentTopic)` เป็น single source of truth สำหรับ resolve Research seed (`source_topic` ก่อน trim แล้ว fallback ไป topic ปัจจุบันถ้าว่าง) พร้อม docblock กำกับไว้ชัดเจนว่า "ทุก Generation Entry Point ต้องเรียกฟังก์ชันนี้ ห้าม resolve seed เองซ้ำ" — แต่ `ContentPlannerPage.tsx` มี 2 จุด (`handleRequestAI`, `handleGenerate`) ที่ไม่ทำตามกฎนี้ เขียน fallback logic ของตัวเองแยกต่างหาก

ตรวจสอบ logic ทีละเงื่อนไขแล้ว (ดู "การเทียบ" ด้านล่าง) ยืนยันว่าทั้งสองจุดให้ผลลัพธ์เหมือนกับ `researchSeedTopic()` ทุกกรณีจริง ไม่ใช่แค่คล้ายกัน — การ swap จึงปลอดภัย 100%

### การเทียบ

```
researchSeedTopic(sourceTopic, currentTopic):
  (sourceTopic ?? '').trim() || (currentTopic ?? '').trim()

handleRequestAI (เดิม):
  (item.source_topic ?? '').trim() || data.topic.trim()
  → เหมือนกันทุกกรณี (data.topic เป็น string เสมอตาม type ที่ ContentCardDialog
    ส่งมา ไม่มีทาง null/undefined ในทางปฏิบัติ — การขาด `?? ''` ไม่มีผลจริง)

handleGenerate (เดิม):
  (item.source_topic ?? '').trim() || (item.topic || '').trim()
  → เหมือนกันทุกกรณี (`||` vs `??` ต่างกันเฉพาะเมื่อค่าซ้ายเป็น falsy ที่ไม่ใช่
    null/undefined เช่น '' — แต่ '' .trim() ก็ยังเป็น '' เหมือนกันทั้งสอง operator
    ผลลัพธ์จึงเหมือนกันทุกกรณีของ string input)
```

## Goals / Non-Goals

**Goals:**
- `handleRequestAI` และ `handleGenerate` เรียก `researchSeedTopic()` แทนการเขียน fallback logic เอง
- Research seed topic ที่ resolve ได้ต้องเหมือนเดิมทุกกรณี (verified — ดูด้านบน) ไม่มีการเปลี่ยนพฤติกรรมที่สังเกตได้

**Non-Goals:**
- ไม่แตะ `useResearchRun.ts`, `ContentCardDialog.tsx`, `QuickCreateDialog.tsx`, `BatchGenerateDialog.tsx` — ทุกจุดนั้นเรียก `researchSeedTopic()` อยู่แล้ว (ยืนยันจากการสำรวจก่อนหน้านี้ในเซสชัน)
- ไม่แก้ backend ใดๆ

## Decisions

### 1. Swap ตรงๆ ไม่เปลี่ยน error handling หรือ flow control รอบข้าง
`handleRequestAI` ยังคง early-return + toast เดิมเมื่อ seed ว่าง (`if (!seedTopic) { toast(...); return; }`) — แค่เปลี่ยนวิธีคำนวณ `seedTopic` เท่านั้น เช่นเดียวกับ `handleGenerate` ที่ยังคง `if (!itemTopic) { toast(...); continue; }` เดิมทุกประการ — การเปลี่ยนจำกัดอยู่แค่บรรทัดคำนวณค่า ไม่แตะ logic ที่ใช้ค่านั้นต่อ

### 2. เพิ่ม capability ใหม่เพื่อบันทึกกฎที่มีอยู่แล้วในโค้ดให้เป็น spec ที่ตรวจสอบได้
กฎ "ทุก Generation Entry Point ต้องเรียก researchSeedTopic()" มีอยู่แล้วในระดับ docblock ของโค้ด แต่ไม่เคยถูกบันทึกเป็น spec requirement มาก่อน — เพิ่มเป็น capability ใหม่ (`content-generation-research-seed-consistency`) เพื่อให้การเปลี่ยนแปลงในอนาคตตรวจสอบย้อนกลับกับ spec ได้ ไม่ใช่แค่ comment ในโค้ดที่อาจถูกมองข้าม

### 3. Verify ด้วย mocked test เท่านั้น — ไม่ live-test ผ่าน AI จริง
ต่างจาก change ก่อนหน้าในเซสชันนี้ที่ live-verify ผ่าน dev server จริง (ซึ่งเรียก AI provider จริงผ่าน OpenRouter และมีค่าใช้จ่าย) — change นี้ verify ด้วย test ใหม่ที่ mock `apiFetch` ทั้งหมด (แบบเดียวกับ `QuickCreateDialog.scheduleDate.test.tsx`/`BatchGenerateDialog.test.tsx`) แทน เพราะ:
- logic ที่เปลี่ยนพิสูจน์แล้วว่าเทียบเท่าทุกกรณีด้วยการวิเคราะห์ทีละเงื่อนไข (ดูด้านบน) — ไม่ต้องพึ่งการรันจริงเพื่อพิสูจน์ความถูกต้อง แค่ต้องพิสูจน์ว่า "สาย wiring ยังถูกต้อง" (เรียก endpoint ถูก, ส่ง field ถูก) ซึ่ง mocked test ทำได้แม่นยำกว่าอ่านผลจาก AI-generated content ด้วยตาเสียอีก
- mocked test เป็น deterministic และรันซ้ำได้ไม่จำกัดโดยไม่มีต้นทุนเพิ่ม ต่างจาก live AI generation ที่มีทั้งต้นทุน credit และความไม่แน่นอนของผลลัพธ์ (เนื้อหาที่ AI เขียนเปลี่ยนทุกครั้ง)

## Risks / Trade-offs

- **[Risk]** แทบไม่มีความเสี่ยง เพราะ logic ถูกพิสูจน์แล้วว่าเทียบเท่าทุกกรณีก่อนเขียนโค้ดจริง → **Mitigation**: เพิ่ม mocked test ใหม่ยืนยัน `seed_keyword` ที่ส่งไป Research ถูกต้องสำหรับทั้ง `handleRequestAI`/`handleGenerate` และรัน `pnpm test` ทั้งชุดยืนยันไม่มี regression — ไม่ใช้ live browser + AI จริงเพื่อประหยัด OpenRouter credit
- **[Risk]** Mocked test ไม่ครอบคลุม wiring ที่อาจพังเฉพาะตอนรันกับ backend จริง (เช่น response shape ไม่ตรงกับที่ mock สมมติไว้) → **Mitigation**: ยอมรับความเสี่ยงนี้เพราะ endpoint และ response shape ที่เกี่ยวข้อง (`content-research.php?action=fetch`, `generate-article`) ไม่ถูกแตะโดย change นี้เลย (เปลี่ยนแค่ค่าที่คำนวณก่อนส่งเข้า endpoint เดิมที่พิสูจน์ทำงานถูกต้องอยู่แล้วจาก change ก่อนหน้า) หากพบปัญหาจริงในการใช้งาน ค่อย live-verify เฉพาะจุดทีหลังได้

## Migration Plan

ไม่มี — เป็นการแก้ implementation ภายในไฟล์เดียว ไม่มี state หรือ data ที่ต้อง migrate
