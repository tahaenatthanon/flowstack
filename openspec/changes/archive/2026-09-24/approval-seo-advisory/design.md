## Context

- `content_quality_gate_check()` ([publish-dispatch.php:258](api/lib/publish-dispatch.php:258)) ถูกเรียกจาก 2 จุดตอนขออนุมัติ: `api/approvals.php:148` (สร้าง approval chain) และ `api/content-items.php:307` (PATCH ตั้ง `status=pending_approval`) — ทั้งคู่ 422 ทันทีถ้า `blocked=true` ก่อนเปลี่ยนสถานะหรือสร้าง approval request ใดๆ
- `final_publish_gate_check()` ([publish-dispatch.php:286](api/lib/publish-dispatch.php:286)) เรียก `quality_required_gate()` 2 ครั้งอิสระ: ครั้งแรกเช็คแค่ marker `quality_checked_at` (บรรทัด 301, ทุก platform), ครั้งที่สองประเมิน SEO/AEO เต็มรูปแบบเฉพาะ platform ที่ไม่ใช่ `SCRIPT_PLATFORMS` (บรรทัด 318) — ทั้งสองจุดนี้ประเมินสดใหม่ทุกครั้งจาก DB ไม่สนว่าเคยผ่าน gate ตอนขออนุมัติมาแล้วหรือไม่ (เจตนาเดิม: กันแก้เนื้อหาหลังอนุมัติจนคุณภาพตก — แต่กลายเป็นด่านที่สองที่ซ้ำกับด่านแรกเมื่อ SEO ไม่ใช่ตัวตัดสินอีกต่อไป)
- `content_quality_gate_check()`/`quality_required_gate()`/`quality_required_status()` เองไม่เปลี่ยน — ยังใช้ที่ Generate เหมือนเดิม (evaluate + AI repair 1 รอบ, เขียน `quality_checked_at`) เพราะเป้าหมายเรื่องคุณภาพตอนสร้างเนื้อหายังคงอยู่ แค่ไม่ใช้ตัดสิน block/allow ที่ขั้นอนุมัติ/เผยแพร่แล้ว
- ฝั่ง UI: `ContentApprovalTab.tsx` fetch SEO/AEO checklist ตอนเปิด approve-confirm dialog เท่านั้น ([:62-80](src/components/content/tabs/ContentApprovalTab.tsx:62)) และมีคอลัมน์ "จัดการ" พร้อม 3 ปุ่มในทุกแถว ([:316](src/components/content/tabs/ContentApprovalTab.tsx:316), [:362-401](src/components/content/tabs/ContentApprovalTab.tsx:362)) — `ContentDetailView.tsx` มี pattern เดียวกัน (fetch ผูกกับ `approveConfirm` ที่ [:67-82](src/components/content/views/ContentDetailView.tsx:67)) และมีปุ่มอนุมัติ/ขอแก้ไข/ปฏิเสธอยู่แล้วเมื่อ `context='approval'` (capability `approval-detail-actions` เดิม)

## Goals / Non-Goals

**Goals:**
- ขออนุมัติได้เสมอไม่ว่าผล SEO/AEO จะเป็นอย่างไร (ยังต้องผ่าน Approval gate/Platform gate อื่นตามเดิม)
- เผยแพร่ได้ทันทีหลังอนุมัติ ไม่ถูก SEO/AEO บล็อกซ้ำอีกครั้งที่ขั้นเผยแพร่
- manager เห็นผล SEO/AEO ทันทีที่เปิดดูเนื้อหาในหน้ารายละเอียด (ก่อนตัดสินใจ) ไม่ต้องกดอนุมัติก่อนถึงจะเห็น
- บังคับให้ manager เปิดดูเนื้อหาก่อนอนุมัติ/ขอแก้ไข/ปฏิเสธเสมอ (ตัดทางลัดกดจากตาราง)

**Non-Goals:**
- ไม่เปลี่ยนพฤติกรรม Generate/AI repair ใดๆ
- ไม่เปลี่ยน Approval gate (`approved_at`) หรือ Platform gate — ยังบล็อกเหมือนเดิมทุกอย่าง
- ไม่ลบ `content_quality_gate_check()`/`quality_required_gate()`/`quality_required_status()` — ฟังก์ชันเหล่านี้ยังใช้ที่ Generate และยังมีเทสต์ยืนยันพฤติกรรมอยู่ (`quality-required-tiers-test.php`) แค่เลิกถูกเรียกจาก 2 จุดที่ระบุ
- ไม่แตะ video readiness gate (`video_readiness_gate_check()`) ที่เพิ่งเพิ่มใน change `publish-video-facebook` — คนละเรื่องกัน ยังบล็อกเหมือนเดิม

## Decisions

### 1. ลบการเรียก quality gate ที่ 2 จุดตรงๆ แทนการเพิ่ม flag ปิด/เปิด
`api/approvals.php:134-152` และ `api/content-items.php:295-312` — ลบทั้ง block การเรียก `content_quality_gate_check()` ออกตรงๆ (คงการ SELECT content item ที่มีอยู่แล้วไว้เท่าที่จำเป็นสำหรับงานอื่นในฟังก์ชัน เช่น `approvals.php` ยังต้องเช็คว่า content มีอยู่จริงก่อน 404)
- ทางเลือกที่ไม่เลือก: เพิ่ม `company_settings` flag `seo_gate_blocks_approval` แบบเปิด/ปิดได้ — เกินความต้องการจริง (requirement คือ "ตัดออกเลย" ไม่ใช่ "ให้เลือกได้") เพิ่ม branch ที่ไม่มีใครทดสอบ/ใช้จริง

### 2. `final_publish_gate_check()` ตัด quality gate ทั้ง marker-check และ SEO/AEO-evaluate ออก ไม่ใช่แค่จุดเดียว
ต้องตัดทั้ง 2 บรรทัด (301 และ 318) ไม่ใช่แค่บรรทัดใดบรรทัดหนึ่ง เพราะทั้งคู่เป็น `quality_required_gate()` เหมือนกัน (marker-only vs full evaluate) — ถ้าตัดแค่ full evaluate (318) จะยังเหลือ marker gate (301) บล็อกคอนเทนต์ที่ไม่เคยกด "ตรวจ SEO/AEO ใหม่" เลย ซึ่งขัดกับ "เผยแพร่ได้ทันที" ที่ยืนยันไว้
- ผลข้างเคียงที่ตั้งใจ: แยก `SCRIPT_PLATFORMS` ออกจาก non-script ไม่มีความหมายอีกต่อไป (เดิมแยกเพราะ social ไม่มี Quality gate แต่ web/CMS มี — ตอนนี้ทั้งคู่ไม่มี Quality gate เหมือนกัน) เอา branch นี้ออกด้วย เหลือแค่ Approval gate → Platform gate → Video readiness gate → ผ่าน
- ทางเลือกที่ไม่เลือก: คง marker-check ไว้ (บังคับต้องกด "ตรวจ SEO/AEO ใหม่" อย่างน้อยครั้งนึงก่อนเผยแพร่ แม้ผลจะเป็นอะไรก็ได้) — ดูเหมือนประนีประนอมดี แต่ขัดกับคำตอบที่ยืนยันชัดแล้วว่า "เผยแพร่ได้ทันที" ไม่มีเงื่อนไขเพิ่ม และจะสร้างสถานะกำกวมใหม่ (บล็อกด้วยเหตุผลที่ไม่ใช่ SEO ไม่ผ่าน แต่เป็น "ยังไม่ได้กดตรวจ") ที่ไม่มีใครขอ

### 3. คง `content_quality_gate_check()`/`quality_required_gate()` ไว้ทั้งฟังก์ชัน ไม่ลบ
แม้จะไม่มี production caller เหลือสำหรับ `content_quality_gate_check()` หลัง change นี้ (Generate เรียก `quality_required_status()`/`quality_should_repair()` โดยตรง ไม่ผ่าน `content_quality_gate_check()`) แต่ยังมีเทสต์ 7 เคสใน `quality-required-tiers-test.php` ที่ยืนยันพฤติกรรมของฟังก์ชันนี้โดยตรง และ `quality_required_gate()` เองยังถูกใช้เป็น building block ที่มีความหมายชัดเจน (ตัดสิน SEO/AEO ผ่าน/ไม่ผ่านสำหรับ platform เว็บ/CMS) — เก็บไว้เผื่อจุดอื่นในอนาคตอยากเช็คแบบเดียวกันโดยไม่บล็อก (เช่น badge เตือนในหน้าอื่น) ดีกว่าลบแล้วต้องเขียนใหม่
- ทางเลือกที่ไม่เลือก: ลบทิ้งทั้งฟังก์ชันและอัปเดตเทสต์ให้เรียก `quality_required_gate()` ตรงๆ — เพิ่มความเสี่ยงเปลี่ยนเทสต์ที่ผ่านอยู่แล้วโดยไม่จำเป็น ไม่ได้อยู่ใน scope ของสิ่งที่ขอ

### 4. ย้ายจุด fetch SEO/AEO จาก "ตอนกดอนุมัติ" เป็น "ตอนเปิดดูเนื้อหา"
`ContentDetailView.tsx`: เปลี่ยน dependency ของ `useEffect` ที่ fetch `seo-checklist`/`aeo-checklist` ([:67-82](src/components/content/views/ContentDetailView.tsx:67)) จาก `[approveConfirm, item.id, item.type]` เป็น trigger ตอน component mount/`item.id` เปลี่ยน (เงื่อนไขคงเดิม: ข้าม fetch ถ้า `item.type === 'video'` และเฉพาะ `context === 'approval'` เท่านั้น — ฝั่งผู้สร้างเนื้อหา `context='content'` ไม่ต้องเห็นตรงนี้เพราะมีแผงผลตรวจ SEO/AEO ของตัวเองอยู่แล้วในหน้าคอนเทนต์ปกติ)
- ตัด `QualityChecklist` ออกจาก approve-confirm dialog ทั้ง `ContentApprovalTab.tsx` ([:461-462](src/components/content/tabs/ContentApprovalTab.tsx:461)) และ `ContentDetailView.tsx` ([:469-470](src/components/content/views/ContentDetailView.tsx:469)) — ย้ายไปแสดงในส่วนเนื้อหาหลักของหน้ารายละเอียดแทน (ใต้ข้อมูลคอนเทนต์ ก่อนแถบปุ่ม action)
- ตัด UI ส่วน `approveBlocked`/`เกต SEO/AEO เปิดอยู่ — ต้องแก้ข้อบังคับก่อนอนุมัติ` ออกทั้งหมด (ไม่มี blocked state ให้แสดงอีกต่อไป — ปุ่ม "อนุมัติ" กดได้เสมอเมื่อ `status='pending_approval'`)

### 5. ตัดคอลัมน์ "จัดการ" ออกจากตาราง ไม่ใช่แค่ซ่อนด้วย CSS
`ContentApprovalTab.tsx`: ลบ `<TableHead>` "จัดการ" ([:316](src/components/content/tabs/ContentApprovalTab.tsx:316)) และทั้ง `<TableCell>` ที่มี 3 ปุ่ม + สถานะ "ดำเนินการแล้ว" ([:361-407](src/components/content/tabs/ContentApprovalTab.tsx:361)) ออกจากโครงสร้างตารางเลย (ไม่ใช่ conditional render เป็น `null` เพราะจะเหลือ column header กับ column width ที่ไม่มีความหมาย) — `onClick={() => setDetailItem(item)}` ที่ตัวแถว ([:334](src/components/content/tabs/ContentApprovalTab.tsx:334)) ยังอยู่เหมือนเดิม เป็นทางเดียวที่เหลือให้เข้าถึง action
- state/handler ที่เกี่ยวกับปุ่มเดิมในตาราง (`confirmApprove`, `reasonDialog`, `handleApprove`, approve-confirm `Dialog` ทั้งก้อน) ลบทิ้งได้ทั้งหมดเพราะไม่มีจุดเรียกใช้เหลือ — `ContentDetailView` (`context='approval'`) มี handler ของตัวเองแยกต่างหากอยู่แล้ว (`approveConfirm`, `reasonDialog` ใน component นั้น) ไม่ต้องแชร์กัน

## Risks / Trade-offs

- [manager อนุมัติคอนเทนต์ SEO แย่ไปโดยไม่ตั้งใจ] → ผล SEO/AEO ยังแสดงชัดเจนตอนเปิดดู (ข้อ 4) และบังคับเปิดดูก่อนเสมอ (ข้อ 5) — ความเสี่ยงที่เหลือคือ manager เห็นแล้วเลือกอนุมัติเองซึ่งเป็นเจตนาของ change นี้ ไม่ใช่บั๊ก
- [เนื้อหาที่เคยอนุมัติไว้ตอน SEO ผ่าน แล้วถูกแก้จนแย่ลงหลังอนุมัติ] → กติกาเดิมที่ยังคงอยู่: แก้ field ที่มีผลต่อการอนุมัติ (`approvalSensitiveFields`) หลังอนุมัติแล้ว จะล้าง `approved_at` กลับเป็น `revision` เสมอ (ไม่เกี่ยวกับ change นี้) — คอนเทนต์ที่ approved อยู่จริงคือเวอร์ชันที่ manager เห็นตอนอนุมัติ
- [เทสต์เดิมที่ยืนยันพฤติกรรม blocked ที่ 2 จุดนี้จะพัง] → `publish-gate-test.php`/`quality-required-tiers-test.php` มีเคสที่ยืนยันว่า `final_publish_gate_check()` บล็อกด้วย SEO/AEO (เช่น TC04-TC06 เดิม) — ต้องปรับ assertion ให้ตรงกับพฤติกรรมใหม่ (ไม่บล็อกอีกต่อไป) เป็นส่วนหนึ่งของ tasks ไม่ใช่ regression ที่ไม่ได้ตั้งใจ
