## Context

`PullFromContentDialog.tsx` (เปิดจากปุ่ม "ดึงคอนเทนต์" ในหน้าแคมเปญอีเมล) ดึงข้อมูลจาก `GET /content-items.php` โดยไม่ส่ง query param ใดๆ นอกจาก `search` — backend คืนทุกแถวของ tenant เสมอ ไม่กรองสถานะ ข้อมูลจริงตอนนี้ (2026-09-18): 50 รายการทั้งหมด มี 32 รายการ (64%) ที่ยังไม่ผ่านอนุมัติ (`draft` 17, `revision` 13, `pending_approval` 1, `rejected` 1) เทียบกับ 18 รายการที่พร้อมใช้จริง (`approved` 6, `published` 12)

Endpoint เดียวกันนี้ถูกเรียกจากอีกจุดเดียวคือ `useContent.ts` (ใช้โดย Content Planner) ซึ่งต้องเห็นทุกสถานะเพราะเป็นมุมมองงานภายใน — การเปลี่ยนแปลงใดๆ ต้องไม่กระทบ caller นี้

โปรเจกต์มี design system สำหรับ filter อยู่แล้ว:
- `STATUS_MAP` (`src/components/content/types.ts:584`) — label/color/icon ของทุกสถานะ (`published`, `draft`, `revision`, `pending_approval`, `approved`, `rejected`) พร้อมใช้ ไม่ต้องสร้างใหม่
- `PLATFORM_MAP` (`src/components/content/types.ts:623`) — label/color ของแต่ละแพลตฟอร์ม
- `parsePlatforms()` (`src/lib/contentPlatforms.ts:14`) — แตกค่า platform ที่เป็น comma-joined string ให้เป็น array
- pill-button toggle pattern ใน `ContentPlannerPage.tsx` (บรรทัด ~445-490) — ต้นแบบ UI ที่มีอยู่แล้วสำหรับ type/platform filter

## Goals / Non-Goals

**Goals:**
- เพิ่มตัวกรอง 3 มิติใน `PullFromContentDialog`: ประเภท → สถานะ → แพลตฟอร์ม (เรียงตามนี้)
- ตัวกรองสถานะ default = `approved,published` เท่านั้น กรองที่ backend จริง (ไม่ใช่แค่ซ่อนที่ UI) เพื่อไม่ให้ draft/rejected หลุดมาถึง browser โดยไม่ตั้งใจ
- ผู้ใช้เปลี่ยน filter สถานะเพื่อดูสถานะอื่นได้ภายหลังถ้าต้องการ (ไม่ได้ล็อกตายตัว)
- ใช้ของเดิมที่มีอยู่แล้วให้มากที่สุด (`STATUS_MAP`, `PLATFORM_MAP`, `parsePlatforms`, pill-button pattern) ไม่สร้างของใหม่ซ้ำซ้อน

**Non-Goals:**
- ไม่แก้ query param ของ endpoint สำหรับ caller อื่น (`useContent.ts` ยังเรียกแบบเดิมไม่ส่ง `status` เหมือนเดิม)
- ไม่เพิ่มตัวกรองช่วงวันที่หรือ content plan ในรอบนี้ (ไม่ใช่มิติที่ตกลงกันไว้)
- ไม่เปลี่ยน UI/behavior ของ `ContentListTab`/`ContentPlannerPage` ที่มีตัวกรองอยู่แล้ว — คนละหน้าจอ คนละ state

## Decisions

### Decision 1: `?status=` เป็น comma-separated list ไม่ใช่ single value
เพื่อให้ default `approved,published` (สองค่าพร้อมกัน) ทำงานได้ในคำขอเดียว ใช้รูปแบบเดียวกับ `?search=` เดิมคือ optional string param แล้ว backend แตกด้วย `explode(',', ...)` กรองด้วย `IN (...)` — สอดคล้องกับที่ `platform`/`platforms` ใน endpoint เดียวกันนี้ก็เก็บเป็น comma/JSON list อยู่แล้ว ไม่ใช่แนวคิดใหม่ในไฟล์นี้

### Decision 2: Backend whitelist ค่า status ด้วย `$validStatus` เดิม
`api/content-items.php` มีตัวแปร `$validStatus = ['published', 'draft', 'revision', 'pending_approval', 'rejected', 'approved']` อยู่แล้ว (ใช้ตอน PUT) — ใช้ชุดเดียวกันกรองค่าที่ส่งมาทาง GET เพื่อกัน SQL injection ทาง `IN (...)` (ค่าที่ไม่อยู่ใน whitelist ถูกตัดทิ้งเงียบๆ ไม่ error)

### Decision 3: Type/Platform filter เป็น client-side, Status filter เป็น server-side
ไม่สมมาตรกันโดยตั้งใจ — Type/Platform ไม่มีประเด็นด้าน data-safety (ต่างจาก draft ที่เนื้อหาอาจยังไม่ผ่านตรวจ) จึงทำแบบเดิมที่มี pattern อยู่แล้ว (`ContentItemList.tsx`) ได้เลย เร็วกว่าและไม่ต้องแก้ backend เพิ่ม ส่วน Status ต้องเป็น server-side เพราะเป้าหมายคือ "draft ต้องไม่หลุดมาถึง browser" ไม่ใช่แค่ "ซ่อนไม่ให้เห็นบนจอ"

### Decision 4: React Query key ต้องรวม status filter
`queryKey: ['content', 'items']` เดิมใช้ key เดียวไม่ว่าจะเรียกจากไหน — ถ้า `PullFromContentDialog` ส่ง `status` param ต่างจาก `useContent.ts` (ไม่ส่ง) ต้องแยก query key เป็น `['content', 'items', { status }]` มิฉะนั้น React Query cache จะปนกันระหว่าง 2 caller (แคชของอันนึงทับอีกอันที่ควรเห็นข้อมูลคนละชุด)

## Risks / Trade-offs

- **[Risk]** ถ้าลืมแยก React Query key (Decision 4) จะเกิด cache bleed — เปิด Content Planner ก่อนแล้วเปิด "ดึงคอนเทนต์" อาจเห็น cache เก่าที่ยังไม่กรอง หรือกลับกัน → **Mitigation:** ทดสอบเปิดทั้งสองหน้าในลำดับต่างกันระหว่าง apply เพื่อยืนยันไม่ปนกัน
- **[Risk]** ผู้ใช้เปลี่ยน filter สถานะไปดู draft เองภายหลัง แล้วเผลอกดเลือกอยู่ดี (filter ป้องกันแค่ default ไม่ได้ป้องกันการตั้งใจเลือก) → **Mitigation:** ยอมรับได้ตามที่ตกลงกันไว้ตอน explore — เป้าหมายคือกัน "เผลอ" ไม่ใช่ล็อกสิทธิ์แบบเข้มงวด (ผู้ใช้ในระบบเห็นข้อมูลได้อยู่แล้วถ้าตั้งใจดู)
- **[Risk]** Whitelist ค่า status ผิดพลาด (เผลอพิมพ์ผิดใน query param) จะถูกตัดทิ้งเงียบๆ กลายเป็นไม่กรองอะไรเลย (เท่ากับ WHERE status IN () ว่าง) → **Mitigation:** ถ้า array ว่างหลัง whitelist ให้ fallback เป็น "ไม่ใส่เงื่อนไข status" (พฤติกรรมเดิม) แทนที่จะสร้าง SQL ผิดรูป

## Migration Plan

1. แก้ `api/content-items.php` GET handler เพิ่ม optional `?status=` — ทดสอบว่าไม่ส่ง param ยังคืนผลเหมือนเดิมทุกประการ (regression ต่อ `useContent.ts`)
2. แก้ `PullFromContentDialog.tsx`: เพิ่ม state 3 ตัว (type/status/platform filter), ปรับ query key + query param, เพิ่ม pill-button UI ตามลำดับ ประเภท → สถานะ → แพลตฟอร์ม โดยใช้ `STATUS_MAP`/`PLATFORM_MAP`/`parsePlatforms` ที่มีอยู่แล้ว
3. ทดสอบ: เปิด dialog ครั้งแรกเห็นแค่ approved+published, กดเปลี่ยน filter เห็น draft ได้, ปิดเปิดใหม่กลับไป default เดิม
4. ทดสอบ regression: Content Planner ยังเห็นทุกสถานะเหมือนเดิม ไม่มี cache ปนกัน
5. `pnpm lint` + `pnpm build`

ไม่มี DB migration ในงานนี้ (ใช้ ENUM เดิม) ย้อนกลับได้ด้วย git revert เพราะ backend param เป็น optional ล้วนๆ ไม่ breaking

## Open Questions

(ไม่มี — ตัดสินใจครบทุกจุดระหว่าง explore แล้ว)
