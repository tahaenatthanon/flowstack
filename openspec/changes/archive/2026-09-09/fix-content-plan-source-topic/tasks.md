## 1. Backend fix (`api/brand-content.php`, action `generate-plan`)

- [x] 1.1 แก้ validation ที่บรรทัด ~666 จาก `if ($sourceTopic === '') jsonError('กรุณาระบุหัวข้อ');` เป็น `if ($isDirect && $sourceTopic === '') jsonError('กรุณาระบุหัวข้อ');` — Direct mode ยังบังคับเหมือนเดิมทุกประการ legacy mode อาศัย guard ที่บรรทัด 633 (ต้องมี triggerIds/triggerCommand/sourceTopic อย่างน้อยหนึ่งอย่าง) ที่ทำงานอยู่ก่อนหน้าแล้ว
- [x] 1.2 แก้จุด insert `content_items` ในลูป `foreach ($planItems as $item)` (บรรทัด ~978) ให้ resolve `source_topic` ต่อ item แทนการใช้ `$originalTopic` ตัวเดียวซ้ำทุก row: `$itemSourceTopic = $originalTopic !== '' ? $originalTopic : trim((string)($item['topic'] ?? ''));` แล้วใช้ `$itemSourceTopic` แทน `$originalTopic` เฉพาะใน parameter ของ `source_topic` column (ไม่กระทบ column อื่นที่ยังใช้ `$item['topic']`/`$originalTopic` ตามเดิม)
- [x] 1.3 อ่านทวนยืนยันว่า `$promptTopic` (บรรทัด ~919) และ `$planTitle` (บรรทัด ~956) ไม่ต้องแก้ไข — ทั้งสอง fallback ไป `$triggerCommand` สำหรับ legacy mode อยู่แล้วในโค้ดปัจจุบัน (เอกสารไว้ใน design.md decision 3) — ยืนยันแล้วว่าไม่มีการแก้ไข

## 2. Tests

- [x] 2.1 เพิ่ม PHP test ใหม่ `api/tests/content-plan-source-topic-test.php` — ระหว่างทำพบว่า logic การ resolve (บรรทัด ~978 เดิม) เป็นแค่ ternary ฝังอยู่ใน action ไม่ใช่ pure function จึงแยกออกมาเป็น `content_plan_item_source_topic()` ใน `content-plan-prompt.php` ก่อน (สอดคล้องกับ pattern เดิมของไฟล์นี้) แล้วเขียน unit test 6 เคสตรงกับฟังก์ชันนั้น — รันแล้ว 6/6 PASS ครอบคลุม legacy mode ไม่มี source_topic → ใช้ topic ของ item เอง, ไม่ throw เมื่อไม่มีข้อมูลเลย, trim ช่องว่าง
- [x] 2.2 **ปรับขอบเขต**: เงื่อนไข `if ($isDirect && ...)` เป็นโค้ดเส้นเดียวฝังอยู่ใน action `generate-plan` ทั้งก้อน (ไม่ใช่ pure function) จึง unit test แยกไม่ได้จริงโดยไม่ mock ทั้ง action — ย้ายการยืนยันไปเป็น live HTTP regression check ในขั้น 3.2 แทน (ยิง request `generation_mode=direct` ไม่มี `source_topic` ตรงไปที่ endpoint จริง ยืนยันว่ายัง 422 เหมือนเดิม)
- [x] 2.3 ครอบคลุมแล้วใน TC03 ของ `content-plan-source-topic-test.php` — ยืนยัน item คนละตัวเรียก `content_plan_item_source_topic('', ...)` ด้วย topic ต่างกันแล้วได้ผลลัพธ์ต่างกันจริง ไม่ใช่ค่าเดียวกันซ้ำ

## 3. Verification

- [x] 3.1 `php -l api/brand-content.php` และ `api/lib/content-plan-prompt.php` — ผ่านทั้งคู่
- [x] 3.2 รัน `content-plan-source-topic-test.php` (6/6 PASS) + suite เดิม `publish-gate-test.php` (18/18), `seo-aeo-gate-test.php` (20/20), `core-content-platform-output-test.php` (8/8) — ไม่มี regression; ยืนยันเพิ่มด้วย live HTTP request จริงว่า `generation_mode=direct` ไม่มี `source_topic` ยัง reject ด้วย "กรุณาระบุหัวข้อ" เหมือนเดิม (ครอบคลุม 2.2)
- [x] 3.3 `pnpm lint` (0 errors), `pnpm test` (24/24 files, 171/171 tests), `pnpm build` (สำเร็จ) — ไม่มี regression ทางอ้อม
- [x] 3.4 ทดสอบจริงผ่าน live API call (แทน UI click-through เพื่อความเร็วและแม่นยำในการตรวจ): ยิง `generate-plan` แบบ legacy (`trigger_command` เท่านั้น ไม่มี `source_topic`, `days=2`) → ได้ **HTTP 201** (เดิมจะเป็น 400 "กรุณาระบุหัวข้อ") ตรวจ DB โดยตรง (read-only) พบ 2 `content_items` แถวใหม่ ทั้งสองมี `source_topic` เท่ากับ `title` ของตัวเอง (คนละค่ากันจริง ไม่ใช่ trigger_command ซ้ำกันทั้งคู่) — ตรงตาม Option B ทุกประการ ไม่ได้แก้ไข/ลบข้อมูลอื่นใดระหว่างตรวจสอบ
