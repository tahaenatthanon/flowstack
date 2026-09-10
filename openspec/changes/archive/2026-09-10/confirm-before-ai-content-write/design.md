## Context

`confirm-before-content-create` (archived 2026-09-10) เพิ่มกล่องยืนยันก่อนสร้างให้ `QuickCreateDialog` และ `ContentPlannerAI` panel แล้ว โดยใช้ `useConfirm()` global hook (`src/hooks/useConfirm.tsx`, ครอบด้วย `<ConfirmProvider>` ที่ `App.tsx`) แต่ยังมีจุดเรียก AI generation อีกจุดที่ตกหล่น: ปุ่ม "AI เขียนให้" ใน `ContentCardDialog.tsx`

**สิ่งที่ตรวจสอบแล้วจากการอ่านโค้ดจริง**: `ContentCardDialog` มี `handleAI()` ที่เรียก `runResearch(...)` (จาก `useResearchRun()` hook ของตัวเอง) โดยตรง ([ContentCardDialog.tsx:294-305](../../../src/components/content/ContentCardDialog.tsx)) — prop `onRequestAI` ที่รับเข้ามาจาก parent (`ContentPlannerPage.handleRequestAI`, `ContentListTab.handleRequestAI`) ถูก destructure ไว้แต่**ไม่เคยถูกเรียกใช้ที่ไหนในไฟล์เลย** (grep ยืนยันแล้ว) — ตรงกับคอมเมนต์ที่มีอยู่แล้วใน `ResearchEntryPoints.test.tsx`: "onRequestAI ไม่ได้ถูกเรียกจากปุ่มใดใน ContentCardDialog จริง (ปุ่ม 'AI เขียนให้' ในนั้นใช้ handler ภายในของตัวเอง)"

ผลคือ **จุดแก้ไขมีที่เดียว**: `ContentCardDialog.tsx` — ไม่ต้องแตะหน้าที่เรียกใช้มันเลย เพราะ component ถูก reuse ทั้งในปฏิทินคอนเทนต์และแท็บ "ผลงานทั้งหมด" แก้ที่ต้นทางครอบคลุมทั้งสองที่อัตโนมัติ

## Goals / Non-Goals

**Goals:**
- เพิ่มจังหวะยืนยันก่อนเรียก `runResearch()` จริงในปุ่ม "AI เขียนให้"
- ข้อความยืนยันต้องสรุปพอให้ตรวจสอบก่อนยิงจริงได้ (หัวข้อที่จะใช้เป็น Research seed, แพลตฟอร์มที่เลือก)
- กดยกเลิกต้องไม่มี side effect ใดๆ (ไม่เรียก `runResearch`, ไม่เปลี่ยน state ฟอร์ม)

**Non-Goals:**
- ไม่แตะปุ่ม "บันทึก" (save) เดิมของ `ContentCardDialog` — ไม่ใช้ AI ไม่ต้องมี confirm
- ไม่ทำความสะอาด dead prop `onRequestAI` และ handler ที่เกี่ยวข้อง (`ContentPlannerPage.handleRequestAI`, `ContentListTab.handleRequestAI`, `ContentDetailView.handleEditAI`) — เป็นงานคนละเรื่อง (dead code cleanup) นอกขอบเขต change นี้ แม้จะสังเกตเห็นระหว่างตรวจสอบก็ตาม
- ไม่ทำให้ "ยกเลิกระหว่างกำลังสร้าง" (หลังกดยืนยันแล้ว, `aiGenerating === true`) ทำงานได้จริง — เป็นเรื่องเดียวกับที่ระบุไว้ใน Non-Goals ของ `confirm-before-content-create` ยังรอ change แยกในอนาคต

## Decisions

### ใช้ `useConfirm()` แบบเดียวกับ change ก่อนหน้า
Pattern เดิมพิสูจน์แล้วว่าใช้งานได้ (`confirm-before-content-create`) — import `useConfirm` เข้า `ContentCardDialog.tsx`, ครอบ trigger ของ `handleAI` ด้วย wrapper function ใหม่ (เช่น `handleConfirmAndAI`) ที่เรียก `confirm({...})` ก่อน แล้วค่อยเรียก `handleAI()` เมื่อผลลัพธ์เป็น `true` — ไม่แก้ logic ภายใน `handleAI` เดิมเลย

### ข้อความยืนยัน
```
Title: ยืนยันให้ AI เขียนเนื้อหา
Description: หัวข้อ (Research seed): "{researchSeedTopic(existingItem.source_topic, topic)}"
             · แพลตฟอร์ม: {platforms.map(...).join(', ') || 'ยังไม่เลือก'}
             AI จะใช้เวลาประมาณ 30-60 วินาที
Confirm label: ยืนยันและให้ AI เขียน
```
ใช้ `researchSeedTopic()` เดียวกับที่ `handleAI` ใช้จริงตอนเรียก research (ไม่ใช่ `topic` เฉยๆ) เพื่อให้ข้อความในกล่องยืนยันตรงกับ seed ที่จะถูกใช้จริงเป๊ะ ไม่ทำให้ผู้ใช้เข้าใจผิดว่าจะ research จาก topic ที่แก้ไขในฟอร์ม

### ปุ่ม "AI เขียนให้" ยังคง disabled ด้วยเงื่อนไขเดิม
`disabled={!topic.trim() || aiGenerating}` ที่ [ContentCardDialog.tsx:837](../../../src/components/content/ContentCardDialog.tsx) ไม่เปลี่ยน — การเช็คว่ามี `existingItem?.id` อยู่แล้วภายใน `handleAI`/wrapper ก่อนเปิด confirm เหมือน guard เดิม

## Risks / Trade-offs

- **[Risk]** ผู้ใช้ที่คุ้นเคยกับ flow เดิม (กด "AI เขียนให้" แล้วรอผลทันที) ต้องกดเพิ่มอีกครั้งโดยไม่คาดคิด → **Mitigation**: เหมือน change ก่อนหน้า ข้อความกระชับ ปุ่มยืนยันชัดเจน
- **[Risk]** ปุ่มนี้มักถูกกดซ้ำๆ ระหว่างแก้ไขเนื้อหา (regenerate หลายรอบ) มากกว่า Quick Create ที่กดครั้งเดียว → เพิ่ม friction สะสมมากกว่า → **Mitigation**: ยอมรับ trade-off นี้เพราะเป้าหมายคือกันกดพลาด/เสีย credit โดยไม่ตั้งใจ ซึ่งสำคัญกว่า convenience ของการ regenerate รัว ๆ — ถ้าพบว่ารบกวน workflow จริงในทางปฏิบัติค่อยพิจารณาลดระดับ (เช่น skip confirm ถ้าเพิ่ง confirm ไปไม่เกิน N วินาที) เป็น change แยกในอนาคต ไม่ทำล่วงหน้าตอนนี้

## Migration Plan

Frontend-only change ไม่มี migration/backend/API — deploy พร้อม build ปกติ

## Open Questions

(ไม่มี)
