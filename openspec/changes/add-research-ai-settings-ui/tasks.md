## 1. Backend Settings Whitelist

- [x] 1.1 ใน `api/brand-content.php` action `global-settings` (ทั้ง update และ insert) ตรวจ `research_provider` อยู่ใน `['none','dataforseo','ai']` ก่อนบันทึก ถ้าไม่ใช่ให้ default `'none'`
- [x] 1.2 ไม่เพิ่ม field ใหม่ — ใช้ `research_provider` เดิม และไม่เปิดเผย key ในการโหลด settings

## 2. Hook Type + Payload

- [x] 2.1 ยืนยัน `ResearchProviderTestPayload` (`provider/login/password?`) และ `ResearchProviderTestResponse` (`ok/message/balance_usd?`) รองรับ provider `ai` โดยไม่ต้องเปลี่ยน signature (ปรับถ้าจำเป็น)
- [x] 2.2 `useTestResearchProvider()` ยังส่ง payload ตรง ๆ ไป `content-research.php?action=test` — ไม่ต้องแก้ logic (AI ส่งแค่ `{provider:'ai'}` จากฝั่ง form)

## 3. UI (`ResearchProviderForm.tsx`)

- [x] 3.1 เพิ่ม `<option value="ai">AI (Perplexity/Sonar)</option>` ใน dropdown ผู้ให้บริการ
- [x] 3.2 เมื่อ provider เป็น `ai`: ซ่อนฟิลด์ login, password, location_code (conditional render) คงแสดง language + cache_hours
- [x] 3.3 `canTestConnection` แยกเงื่อนไข: `ai` → true เสมอ, `dataforseo` → เงื่อนไขเดิม, `none` → false
- [x] 3.4 `handleTestConnection` แยก payload + toast ตาม provider (AI ส่ง `{provider:'ai'}` ไม่มี login/password และไม่พยายามอ่าน `balance_usd`)

## 4. Tests

- [x] 4.1 อัปเดต `src/__tests__/content/ResearchProviderForm.test.tsx` ให้ครอบคลุมตัวเลือก `ai` (dropdown มี `ai`, ฟิลด์ non-AI ถูกซ่อน, test payload ของ `ai` ไม่มี login/password)
- [x] 4.2 รัน `pnpm lint` และ `pnpm test` — ไม่มี regression
- [x] 4.3 รัน `php -l api/brand-content.php` — ไม่มี syntax error
