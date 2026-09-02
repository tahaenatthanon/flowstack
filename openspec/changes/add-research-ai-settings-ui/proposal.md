## Why

ผู้ดูแลยังเลือก Research AI (`provider='ai'`) ผ่าน UI ไม่ได้ — dropdown ผู้ให้บริการใน `ResearchProviderForm.tsx` มีแค่ `none`/`dataforseo` และ backend settings ยังไม่ whitelist ค่า `ai` ทั้งที่ dispatch (Phase 3) รองรับ provider `ai` แล้ว — จึงต้องเปิดตัวเลือกและปรับ UI/hook ให้ผู้ดูแลสลับไปใช้ AI web search ได้จริง

## What Changes

- เพิ่มตัวเลือก `AI (Perplexity/Sonar)` (value `ai`) ใน dropdown ผู้ให้บริการของ `ResearchProviderForm.tsx`
- เมื่อ provider เป็น `ai`: ซ่อน/disable ฟิลด์ login, password, location_code (ไม่เกี่ยวข้อง) คงแสดง language + cache_hours และปุ่มทดสอบการเชื่อมต่อ active โดยไม่ต้องกรอก login/password
- เมื่อ provider เป็น `dataforseo`: คงพฤติกรรมเดิมทุกอย่าง
- `useTestResearchProvider()` payload รองรับ provider `ai` (ไม่ต้องมี login/password); type response คง `ok`/`message` โดย `balance_usd` optional
- backend `brand-content.php` action `global-settings`: whitelist `research_provider` เป็น `none`/`dataforseo`/`ai` (ไม่เพิ่ม field ใหม่)
- ข้อความภาษาไทยทั้งหมด; ไม่เปิดเผย credential

## Capabilities

### New Capabilities

- `ai-research-settings-ui`: ข้อกำหนด UI และ settings สำหรับเลือก Research AI เป็น provider — dropdown มีตัวเลือก `ai`, ฟิลด์ login/password/location ถูกซ่อนเมื่อเลือก `ai`, backend ยอมรับ `research_provider='ai'`, ปุ่มทดสอบทำงานโดยไม่เปิดเผย credential และ settings เดิม (DataForSEO) ยังอยู่ครบ

### Modified Capabilities

<!-- ไม่มี requirement ของ capability เดิมถูกเปลี่ยน — content-research-settings ถูกเขียน provider-agnostic อยู่แล้ว (ค่า provider เป็น string) และ DataForSEO path ไม่ถอยหลัง -->

## Impact

- แก้ไข: `src/components/brand/ResearchProviderForm.tsx`, `src/hooks/useContent.ts` (type/payload ของ `useTestResearchProvider`), `api/brand-content.php` (whitelist `research_provider` ใน `global-settings`)
- อ้างอิง (อ่าน ไม่แก้): `api/content-research.php` (dispatch Phase 3), `api/lib/keyword-research.php` (`research_test_ai`)
- ไม่กระทบ schema, ไม่ลบ settings เดิม (login/password/location ยังคงอยู่ใน DB และกลับมาใช้ได้เมื่อสลับกลับเป็น dataforseo)
