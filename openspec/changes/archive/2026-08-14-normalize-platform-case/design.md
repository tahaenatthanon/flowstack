## Context

`platformCounts` ใน `ContentDashboardPage.tsx`:

```ts
const platformCounts = items.reduce<Record<string, number>>((acc, item) => {
  const p = item.platform ?? 'unknown';
  acc[p] = (acc[p] || 0) + 1;
  return acc;
}, {});
```

ค่า platform ใน DB มีทั้ง `"Facebook"` (จาก prompt template AI) และ `"facebook"` (default) → นับแยกเป็น 2 key

## Goals / Non-Goals

**Goals:**
- นับรวมแพลตฟอร์มเดียวกัน (case-insensitive) ใน widget "แพลตฟอร์ม"
- ป้องกันไม่ให้เกิดข้อมูล platform สะกดต่างกันในอนาคต (normalize ฝั่ง backend)

**Non-Goals:**
- ไม่ย้าย/แก้ข้อมูลเก่าใน DB (frontend normalize ครอบคลุมแล้ว)
- ไม่เปลี่ยน `PLATFORM_MAP` / labels
- ไม่แตะ widget อื่น

## Decisions

**1. Frontend normalize ตอนนับ**
- เปลี่ยน `const p = item.platform ?? 'unknown'` เป็น `const p = (item.platform ?? 'unknown').trim().toLowerCase()`

**2. Backend normalize ก่อนบันทึก**
- ใน `brand-content.php` และ `content-items.php` เปลี่ยน `$body['platform']` เป็น `strtolower(trim($body['platform'] ?? ''))` ก่อน INSERT/UPDATE
- แก้ prompt template `"platform":"Facebook"` → `"platform":"facebook"` (ใน `brand-content.php` system prompt)

## Risks / Trade-offs

- [ข้อมูลเก่าที่สะกดผิดยังอยู่ใน DB] → frontend normalize ครอบคลุมการแสดงผล; backend normalize กันข้อมูลใหม่

## Migration Plan

- Frontend + backend เท่านั้น ไม่มี DB migration
- Rollback: revert normalize (คืน `item.platform` ดิบ)
