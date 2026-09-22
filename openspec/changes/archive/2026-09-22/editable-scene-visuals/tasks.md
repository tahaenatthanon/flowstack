## 1. Backend — update-scene รับ visual_prompt

- [x] 1.1 ขยาย action `update-scene` (`api/brand-content.php`) ให้รับและบันทึก `visual_prompt` แบบ partial update (คู่กับ `video_prompt` เดิม)

## 2. SceneCards — เพิ่มช่อง visual_prompt และปุ่มสร้างภาพใหม่

- [x] 2.1 เพิ่ม props `visualPromptDrafts`, `onVisualPromptChange`, `staleImageIndexes`, `onRegenerateScene` ใน `SceneCards.tsx` (ทั้งหมด optional — undefined = ไม่ render ช่อง/ปุ่มใหม่)
- [x] 2.2 เพิ่มช่องข้อความ "คำบรรยายภาพ" (visual_prompt) ต่อ scene การ์ด ใช้งานเมื่อ `visualPromptDrafts`/`onVisualPromptChange` ถูกส่งมา — ไม่มีปุ่มบันทึกของตัวเอง
- [x] 2.3 เพิ่มปุ่ม "สร้างภาพฉากนี้ใหม่" แสดงเฉพาะเมื่อ scene index อยู่ใน `staleImageIndexes` — กดแล้วเรียก `onRegenerateScene(index)`
- [x] 2.4 เปลี่ยนเงื่อนไขปุ่ม "AI เขียน Video Prompt" จาก `!hasVideoPrompt && !readOnly` เป็น `!readOnly` (แสดงตลอดเวลา)

## 3. ContentCardDialog — draft state และ dirty tracking

- [x] 3.1 เพิ่ม state `visualsDraft: string[] | null` seed จาก `articleData.visuals` (เฉพาะ `.visual`) ตอนเปิด dialog/เปลี่ยน `existingItem`
- [x] 3.2 เพิ่ม state `scenesVisualPromptDraft: Record<number, string>` และ `staleImageIndexes: Set<number>`
- [x] 3.3 เพิ่ม `initialSnapshotRef` เก็บค่าฟิลด์ที่แก้ไขได้ทั้งหมดตอนโหลด แล้วคำนวณ `isDirty` โดยเทียบกับค่าปัจจุบัน (รวม `visualsDraft`, `scenesVisualPromptDraft`)
- [x] 3.4 เปลี่ยนปุ่ม "บันทึก" หลักเป็น `disabled={!isDirty || saving || !topic.trim()}`

## 4. ContentCardDialog — เปลี่ยน UI "ลำดับฉาก" และลำดับบล็อก

- [x] 4.1 เปลี่ยนเงื่อนไขแสดง "ลำดับฉาก" จาก `visuals.length > 0` เป็น `visuals.length > 0 && scenes.length === 0`
- [x] 4.2 เปลี่ยน `<ul>` อ่านอย่างเดียวเป็น `<Textarea>` ต่อบรรทัด ผูกกับ `visualsDraft`/`setVisualsDraft` (แก้ได้เฉพาะ `.visual`)
- [x] 4.3 ย้ายบล็อก "ลำดับฉาก" ไปอยู่เหนือปุ่ม "สร้างภาพทุกฉาก" ทันที (แทนตำแหน่งเดิมใกล้ hashtags)
- [x] 4.4 สลับลำดับ JSX ให้ SceneCards render ก่อนปุ่ม "สร้างภาพทุกฉาก" (ปัจจุบันปุ่มอยู่ก่อน)

## 5. ContentCardDialog — เชื่อม SceneCards กับ draft/regenerate

- [x] 5.1 ส่ง `visualPromptDrafts`, `onVisualPromptChange`, `staleImageIndexes` เข้า `<SceneCards>` (เฉพาะที่ใช้ใน ContentCardDialog ไม่ใช่ ContentVideoView)
- [x] 5.2 ทำ `onRegenerateScene(index)`: ใช้ `useConfirm()` ยืนยันก่อน (title "ยืนยันสร้างภาพใหม่", แจ้งว่าใช้เครดิต AI) → เรียก `generate-scene-image` → สำเร็จแล้วลบ index ออกจาก `staleImageIndexes` และ invalidate queries

## 6. ContentCardDialog — handleSave รวมทุกฟิลด์ + ปิด/ไม่ปิด dialog

- [x] 6.1 ใน `handleSave`: รวม `visualsDraft` เข้า `article_content.visuals` ก่อนส่ง `onSave`
- [x] 6.2 ใน `handleSave`: หา index ที่ `scenesVisualPromptDraft[i]` ต่างจาก `scenes[i].visual_prompt` เดิม → เรียก `update-scene` (การ API ใหม่จาก tasks 1.1) ให้แต่ละ index ที่เปลี่ยน
- [x] 6.3 หลังบันทึกสำเร็จ: ถ้ามี index ที่ถูกแก้ใน 6.2 → ใส่เข้า `staleImageIndexes` และไม่เรียก `onOpenChange(false)`; ถ้าไม่มี → `onOpenChange(false)` ตามเดิม
- [x] 6.4 อัปเดต `initialSnapshotRef` ใหม่หลังบันทึกสำเร็จ (ให้ isDirty กลับเป็น false)

## 7. ทดสอบ

- [x] 7.1 ทดสอบผ่าน browser จริง: เปิด content video ที่มีอยู่ ("5 สัญญาณเตือน...Duckkit") แก้ visual_prompt ของ scene 1 → บันทึก → dialog ไม่ปิด → เห็นปุ่ม "สร้างภาพฉากนี้ใหม่" → กด → เห็น dialog ยืนยันถูกต้อง (ยกเลิกไว้ ไม่กดยืนยันจริงเพื่อไม่ใช้เครดิต AI โดยไม่จำเป็น)
- [x] 7.2 ทดสอบ content ที่ยังไม่มี scenes ("วิดีโอสอนการตลาด..."): เห็น "ลำดับฉาก" 4 บรรทัดแก้ไขได้เหนือปุ่ม "สร้างภาพทุกฉาก" ถูกต้อง แก้ไขแล้วปุ่มบันทึก enable ทันที (ปิดโดยไม่บันทึกเพื่อไม่ทิ้ง test data ถาวร)
- [x] 7.3 ทดสอบปุ่ม "บันทึก" disabled → enabled เมื่อแก้ไข ยืนยันแล้วทั้งกรณีแก้ scene visual_prompt และแก้ "ลำดับฉาก"
- [x] 7.4 ยืนยันปุ่ม "AI เขียน Video Prompt" แสดงอยู่ทั้ง Scene 1 และ Scene 2 ที่มี Video Prompt อยู่แล้ว (ไม่ถูกซ่อน)
- [x] 7.5 ตรวจโค้ด `ContentVideoView.tsx:327` ยืนยันไม่ได้แก้ไข — เรียก `SceneCards` โดยไม่ส่ง props ใหม่ (`onVisualPromptChange` เป็น undefined) ทำให้ช่อง/ปุ่มใหม่ไม่ render ใน readOnly mode
- [x] 7.6 รัน `pnpm lint` และ `pnpm build`

## 8. Follow-up — เอาปุ่ม "บันทึก Video Prompt" ออกด้วย (ใช้ปุ่ม "บันทึก" ของ dialog แทน)

- [x] 8.1 `SceneCards.tsx`: ลบ local state `videoPromptDrafts`/`handleSaveVideoPrompt`/ปุ่ม "บันทึก Video Prompt" ออก เปลี่ยนเป็น controlled props `videoPromptDrafts`/`onVideoPromptChange` (pattern เดียวกับ visual_prompt) + `onVideoPromptGenerated` สำหรับเคลียร์ draft หลัง AI เขียนสำเร็จ
- [x] 8.2 `ContentCardDialog.tsx`: เพิ่ม state `scenesVideoPromptDraft`, รวมเข้า `initialSnapshotRef`/`isDirty`, ส่ง props ใหม่เข้า `<SceneCards>`
- [x] 8.3 `handleSave`: หา index ที่ `video_prompt` เปลี่ยนจริง รวมกับ `visual_prompt` ที่เปลี่ยนของ scene เดียวกันเป็น `update-scene` request เดียว (ไม่ยิงซ้ำ) — video_prompt เปลี่ยนอย่างเดียวไม่ trigger `staleImageIndexes`/dialog-stays-open (เฉพาะ visual_prompt เท่านั้น)
- [x] 8.4 อัปเดต spec `content-dialog-unified-save` และ `design.md` ให้ตรงกับ behavior ใหม่ (ไม่มีข้อยกเว้นสำหรับ video_prompt อีกต่อไป)
- [x] 8.5 รัน `pnpm lint`/`pnpm build` ซ้ำ + ทดสอบผ่าน browser จริง (แก้ video_prompt ของ Duckkit scene 5 → บันทึก → dialog ปิดตามปกติ → ยืนยันค่าใน DB ถูกต้อง)

## 9. Follow-up — "ลำดับฉาก" เป็น textarea เดียว ไม่แบ่งกล่องทีละฉาก

- [x] 9.1 `ContentCardDialog.tsx`: เปลี่ยนจาก `<Textarea>` แยกทีละบรรทัด (map ต่อ index) เป็น `<Textarea>` เดียว ค่า = `visualsDraft.join('\n')`, onChange = `setVisualsDraft(value.split('\n'))`
- [x] 9.2 อัปเดต spec `scene-generation-from-visuals` ให้ตรงกับ UI ใหม่ (textarea เดียว บรรทัดสอดคล้องกับรายการตามลำดับ)
- [x] 9.3 รัน `pnpm lint`/`pnpm build` ซ้ำ + ตรวจ browser ว่าแสดงเป็นกล่องเดียวถูกต้อง

## 10. Follow-up — "คำบรรยายภาพ" (หลังมี scenes) รวมเป็น textarea เดียว ไม่แยกในแต่ละ Scene card

- [x] 10.1 `SceneCards.tsx`: ลบ prop `visualPromptDrafts`/`onVisualPromptChange` และช่อง "คำบรรยายภาพ" ต่อการ์ดออกทั้งหมด — เหลือรูป+สถานะ+AI เขียน Video Prompt+Video Prompt เท่านั้น
- [x] 10.2 `ContentCardDialog.tsx`: เพิ่มบล็อก "คำบรรยายภาพ (N)" เป็น textarea เดียวเหนือ `<SceneCards>` โดยตรง (value รวมทุก scene ด้วย `\n`, onChange split กลับเข้า `scenesVisualPromptDraft` ต่อ index)
- [x] 10.3 อัปเดต spec `scene-generation-from-visuals` และ `content-dialog-unified-save` ให้ตรงกับ layout ใหม่ + `design.md` เพิ่ม decision #9
- [x] 10.4 รัน `pnpm lint`/`pnpm build` ซ้ำ + ทดสอบผ่าน browser จริง (เปิด Duckkit content เห็น "คำบรรยายภาพ (5)" เป็นกล่องเดียวเหนือ Scene card grid ที่ไม่มีช่องคำบรรยายภาพซ้ำในการ์ดแล้ว)

## 11. Follow-up — กลับไปใช้กล่องแยกทีละฉาก (ทั้งก่อน/หลังมี scenes) + เปลี่ยนชื่อกลับเป็น "ลำดับฉาก"

- [x] 11.1 บล็อกก่อนมี scenes: กลับจาก textarea เดียวเป็นกล่องแยกทีละบรรทัด (เลขกำกับ 1,2,3,...) ผูกกับ `visualsDraft` เหมือนดีไซน์ต้นฉบับ
- [x] 11.2 บล็อกหลังมี scenes: เปลี่ยนจาก textarea เดียวเป็นกล่องแยกทีละฉาก (เลขกำกับ) ผูกกับ `scenesVisualPromptDraft` ต่อ index — ยังคงอยู่เหนือ SceneCards จุดเดียว ไม่ซ้ำในแต่ละการ์ด (ไม่ย้อนกลับ decision #9)
- [x] 11.3 เปลี่ยน label จาก "คำบรรยายภาพ (N)" เป็น "ลำดับฉาก (N)" ให้ตรงกับบล็อกก่อนมี scenes — ตำแหน่งเดิมไม่เปลี่ยน
- [x] 11.4 อัปเดต spec `scene-generation-from-visuals` และ `content-dialog-unified-save` + `design.md` เพิ่ม decision #10
- [x] 11.5 รัน `pnpm lint`/`pnpm build` ซ้ำ + ทดสอบผ่าน browser จริง (Duckkit content แสดง "ลำดับฉาก (5)" เป็นกล่องแยกทีละฉากเหนือ Scene card grid ถูกต้อง)

## 12. Follow-up — ย้ายปุ่ม "AI เขียน Video Prompt" ไปใต้ช่อง Video Prompt

- [x] 12.1 `SceneCards.tsx`: สลับลำดับ JSX ให้ปุ่ม "AI เขียน Video Prompt" render หลังช่อง Video Prompt (เดิมอยู่ก่อน)
- [x] 12.2 อัปเดต spec `video-prompt-backfill` ให้ระบุตำแหน่งปุ่มชัดเจน
- [x] 12.3 รัน `pnpm lint`/`pnpm build` ซ้ำ + ทดสอบผ่าน browser จริง (ยืนยันปุ่มอยู่ใต้ Video Prompt ใน Duckkit scene card)
