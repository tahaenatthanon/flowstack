## Context

`ContentCardDialog.tsx` แก้ไข content ทุกฟิลด์ผ่าน local component state ที่ seed จาก `existingItem` ตอนเปิด dialog (`topic`, `platforms`, `caption`, `articleHtml`, `seoFields`, ฯลฯ) แล้วรวมส่งครั้งเดียวตอนกด "บันทึก" (`handleSave` → `onSave(...)` → `onOpenChange(false)`) — ยกเว้น 2 จุดที่ persist ทันทีแยกจากปุ่มบันทึกหลัก: (1) `video_prompt` ใน `SceneCards.tsx` มีปุ่ม "บันทึก Video Prompt" ของตัวเอง เรียก `update-scene` ตรงๆ และ (2) "AI เขียน Video Prompt" เรียก `generate-scene-video-prompt` ซึ่ง persist ทันทีตามดีไซน์เดิม (ตั้งใจให้ไม่ต้องกดบันทึกซ้ำ)

"ลำดับฉาก" (`visuals[]`) เป็น list อ่านอย่างเดียว ไม่มี state เป็นของตัวเอง อ่านตรงจาก `articleData.visuals` ทุกครั้ง

`scenes` ก็เช่นกัน — อ่านตรงจาก `articleData.scenes` (บรรทัด 559) ไม่มี local draft — ทำให้การแก้ไข `visual_prompt` ต้อง persist ทันทีเหมือน `video_prompt` เดิม ถ้าจะทำตามที่ตกลงกัน (รอบันทึกรวมกับปุ่มหลัก) ต้อง lift ขึ้นมาเป็น local draft state ก่อน

Backend `update-scene` (`api/brand-content.php:1945`) รับแค่ `video_prompt` (whitelist ด้วย `array_key_exists`) ต้องขยายให้รับ `visual_prompt` ด้วย

`SceneCards.tsx` ใช้ร่วมกันระหว่าง `ContentVideoView` (readOnly, หน้าอนุมัติ) และ `ContentCardDialog` (editable) — การเปลี่ยนแปลงต้องไม่กระทบ readOnly mode

## Goals / Non-Goals

**Goals:**
- แก้ไข "ลำดับฉาก" และ `visual_prompt` ได้โดยไม่ยิง API จนกว่าจะกดปุ่ม "บันทึก" หลักของ dialog
- ปุ่ม "บันทึก" หลัก reflect สถานะ dirty ของทั้งฟอร์ม (ไม่ใช่แค่ scene)
- แยกการ "บันทึกข้อความ" ออกจากการ "สร้างภาพใหม่" (สร้างภาพเป็น action ที่มีค่าใช้จ่าย AI ต้องยืนยันแยก)
- ไม่กระทบ behavior เดิมของ `video_prompt` (ปุ่มบันทึกของตัวเอง) และ "AI เขียน Video Prompt" (persist ทันที)

**Non-Goals:**
- ไม่ทำ scene reordering (ตัดออกจาก scope ตั้งแต่ explore)
- ไม่เพิ่ม/ลบจำนวนฉากจาก "ลำดับฉาก"
- ไม่เปลี่ยน `ContentVideoView` (readOnly)
- ไม่ auto-regenerate ภาพทันทีที่บันทึกข้อความ

## Decisions

### 1. Local draft state สำหรับ visuals และ scene visual_prompt
เพิ่ม state ใน `ContentCardDialog`:
- `visualsDraft: string[] | null` — seed จาก `articleData.visuals` (เฉพาะ `.visual` ของแต่ละ entry) ตอน dialog เปิด/เปลี่ยน `existingItem`; ใช้แทน `visuals` เดิมเมื่อ render "ลำดับฉาก"
- `scenesVisualPromptDraft: Record<number, string>` — key เป็น scene index, seed lazily เมื่อผู้ใช้เริ่มพิมพ์ (เหมือน pattern `videoPromptDrafts` ใน `SceneCards`)

**ทางเลือกที่ไม่เลือก**: ให้ `SceneCards` self-persist `visual_prompt` เหมือน `video_prompt` เดิม — ตัดทิ้งเพราะ requirement ชัดเจนว่าต้องรวมกับปุ่มบันทึกหลักของ dialog

### 2. ยก state การแก้ visual_prompt ขึ้นมาที่ ContentCardDialog ผ่าน props ใหม่ใน SceneCards
`SceneCards` เพิ่ม props (optional):
- `visualPromptDrafts?: Record<number, string>` — ถ้าไม่ส่งมา = readOnly mode เดิม ไม่แสดงช่องนี้
- `onVisualPromptChange?: (index: number, value: string) => void`
- `staleImageIndexes?: Set<number>` — index ที่เพิ่งบันทึก visual_prompt ใหม่แต่ภาพยังเป็นของเดิม → แสดงปุ่ม "สร้างภาพฉากนี้ใหม่"
- `onRegenerateScene?: (index: number) => void`

เมื่อ `ContentVideoView` เรียก `SceneCards` โดยไม่ส่ง props เหล่านี้ (readOnly=true อยู่แล้ว) ช่อง visual_prompt และปุ่ม regenerate จะไม่ render เลย — ไม่กระทบหน้าอนุมัติ

**ทางเลือกที่ไม่เลือก**: แยก component ใหม่สำหรับ editable scene card — ตัดทิ้งเพราะจะ duplicate layout/logic กับ `SceneCards` เดิม (การ์ดรูป+สถานะ+video_prompt เหมือนกันทั้งหมด ต่างแค่ visual_prompt เพิ่มมา)

### 3. Dirty tracking แบบรวมศูนย์
เก็บ snapshot ค่าที่ "โหลดมา" ไว้ใน ref (`initialSnapshotRef`) ตอนเปิด dialog/เปลี่ยน item ครอบคลุมทุกฟิลด์ที่แก้ไขได้ (topic, platforms, caption, scheduledDate, imageBrief, articleHtml, seoFields, visualsDraft, scenesVisualPromptDraft) แล้วคำนวณ `isDirty` ด้วยการเทียบ shallow/JSON กับค่าปัจจุบันทุกครั้งที่ render ปุ่ม "บันทึก" ใช้ `disabled={!isDirty || saving || !topic.trim()}`

**ทางเลือกที่ไม่เลือก**: ตั้ง `dirty` flag แบบ manual set เป็น true ทุกจุดที่มี onChange — เสี่ยงพลาดจุดใดจุดหนึ่งแล้วปุ่มไม่ enable ให้ตรง เทียบ snapshot ตรงไปตรงมากว่าและ robust กว่า

### 4. Dialog ปิด/ไม่ปิดหลังบันทึก ขึ้นกับว่ามี scene ที่ถูกแก้ไขหรือไม่
`handleSave` เดิมปิด dialog เสมอ — เปลี่ยนเป็น: หลังบันทึกสำเร็จ ถ้า `scenesVisualPromptDraft` มี index ที่ค่าต่างจาก `scenes[i].visual_prompt` เดิม (คือมีการแก้ scene จริง) → ใส่ index เหล่านั้นเข้า `staleImageIndexes` และ **ไม่ปิด dialog** ถ้าไม่มี → ปิด dialog ตามพฤติกรรมเดิมทุกประการ

### 5. ปุ่ม "สร้างภาพฉากนี้ใหม่" ต้องยืนยันก่อน
ใช้ `useConfirm()` hook ที่มีอยู่แล้วในไฟล์นี้ (บรรทัด 85, ใช้กับ "ยืนยันให้ AI เขียนเนื้อหา" อยู่แล้ว) — เรียก `confirm({ title: 'ยืนยันสร้างภาพใหม่', description: '...จะใช้เครดิต AI', confirmLabel: 'สร้างภาพใหม่' })` ก่อนยิง `generate-scene-image` เมื่อสำเร็จ ลบ index นั้นออกจาก `staleImageIndexes`

### 6. "ลำดับฉาก" แสดงแบบมีเงื่อนไข
เงื่อนไขแสดงเปลี่ยนจาก `visuals.length > 0` เป็น `visuals.length > 0 && scenes.length === 0` — ย้ายบล็อกไปอยู่ติดเหนือปุ่ม "สร้างภาพทุกฉาก" (เดิมอยู่บนสุดของ dialog ใกล้ hashtags)

### 7. Backend: ขยาย update-scene
เพิ่ม `if (array_key_exists('visual_prompt', $body)) { $scenes[$sceneIndex]['visual_prompt'] = trim((string)$body['visual_prompt']); }` คู่กับ block `video_prompt` เดิมใน action เดียวกัน — ไม่แยก action ใหม่ เพราะ shape เดิมรองรับได้อยู่แล้ว (partial update ต่อ field)

### 8. (Follow-up หลัง apply ครั้งแรก) เอาปุ่ม "บันทึก Video Prompt" ออกด้วย
หลัง apply เสร็จรอบแรก ผู้ใช้ตัดสินใจว่าไม่ต้องการปุ่ม "บันทึก Video Prompt" แยกอีกต่อไปเช่นกัน (ตอนแรกตั้งใจคงไว้ตาม design เดิม) — ปรับ `SceneCards.tsx` ให้ `video_prompt` ใช้ pattern เดียวกับ `visual_prompt` ทุกประการ: lift เป็น `videoPromptDrafts`/`onVideoPromptChange` prop จาก parent แทน local state ภายใน, ลบปุ่ม "บันทึก Video Prompt" และ `handleSaveVideoPrompt` ออก, เพิ่ม `onVideoPromptGenerated` callback ให้ parent เคลียร์ draft ทิ้งหลัง AI เขียนสำเร็จ (แทนที่จะ setState ภายใน component เอง) — `ContentCardDialog` เพิ่ม `scenesVideoPromptDraft` state คู่ขนานกับ `scenesVisualPromptDraft` รวมเข้า dirty-tracking และ `handleSave` เดียวกัน แต่**ไม่**ผูกกับ `staleImageIndexes`/dialog-stays-open (นั่นเป็นกลไกเฉพาะของ `visual_prompt` ที่กระทบภาพที่สร้างไว้แล้ว — แก้ `video_prompt` อย่างเดียวไม่กระทบภาพ ปิด dialog ตามปกติ)

### 9. (Follow-up ที่ 2) แก้ visual_prompt รวมไว้จุดเดียว ไม่ซ้ำในแต่ละ Scene card
ผู้ใช้ตัดสินใจว่าการแก้ไข `visual_prompt` (หลังมี `scenes[]` แล้ว) ไม่ควรซ้ำอยู่ในแต่ละ Scene card — ย้ายออกมาไว้เป็นบล็อกเดียวเหนือ `<SceneCards>` โดยตรงใน `ContentCardDialog` (ทดลองใช้ textarea รวมก่อน แล้วปรับใน follow-up ที่ 3) — ลบ `visualPromptDrafts`/`onVisualPromptChange` prop ออกจาก `SceneCards` ทั้งหมด (ไม่ใช้แล้ว) เหลือแค่ scene การ์ดที่มีรูป+สถานะ+Video Prompt เท่านั้น ปุ่ม "สร้างภาพฉากนี้ใหม่" ยังคงอยู่ต่อการ์ด (ผูกกับ `staleImageIndexes` เหมือนเดิม เพราะการสร้างภาพยังเป็น action ต่อฉากอยู่)

### 10. (Follow-up ที่ 3) กลับไปใช้กล่องแยกทีละฉากทั้งก่อนและหลังมี scenes พร้อมเปลี่ยนชื่อให้ตรงกัน
ผู้ใช้ทดสอบแล้วไม่ชอบ textarea เดียวรวมทุกฉาก (ทั้งฝั่งก่อนมี scenes ที่เคยรวมไว้ตาม follow-up ก่อนหน้า และฝั่งหลังมี scenes ที่เพิ่งรวมใน #9) — ต้องการกล่องแยกทีละฉากแบบเดิม (แต่ละฉากมี `<Textarea>` ของตัวเอง มีเลขกำกับ) เหมือนดีไซน์ต้นฉบับ เพียงแต่**ไม่ซ้ำในแต่ละ Scene card** (ตาม decision #9) — ผล: บล็อก "ลำดับฉาก" เหนือ SceneCards ใช้กล่องแยกทีละฉากทั้งสองกรณี (ก่อน/หลังมี scenes) ต่างกันแค่ผูกกับ `visualsDraft` (array of string) หรือ `scenesVisualPromptDraft` (Record<number,string>) เท่านั้น — เปลี่ยนชื่อ label จาก "คำบรรยายภาพ" กลับเป็น "ลำดับฉาก" ให้ชื่อเดียวกันทั้งสองสถานะ เพื่อไม่ให้ผู้ใช้สับสนว่าเป็นคนละฟีเจอร์กัน — ตำแหน่ง (เหนือปุ่ม "สร้างภาพทุกฉาก" / เหนือ SceneCards) ไม่เปลี่ยนแปลง

## Risks / Trade-offs

- **[Risk]** Dirty-tracking ครอบคลุมทั้งฟอร์ม (ไม่ใช่แค่ scope เดิมที่ทำงานอยู่) อาจกระทบ behavior เดิมของปุ่ม "บันทึก" ที่ตอนนี้กดได้เสมอ → **Mitigation**: ทดสอบทุก field เดิม (topic, platform, caption, seo) ให้แน่ใจว่า dirty-detect ถูกต้องก่อน merge ไม่ปล่อยเป็น false-positive/negative
- **[Risk]** Dialog ไม่ปิดหลังบันทึกอาจขัดความเคยชินผู้ใช้ที่คุ้นกับ "กดบันทึกแล้วปิดเสมอ" → **Mitigation**: เกิดเฉพาะกรณีแก้ scene เท่านั้น ("สร้างภาพฉากนี้ใหม่" ก็อยู่ในบริบทเดียวกันพอดี) ฟิลด์อื่นยังปิดตามเดิม
- **[Risk]** `staleImageIndexes` เป็น client-side state ชั่วคราว ถ้า reload หน้า/ปิด dialog แล้วเปิดใหม่ จะหายไป (ปุ่ม "สร้างภาพฉากนี้ใหม่" จะไม่โผล่อีกแม้ข้อความยังไม่ตรงกับภาพ) → **Mitigation**: ยอมรับได้ตามที่ user ตกลงไว้ชัดเจนแล้ว (โผล่เฉพาะ "หลังบันทึกในเซสชันนี้" ไม่ใช่ persistent flag ใน DB) ไม่เพิ่ม column ใหม่

## Migration Plan

ไม่มี schema migration (ใช้ field เดิมใน `article_content` JSON ทั้งหมด) — deploy เป็น frontend + backend change ปกติ ไม่ต้อง backfill ข้อมูลเดิม

## Open Questions

ไม่มี — ตัดสินใจครบทุกจุดระหว่าง explore แล้ว
