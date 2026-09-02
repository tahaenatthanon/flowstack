# Design: Settings & UI (Phase 4)

## Context

`ResearchProviderForm.tsx` ปัจจุบันมี dropdown provider แค่ `none`/`dataforseo` และมีฟิลด์ login/password/location/language/cache แสดงครบทุกค่า โดย `canTestConnection = provider === 'dataforseo' && login !== '' && (...)` และ backend `brand-content.php` action `global-settings` รับ `research_provider` แบบตรง ๆ (ไม่ whitelist) — dispatch (Phase 3) รองรับ `provider='ai'` แล้ว เหลือแค่เปิดทาง UI + settings

## Goals / Non-Goals

**Goals:**
- เพิ่มตัวเลือก `ai` ใน dropdown และซ่อนฟิลด์ non-AI เมื่อเลือก `ai`
- ให้ปุ่มทดสอบเรียก `test` ด้วย provider `ai` โดยไม่ต้อง login/password
- whitelist `research_provider` backend เป็น `none`/`dataforseo`/`ai`
- คง settings DataForSEO เดิมไว้ ไม่ลบ ไม่ leak credential

**Non-Goals:**
- ไม่เปลี่ยน `content-research.php` dispatch (Phase 3 ทำแล้ว)
- ไม่เพิ่ม field/คอลัมน์ใหม่ (ใช้ `research_provider` เดิม)
- ไม่แสดง/แก้ key ของ Research AI ใน UI (อยู่ที่ Admin > AI Settings)
- ไม่แตะ flow ANALYZE / generate-article

## Decisions

### D1: ซ่อน (conditional render) แทน disable ฟิลด์ non-AI
เมื่อ provider เป็น `ai` ใช้ conditional render ซ่อน login/password/location_code (ไม่ render เลย) แทน `disabled` — คงแสดงเฉพาะ language + cache_hours
- **Alternative**: ใช้ `disabled` attribute — ตัด เพราะ UI จะโหลด 3 ฟิลด์ว่าง ๆ ดูสับสน และผูก label `DataForSEO Login` หลงเหลือ
- **Rationale**: ชัดเจนว่าฟิลด์ไม่เกี่ยวข้องกับ AI และตรงหลัก "NO MAGIC"

### D2: `canTestConnection` ขยายเงื่อนไขแยกตาม provider
- `provider === 'ai'` → test ได้เสมอ (credential ของ AI resolve จาก `ai_providers`/env ที่ backend ไม่ใช่จากฟอร์ม)
- `provider === 'dataforseo'` → เงื่อนไขเดิม (login + stored/entered password)
- `provider === 'none'` → disabled
- **Rationale**: AI ไม่มี login/password ในฟอร์ม การ test จึงไม่ผูก credential ของฟอร์ม — สอดคล้องกับ design Phase 3 (test ของ AI เรียก `research_test_ai($db)`)

### D3: `handleTestConnection` แยก payload ตาม provider
- provider `ai`: ส่ง `{ provider: 'ai' }` เท่านั้น (ไม่ส่ง login/password)
- provider `dataforseo`: ส่ง `{ provider, login, password? }` เดิม
- toast แยกข้อความ: AI สำเร็จ → "เชื่อมต่อ AI Research สำเร็จ"; dataforseo → คงข้อความเดิม + balance
- **Rationale**: response ของ AI ไม่มี `balance_usd` — ต้องไม่พยายามอ่าน balance จาก AI test

### D4: whitelist `research_provider` ที่ backend
ใน `brand-content.php` global-settings (ทั้ง update และ insert) ตรวจ `$body['research_provider']` อยู่ใน `['none','dataforseo','ai']` ถ้าไม่ใช่ให้ default `'none'` (หรือ jsonError) — ป้องกันค่าขยะลง DB
- **Alternative**: jsonError 400 เมื่อค่าผิด — ตัด เพราะ settings form อาจส่ง partial; default `none` ปลอดภัยกว่า
- **Rationale**: กัน injection ค่า provider ปลอม และตรง "NO MAGIC" ตรวจที่ขอบ

### D5: ไม่เพิ่ม type field ใหม่ใน `useContent.ts` — ขยาย payload/response ที่มีอยู่
- `ResearchProviderTestPayload` คง `provider/login/password?` (login/password optional อยู่แล้ว) — รองรับ `ai` โดยไม่เปลี่ยน signature
- `ResearchProviderTestResponse` คง `ok/message` + `balance_usd?` (optional อยู่แล้ว) — AI ไม่มี balance ก็ไม่ต้องแก้
- **Rationale**: type เดิมรองรับอยู่แล้ว ไม่ต้องแตะมาก ลดความเสี่ยง type churn

## Risks / Trade-offs

- [AI test ยัง fail เมื่อ credential ไม่พร้อม (env/DB)] → toast แสดง "เชื่อมต่อไม่สำเร็จ" ภาษาไทย ไม่แสดง key
- [ผู้ใช้สลับ provider แล้วลืมบันทึก] → ค่า state reset จาก settings เมื่อ reload (useEffect) — พฤติกรรมเดิม
- [สลับกลับ dataforseo แล้ว login/password หาย] → design D6 ชี้ว่าเราไม่แตะค่าที่บันทึกไว้ใน DB; form โหลด `research_api_login` กลับมา และ password ใช้ค่าเดิมเมื่อเว้นว่าง (existing behavior)
- [whitelist เปลี่ยน default เป็น none อาจทำให้ค่าที่ frontend ส่งผิดถูก ignore] → default none ปลอดภัย (ไม่เปิด fetch โดยไม่ตั้งใจ)

## Migration Plan

- ไม่มี schema change — แก้ 3 ไฟล์ (React component, hook type/payload, backend settings)
- Deploy: แก้ไฟล์ → `pnpm lint` + `pnpm test` (มี `ResearchProviderForm.test.tsx` ต้องอัปเดตตาม) + `php -l api/brand-content.php`
- Rollback: revert 3 ไฟล์

## Open Questions

- ไม่มี — ค่า provider string `ai`, model, credential path ล็อกจาก Phase 1–3 แล้ว
