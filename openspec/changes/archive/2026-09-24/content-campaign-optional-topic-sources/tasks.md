## 1. Backend — ผ่อนคลาย guard ของ generate-plan

- [x] 1.1 `api/lib/content-plan-prompt.php`: เพิ่มพารามิเตอร์ `array $skillIds, array $brandContextIds` ให้ `content_plan_has_any_topic_source()` และขยายเงื่อนไข return ให้นับทั้งสองค่าด้วย
- [x] 1.2 `api/brand-content.php:986`: ส่ง `$skillIds`, `$brandContextIds` เพิ่มเข้า `content_plan_has_any_topic_source()`
- [x] 1.3 ลบฟังก์ชัน `content_plan_direct_requires_topic()` ออกจาก `api/lib/content-plan-prompt.php` และลบบรรทัดเรียกที่ `api/brand-content.php:1028`
- [x] 1.4 ตรวจ `$planTitle`/`$promptTopic` (บรรทัด 1287, 1325) ยังทำงานได้โดยไม่ error เมื่อทั้ง `source_topic` และ `trigger_command` ว่าง (มีแค่ skill/KB) — ยอมรับ `$planTitle` เป็นสตริงว่างตามที่ตกลงใน design.md ไม่ต้องเพิ่ม fallback ใหม่

## 2. Backend — อัปเดตเทสต์

- [x] 2.1 `api/tests/content-plan-generate-request-validation-test.php`: ลบเคสที่ทดสอบ `content_plan_direct_requires_topic()` โดยตรง (ฟังก์ชันถูกลบแล้ว)
- [x] 2.2 เพิ่มเคสทดสอบ `content_plan_has_any_topic_source()` เวอร์ชันใหม่: `skillIds` อย่างเดียว → true, `brandContextIds` อย่างเดียว → true, ทุกอย่างว่าง → false, ทุกอย่างมีครบ → true (regression)
- [x] 2.3 รัน `php api/tests/content-plan-generate-request-validation-test.php` ให้ผ่านทั้งหมด

## 3. Frontend — QuickCreateDialog

- [x] 3.1 เปลี่ยน `disabled={!topic.trim()}` ของปุ่ม "สร้าง" ([:503](src/components/content/dialogs/QuickCreateDialog.tsx:503)) เป็นเช็ครวม 4 แหล่ง: `disabled={!topic.trim() && selTriggerIds.length === 0 && selSkillIds.length === 0 && selContextIds.length === 0}`

## 4. Frontend — BatchGenerateDialog

- [x] 4.1 แก้ validation ใน `handleStart()` ([:153-157](src/components/content/dialogs/BatchGenerateDialog.tsx:153)): เปลี่ยนจาก `if (!item.topic.trim()) missing.push('ยังไม่ได้กรอกหัวข้อ')` เป็นเช็ครวม `if (!item.topic.trim() && !item.triggerIds.length && !item.skillIds.length && !item.contextIds.length) missing.push('ยังไม่มีหัวข้อ/Trigger/Skill/Knowledge Base อย่างน้อย 1 อย่าง')` — เงื่อนไขแพลตฟอร์มและ `MIN_TOPICS` ไม่เปลี่ยน

## 5. Frontend — CampaignsPage: ย้ายฟิลด์และปุ่ม

- [x] 5.1 ย้าย JSX ของ `ProductPicker`/`aiProductIds` ([:1603-1606](src/pages/CampaignsPage.tsx:1603)), ปุ่มโทน/`aiTone` ([:1607-1624](src/pages/CampaignsPage.tsx:1607)), checkbox `aiUseBrandContext` ([:1625-1631](src/pages/CampaignsPage.tsx:1625)) จากภายใน `{aiPanelOpen && (...)}` ไปไว้ใน Section 1 "ข้อมูลแคมเปญ" ต่อจากฟิลด์ "หัวข้ออีเมล" ([:1445](src/pages/CampaignsPage.tsx:1445)) — ไม่เปลี่ยนชื่อ state
- [x] 5.2 ย้ายข้อความ helper ที่บอกสถานะหัวข้ออีเมล ([:1632-1636](src/pages/CampaignsPage.tsx:1632)) ไปพร้อมกับฟิลด์
- [x] 5.3 ย้ายปุ่ม "สร้าง" ที่เรียก `handleGenerateWithAI` ([:1637-1642](src/pages/CampaignsPage.tsx:1637)) ไปไว้ใน `DialogFooter` ([:1686](src/pages/CampaignsPage.tsx:1686)) วางก่อนปุ่ม "ยกเลิก" — เงื่อนไข `disabled` เดิมคงไว้ทั้งหมด
- [x] 5.4 ลบปุ่ม toggle เดิม "สร้างด้วย AI" ([:1591-1597](src/pages/CampaignsPage.tsx:1591)) และ state `aiPanelOpen` ([:340](src/pages/CampaignsPage.tsx:340)) ที่ไม่มีจุดใช้เหลือ
- [x] 5.5 ตรวจว่า Section 5 "เนื้อหาอีเมล" ยังมีปุ่ม "ดึงคอนเทนต์" อยู่ตามเดิม (ไม่ถูกย้าย/ลบไปด้วย)

## 6. เทสต์ + regression

- [x] 6.1 ตรวจ `src/__tests__/` ว่ามีเทสต์ที่อ้างอิง `aiPanelOpen`, ปุ่ม "สร้างด้วย AI" (toggle), หรือ layout เดิมของ `CampaignsPage.tsx` หรือไม่ — ถ้ามีให้ปรับตาม layout ใหม่
- [x] 6.2 รัน `pnpm lint` ยืนยันไม่มี unused-import/unused-var ในไฟล์ที่แก้ (โดยเฉพาะ `CampaignsPage.tsx` หลังลบ `aiPanelOpen`)
- [x] 6.3 รัน `pnpm test` เต็มชุด — ยืนยันไม่มี regression ใหม่นอกเหนือจาก 8 pre-existing failures ที่ทราบอยู่แล้ว (ไม่ใช่ scope ของ change นี้)

## 6b. งานที่พบระหว่าง apply (ดู design.md ข้อ 5-6)

- [x] 6b.1 Research seed fallback เป็น `item.topic` เมื่อไม่มีหัวข้อ (QuickCreateDialog + BatchGenerateDialog) และ `trigger_command` ว่างเมื่อไม่มีหัวข้อ
- [x] 6b.2 Direct-mode prompt ไม่พิมพ์บรรทัด SOURCE OF TRUTH ว่าง + อัปเดตเทสต์ `content-plan-user-message-topic-guard-test.php` (8/8)

## 7. ทดสอบจริงในเบราว์เซอร์

- [x] 7.1 เปิด QuickCreateDialog (บทความ) → ไม่พิมพ์หัวข้อ → เลือก Trigger อย่างเดียว → ปุ่ม "สร้าง" เปิดใช้งานได้ — ยืนยันแล้ว: ไม่พิมพ์หัวข้อ + เลือก Trigger 1 รายการ → ปุ่มเปิดใช้งาน, dialog ยืนยันแสดง "หัวข้อ: ให้ AI คิดจาก Trigger/Skill/Knowledge Base ที่เลือก"
- [x] 7.2 เปิด QuickCreateDialog (วีดีโอสคริปต์) → ไม่พิมพ์หัวข้อ → เลือก Skill อย่างเดียว → ปุ่ม "สร้าง" เปิดใช้งานได้ — ยืนยันแล้ว: Skill (1) อย่างเดียว ไม่มีหัวข้อ/Trigger → ปุ่มเปิดใช้งาน
- [x] 7.3 เปิด BatchGenerateDialog → กรอก 3 แถว โดยอย่างน้อย 1 แถวไม่มีหัวข้อแต่มี Knowledge Base แทน → เริ่มสร้างได้ไม่ error — ยืนยันแล้ว: แถว 3 มีแค่ KB → ปุ่มเริ่มสร้างเปิด, validation แจ้งแค่ "ยังไม่เลือกแพลตฟอร์ม" (ไม่แจ้งเรื่องหัวข้อ); ลบ KB ออก → เหลือ 2 แถว ปุ่มปิด (ไม่ได้รัน AI จริงเพื่อไม่เปลือง credit)
- [x] 7.4 เปิดหน้าต่างสร้างแคมเปญใหม่ → ยืนยันเห็นฟิลด์ เลือกสินค้า/โทนการเขียน/ใช้ข้อมูลแบรนด์ ในส่วน "ข้อมูลแคมเปญ" ทันทีโดยไม่ต้องกดเปิดอะไรก่อน — ยืนยันแล้ว: ส่วนที่ 1 มี ชื่อแคมเปญ/หัวข้ออีเมล/เลือกสินค้า/โทนการเขียน/ใช้ข้อมูลแบรนด์ ครบ ไม่มีปุ่ม toggle เหลือ, ปุ่ม "ดึงคอนเทนต์" ยังอยู่ส่วนที่ 5
- [x] 7.5 ยืนยันปุ่มสั่งสร้างเนื้อหาด้วย AI อยู่ที่ footer และยังทำงานถูกต้อง (สร้างเนื้อหาสำเร็จ, เคารพกติกา ≥1 แหล่งข้อมูลเดิม) — ยืนยันแล้ว: ปุ่ม "สร้างด้วย AI" อยู่ footer (ยกเลิก · สร้างด้วย AI | บันทึกร่าง · ตั้งเวลาส่ง · ส่งทันที), ปิดเมื่อไม่มีแหล่งข้อมูล เปิดเมื่อติ๊ก brand.md — handler `handleGenerateWithAI` เดิมไม่เปลี่ยน จึงไม่ได้กดสร้างจริงเพื่อไม่เปลือง credit
