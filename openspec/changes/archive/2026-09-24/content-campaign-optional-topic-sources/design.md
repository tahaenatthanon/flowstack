## Context

- `generate-plan` (`api/brand-content.php:971+`) มี guard 2 ชั้นที่ทำงานอิสระกัน:
  1. `content_plan_has_any_topic_source($triggerIds, $triggerCommand, $sourceTopic)` ([content-plan-prompt.php:106](api/lib/content-plan-prompt.php:106)) — เช็คว่ามีอย่างน้อย trigger หรือ topic เท่านั้น (ไม่นับ skill/KB)
  2. `content_plan_direct_requires_topic($isDirect, $sourceTopic)` ([content-plan-prompt.php:118](api/lib/content-plan-prompt.php:118)) — บังคับ `$sourceTopic` ไม่ว่างสำหรับ Direct mode **เสมอ** ไม่ว่า guard แรกจะผ่านด้วย trigger ก็ตาม (guard นี้ถูกเพิ่มมาเพื่อแก้บั๊กอื่นที่ legacy mode โดน reject ผิด — ดู comment ในเทสต์ `content-plan-generate-request-validation-test.php:1-16`)
- ทั้ง `QuickCreateDialog.tsx` และ `BatchGenerateDialog.tsx` ส่ง `generation_mode: 'direct'` เสมอ จึงโดน guard 2 บังคับหัวข้อเสมอ
- ตรวจ prompt assembly แล้ว (`content_plan_user_message()`, [content-plan-prompt.php:246-256](api/lib/content-plan-prompt.php:246)): Direct mode เขียนบรรทัด "Trigger Instructions" แยกจากบรรทัด "Original User Topic/Seed" อยู่แล้ว — และ Skill/Knowledge Base ถูก resolve เป็นเนื้อหาจริงแยกต่างหาก ([brand-content.php:1038-1059](api/brand-content.php:1038)) ไม่ได้พึ่ง `$sourceTopic` เลย ดังนั้น**การผ่อนคลาย guard ไม่กระทบ prompt assembly ที่มีอยู่แล้ว** — AI ได้รับบริบทจาก trigger/skill/KB ตามปกติไม่ว่า topic จะว่างหรือไม่
- `$planTitle` ([brand-content.php:1325](api/brand-content.php:1325)) fallback เป็น `$triggerCommand` ถ้า `$sourceTopic` ว่าง — กรณีมีแค่ skill/KB (ไม่มี topic และไม่มี trigger) จะได้ `$planTitle` เป็นสตริงว่าง ยอมรับเป็น trade-off (เป็นแค่ label ใน `content_plans.title` ไม่กระทบเนื้อหา AI)
- `campaign-ai-content-generation` spec ระบุไว้ชัดว่าฟิลด์ AI generation อยู่ใน "panel ที่ต้องกดเปิด" — ต้องแก้ requirement นี้ให้ตรงกับ layout ใหม่

## Goals / Non-Goals

**Goals:**
- Direct mode (เดี่ยว + Batch) ผ่าน validation ได้เมื่อมีอย่างน้อย 1 ใน 4: หัวข้อ, Trigger, Skill, Knowledge Base — ทั้ง client และ server
- ฟิลด์เลือกสินค้า/โทน/brand context ของแคมเปญแสดงในฟอร์มหลักเสมอ ไม่ต้องกดเปิด panel
- ปุ่มสั่งสร้างเนื้อหาด้วย AI ของแคมเปญย้ายไป footer

**Non-Goals:**
- ไม่เปลี่ยนตรรกะ prompt assembly ของ Trigger/Skill/Knowledge Base (ทำงานถูกอยู่แล้วตามที่ตรวจสอบในบริบทข้างต้น)
- ไม่เปลี่ยนกติกาบังคับ ชื่อแคมเปญ/หัวข้ออีเมล ตอนบันทึกแคมเปญ — คนละกติกากับแหล่งข้อมูลของ AI generation
- ไม่แตะ `AICampaignPlanDialog.tsx` (ตรง spec อยู่แล้ว)
- ไม่แก้ 8 เทสต์ที่ fail อยู่ก่อนหน้า (tone default, selector ambiguity, platform badge) — คนละเรื่อง

## Decisions

### 1. ขยาย `content_plan_has_any_topic_source()` ให้รับ skill/KB แทนการเขียนเงื่อนไขใหม่แยก
เพิ่มพารามิเตอร์ `array $skillIds, array $brandContextIds` เข้าฟังก์ชันเดิม แล้วเปลี่ยน return เป็น `(bool)$triggerIds || $triggerCommand !== '' || $sourceTopic !== '' || (bool)$skillIds || (bool)$brandContextIds` — เรียกที่จุดเดียวที่มีอยู่แล้ว ([brand-content.php:986](api/brand-content.php:986)) ส่ง `$skillIds`/`$brandContextIds` เพิ่ม
- ทางเลือกที่ไม่เลือก: เขียนฟังก์ชันใหม่แยก เช่น `content_plan_has_any_input_source()` แล้วเก็บฟังก์ชันเดิมไว้เฉย ๆ — สร้างฟังก์ชันซ้ำซ้อนที่ทำงานคล้ายกันเกินไป และ `content_plan_has_any_topic_source()` ไม่มี caller อื่นนอกจากจุดเดียวนี้ (ยืนยันจาก grep) จึงแก้ signature ตรงได้โดยไม่กระทบที่อื่น

### 2. ลบ `content_plan_direct_requires_topic()` ทั้งฟังก์ชันและจุดเรียก แทนการปรับเงื่อนไข
บรรทัด [brand-content.php:1028](api/brand-content.php:1028) ที่เรียก guard นี้ถูกลบทิ้ง — guard แรก (ข้อ 1) ที่ขยายแล้วครอบคลุมกรณี Direct mode ไว้หมดแล้ว (topic หรือ trigger หรือ skill หรือ KB อย่างใดอย่างหนึ่ง) จึงไม่มีเหตุผลให้ guard ที่สองบังคับ topic ซ้ำเฉพาะ Direct mode อีก
- ทางเลือกที่ไม่เลือก: แก้ `content_plan_direct_requires_topic()` ให้เช็ค skill/KB ด้วย — จะกลายเป็นฟังก์ชันที่ทำหน้าที่ซ้ำกับ guard แรกทุกประการ (เช็คแหล่งข้อมูลเดียวกัน) ต่างกันแค่ error message เดิม ("กรุณาระบุหัวข้อ" ทั้งคู่อยู่แล้ว) — ลบตัวที่ซ้ำออกชัดเจนกว่า
- เทสต์ `content-plan-generate-request-validation-test.php` ที่ทดสอบ `content_plan_direct_requires_topic()` โดยตรงต้องลบ/ปรับเป็นทดสอบ guard เดียวที่ขยายแล้วแทน

### 3. Client-side: เปลี่ยนเงื่อนไข disabled ของปุ่ม "สร้าง" ให้ตรงกับ guard ฝั่ง server
`QuickCreateDialog.tsx` ([:503](src/components/content/dialogs/QuickCreateDialog.tsx:503)): `disabled={!topic.trim()}` → `disabled={!topic.trim() && selTriggerIds.length === 0 && selSkillIds.length === 0 && selContextIds.length === 0}`

`BatchGenerateDialog.tsx` ([:154](src/components/content/dialogs/BatchGenerateDialog.tsx:154)): เปลี่ยนเงื่อนไข per-row จาก `if (!item.topic.trim()) missing.push('ยังไม่ได้กรอกหัวข้อ')` เป็นเช็ครวม 4 แหล่ง — `if (!item.topic.trim() && !item.triggerIds.length && !item.skillIds.length && !item.contextIds.length) missing.push('ยังไม่มีหัวข้อ/Trigger/Skill/Knowledge Base อย่างน้อย 1 อย่าง')` — เงื่อนไข `MIN_TOPICS` (≥3 แถว) และการเช็คแพลตฟอร์มต่อแถวไม่เปลี่ยน

### 4. Campaign form: ย้ายฟิลด์ + ปุ่ม โดยไม่เปลี่ยน state/logic เดิม
`CampaignsPage.tsx`:
- ย้าย JSX ของ `ProductPicker`/`aiProductIds`, ปุ่มโทน/`aiTone`, checkbox `aiUseBrandContext` ([:1604-1631](src/pages/CampaignsPage.tsx:1604)) จากภายใน `{aiPanelOpen && (...)}` ไปไว้ใน Section 1 "ข้อมูลแคมเปญ" ([:1422-1446](src/pages/CampaignsPage.tsx:1422)) ต่อจาก "หัวข้ออีเมล" — state (`aiProductIds`, `aiTone`, `aiUseBrandContext`) ไม่เปลี่ยนชื่อ/ไม่เปลี่ยน logic
- ปุ่ม "สร้าง" ที่เรียก `handleGenerateWithAI` ([:1637-1642](src/pages/CampaignsPage.tsx:1637)) ย้ายไป `DialogFooter` ([:1686](src/pages/CampaignsPage.tsx:1686)) — วางก่อนปุ่ม "ยกเลิก" (ฝั่งซ้าย เพราะเป็น action เสริม ไม่ใช่ action หลักของฟอร์ม) เงื่อนไข `disabled` เดิมคงไว้ทั้งหมด
- ปุ่ม toggle เดิม "สร้างด้วย AI" ([:1591-1597](src/pages/CampaignsPage.tsx:1591)) และ state `aiPanelOpen` ถูกลบทิ้ง (ฟิลด์แสดงตลอดเวลาแล้ว ไม่ต้องมีปุ่มเปิด/ปิด)
- ข้อความ helper ที่บอกสถานะหัวข้ออีเมล ([:1632-1636](src/pages/CampaignsPage.tsx:1632)) ย้ายไปพร้อมฟิลด์ ยังใช้ `campaignSubject` ตัวเดิม

### 5. (พบระหว่าง apply) Research seed ใช้หัวข้อที่ AI ตั้งให้ item เมื่อผู้ใช้ไม่ได้พิมพ์หัวข้อ
Research เป็นขั้นบังคับของการสร้างคอนเทนต์ และ `content-research.php?action=fetch` ต้องการ `seed_keyword` ไม่ว่าง (422 ถ้าว่าง) — ถ้าไม่แก้ กรณีมีแค่ Trigger/Skill/KB จะสร้าง plan item ได้แต่ล้มที่ Research ทันที
- `QuickCreateDialog`: `researchSeedTopic(item.source_topic, topic.trim() || item.topic)`
- `BatchGenerateDialog`: `researchTopic = topicConfig.topic.trim() || item.topic` (เดิมถ้าหัวข้อว่างจะ**ข้าม** Research ไปเลย ทำให้ได้แค่แผนไม่มีบทความ)
- ตรงกับ guard ฝั่ง server อยู่แล้ว: `generate-article` เทียบ seed กับ `source_topic ?: topic` ([brand-content.php:2531](api/brand-content.php:2531)) — เมื่อ `source_topic` ว่างจะเทียบกับ `item.topic` พอดี
- `trigger_command` ที่ QuickCreateDialog ส่งไปเป็นค่าว่างเมื่อไม่มีหัวข้อ (เดิมโหมดวิดีโอจะได้ `" [VIDEO]"` ซึ่งกลายเป็น Trigger Instruction ขยะใน prompt)

### 6. (พบระหว่าง apply) Direct-mode prompt ไม่พิมพ์บรรทัด "SOURCE OF TRUTH" เมื่อหัวข้อว่าง
`content_plan_user_message()` เดิมพิมพ์บรรทัด `Original User Topic/Seed (SOURCE OF TRUTH): ` เสมอใน Direct mode (เพราะ caller รับประกันหัวข้อไม่ว่าง) — ตอนนี้ว่างได้ จึงข้ามบรรทัดนั้นเหมือนที่ Plan mode ทำอยู่แล้ว ไม่ส่ง "source of truth" ว่างให้ AI สับสน (อัปเดต TC07 + เพิ่ม TC08 ใน `content-plan-user-message-topic-guard-test.php`)

## Risks / Trade-offs

- [Direct mode ที่มีแค่ skill/KB ไม่มี topic/trigger → `$planTitle` เป็นค่าว่าง] → ยอมรับเป็น trade-off เพราะเป็นแค่ label แสดงผลใน `content_plans.title` ไม่กระทบเนื้อหาที่ AI สร้าง (ดู Context) — ถ้าพบว่ากระทบ UX จริงค่อยเพิ่ม fallback เป็นชื่อ skill แรกในการปรับปรุงครั้งถัดไป
- [ย้าย field UI ของแคมเปญกระทบเทสต์ที่มีอยู่] → ตรวจแล้วไม่มีเทสต์ Vitest ที่ทดสอบ `CampaignsPage.tsx` โดยตรงในส่วนนี้ (ยืนยันตอน apply)
- [ลบฟังก์ชัน `content_plan_direct_requires_topic()`] → เทสต์เดิมที่อ้างอิงฟังก์ชันนี้ตรง ๆ ต้องลบ/เขียนใหม่ ไม่ใช่ regression ที่ไม่ตั้งใจ เป็นส่วนหนึ่งของงาน
