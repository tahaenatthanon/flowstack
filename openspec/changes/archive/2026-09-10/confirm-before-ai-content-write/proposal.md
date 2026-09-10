## Why

การเปลี่ยน `confirm-before-content-create` (archived 2026-09-10) เพิ่มกล่องยืนยันก่อนสร้างให้ Quick Create และ Content Planner AI panel แล้ว แต่ยังมีจุดเรียก AI generation จริงอีกจุดหนึ่งที่ตกหล่นไปตอนสโคปรอบแรก: ปุ่ม **"AI เขียนให้"** ใน `ContentCardDialog` — ใช้ flow เดียวกัน (Research: fetch → analyze → generate-article) เสียเวลา 30-60 วินาทีและ credit จริงเหมือนกัน แต่กดแล้วยิงทันทีไม่มีกล่องยืนยันเลย ปุ่มนี้ใช้งานได้จริงทั้งจากปฏิทินคอนเทนต์ (`/content-planner`) และแท็บ "ผลงานทั้งหมด" (`/content`)

## What Changes

- เพิ่มกล่องยืนยันก่อนเรียก `runResearch()` จริงในปุ่ม "AI เขียนให้" ของ `ContentCardDialog` — สรุปหัวข้อที่จะใช้เป็น Research seed และแพลตฟอร์มที่เลือกไว้ ก่อนเริ่มจริง ผ่าน `useConfirm()` เดียวกับที่ใช้ใน `confirm-before-content-create`
- กดยกเลิกที่กล่องยืนยัน = ไม่เรียก `runResearch()` ฟอร์มเดิมยังอยู่ครบให้แก้ไขต่อได้
- **ไม่แตะ** ปุ่ม "บันทึก" (save) ของ `ContentCardDialog` เดิม (ไม่ใช้ AI ไม่ต้องมี confirm) และไม่แตะ prop `onRequestAI` (เป็น dead prop อยู่แล้ว ปุ่ม "AI เขียนให้" จริงเรียก `runResearch()` ภายในตัวเองโดยตรง ไม่ผ่าน prop นี้ — ยืนยันจากคอมเมนต์ใน `ResearchEntryPoints.test.tsx` และอ่านโค้ดจริงแล้ว)

## Capabilities

### New Capabilities
(ไม่มี — ใช้ capability เดิมที่มีอยู่แล้ว)

### Modified Capabilities
- `content-generation-confirmation`: เพิ่ม requirement ใหม่ครอบคลุมปุ่ม "AI เขียนให้" ใน `ContentCardDialog` เข้าไปในสเปคเดิมที่มีอยู่แล้ว (`openspec/specs/content-generation-confirmation/spec.md`) ซึ่งตอนนี้ครอบแค่ Quick Create กับ Content Planner AI panel

## Impact

- **Affected files**: `src/components/content/ContentCardDialog.tsx` เท่านั้น — เพิ่ม `useConfirm()` คั่นก่อนเรียก `runResearch()` ใน `handleAI`
- **ไม่แตะ backend/API** — เป็น frontend-only change ไม่มี migration ไม่มี endpoint ใหม่
- **ไม่แตะ** `ContentPlannerPage.tsx`, `ContentListTab.tsx`, `ContentDetailView.tsx` — handler `handleRequestAI`/`handleEditAI` ที่ไฟล์เหล่านี้ส่งเข้า prop `onRequestAI` เป็น dead code อยู่แล้ว (ไม่เคยถูกเรียกจริงจากปุ่มไหนใน `ContentCardDialog`) ไม่อยู่ในขอบเขตนี้
- เนื่องจาก `ContentCardDialog` ถูกใช้ซ้ำ 2 จุด (ปฏิทินคอนเทนต์ + ผลงานทั้งหมด) แก้ที่เดียวครอบคลุมทั้ง 2 จุดอัตโนมัติ
