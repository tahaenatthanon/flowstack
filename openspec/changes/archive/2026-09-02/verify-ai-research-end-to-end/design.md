# Design: End-to-End Verification (Phase 5)

## Context

Provider `ai` ต่อครบ 4 เฟสแล้ว (`research_fetch_ai`/`research_test_ai` ใน adapter, dispatch ใน `content-research.php`, ตัวเลือก `ai` ใน settings UI) แต่ยังไม่มีรอบตรวจจริงที่ยิง endpoint ต่อเนื่องกัน เฟสนี้เป็น**รอบตรวจ** ไม่ใช่โค้ด feature — เป้าหมายคือพิสูจน์ว่า flow จริงทำงานและ SEO/legacy ไม่ถอยหลัง

## Goals / Non-Goals

**Goals:**
- ตรวจ `test`/`fetch`/`analyze`/cache/tenant isolation ของ provider `ai` ผ่าน API จริง
- ยืนยัน metric ปริมาณเป็น `NULL` และ analyze ใช้ Writing AI
- ยืนยัน content generation (มี/ไม่มี research) และ SEO ไม่ถอยหลัง
- ผ่าน lint/build/test + PHP syntax
- บันทึกผล "ผ่าน/ไม่ผ่าน" ลง docs

**Non-Goals:**
- ไม่แก้โค้ด production (ถ้าพบ bug → กลับไปแก้ใน change ที่เกี่ยวข้อง หรือแจ้ง)
- ไม่สร้าง route/menu/permission ใหม่
- ไม่สร้าง test automation framework ใหม่ — ใช้ cURL/สคริปต์ CLI + tests ที่มีอยู่

## Decisions

### D1: ตรวจผ่าน HTTP จริง (cURL/CLI) + unit tests ที่มีอยู่ ไม่สร้าง harness ใหม่
ยิง endpoint ผ่านสคริปต์ CLI ชั่วคราว (เช่นเดียวกับ `scripts/spike-verify-web-search.php`) เพื่อพิสูจน์ flow จริง ประกอบกับ `pnpm test` (85 tests) และ `php api/tests/*`
- **Alternative**: เขียน Vitest e2e ใหม่ — ตัด เพราะต้อง mock backend PHP ทั้งหมด ไม่ได้พิสูจน์ flow จริง
- **Rationale**: Phase 5 ต้องพิสูจน์ "ทำงานจริง" ไม่ใช่แค่ unit logic — reuse แนวทาง spike Phase 1

### D2: ใช้ tenant/settings ที่เลือก provider `ai` เป็น precondition
ก่อนยิง `fetch` ต้องมี `content_global_settings.research_provider='ai'` และ credential `provider-openrouter` ใน `ai_providers` — ตรวจ precondition ก่อน แล้วบันทึกผลชัดเจน
- **Rationale**: ถ้า precondition ไม่พร้อม ผลตรวจจะ false-negative — ต้องแยก "precondition ไม่พร้อม" ออกจาก "flow พัง"

### D3: แยก "ผ่าน" / "ไม่ผ่าน" / "blocked by precondition" ในรายงาน
ผลตรวจแต่ละข้อมี 3 สถานะ ไม่ใช่ binary — บันทึกลง `docs/ai-research-end-to-end-verification.md` (ต่อจาก verification doc ของ Phase 1)
- **Rationale**: บางข้อ (เช่น AI error→failed) ต้องกระตุ้นเงื่อนไขจริงได้; ถ้าทำไม่ได้ให้ระบุ blocked ไม่ใช่ fail

### D4: ไม่แตะ SEO logic — ตรวจเท่านั้น
SEO gate / checklist / `seo_evaluate()` ตรวจว่าไม่ crash และไม่ถอยหลัง โดยไม่แก้โค้ด (ตรง "SCOPE DRIFT")
- **Rationale**: Out of scope ตั้งแต่แผน overview — แค่ยืนยัน baseline

## Risks / Trade-offs

- [AI fetch เสียค่าใช้จริง (OpenRouter)] → ใช้ seed เดียว/รอบเดียว อาศัย cache ตรวจซ้ำโดยไม่เสียเงินเพิ่ม
- [credential/provider ไม่พร้อมใน env ปัจจุบัน] → บันทึก "blocked by precondition" แทน fail; แจ้งผู้ใช้ให้ตั้งค่า provider-openrouter
- [ผลตรวจขึ้นกับ network/model ที่ผันผวน] → แต่ละข้อบันทึกหลักฐาน (HTTP status, raw log) เช่นเดียวกับ spike

## Migration Plan

- ไม่มี schema/production change — สร้างสคริปต์ตรวจชั่วคราวใน `scripts/` + รายงานใน `docs/`
- Rollback: ลบสคริปต์ชั่วคราว (ไม่กระทบ production)

## Open Questions

- ไม่มี — เกณฑ์จบล็อกจาก plan overview + capability เดิมแล้ว
