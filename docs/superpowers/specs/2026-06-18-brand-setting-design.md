# Brand Setting Page — Design Spec

**Date:** 2026-06-18
**Status:** Approved
**Scope:** Spec 1 of 2 (Spec 2 = Lead Discovery, depends on this)

---

## Goal

ย้าย Knowledge Base, Global Instruction (field เท่านั้น), และ Product References (fields เท่านั้น) ออกจาก Content page มาอยู่ในหน้า "ตั้งค่าแบรนด์" ใหม่ เพื่อให้ระบบอื่น ๆ (เช่น Lead Discovery) สามารถใช้ข้อมูล Brand ร่วมกันได้

---

## Route & Permission

| Item | Value |
|---|---|
| Route | `/brand-setting` |
| Component | `src/pages/BrandSettingPage.tsx` |
| menuKey | `brand_setting` |
| Sidebar group | `การจัดการระบบ` |
| Sidebar label | `ตั้งค่าแบรนด์` |
| Guard | `<PermissionRoute menuKey="brand_setting">` |

**Files to update for route/permission:**
- `src/App.tsx` — เพิ่ม `<Route>` และ import
- `src/components/AppSidebar.tsx` — เพิ่ม item ใน NAV_GROUPS group `admin`
- `api/auth.php` — เพิ่ม `brand_setting` ใน `ALL_MENU_KEYS`

---

## Page Layout

หน้า `BrandSettingPage` ใช้ `PageShell` + `PageBreadcrumb` ตาม standard template เดิม

Layout เป็น **vertical scroll** 3 section ต่อเนื่อง (ไม่ใช่ tabs):

```
┌─────────────────────────────────────┐
│  ตั้งค่าแบรนด์                       │
├─────────────────────────────────────┤
│  Section 1: Knowledge Base          │
│  (reuse KnowledgeBasePage component │
│   content — CRUD articles)          │
├─────────────────────────────────────┤
│  Section 2: คำสั่งหลัก              │
│  (global_instruction textarea +     │
│   ปุ่มบันทึก)                        │
├─────────────────────────────────────┤
│  Section 3: รูปสินค้าอ้างอิง        │
│  (product_refs list: ชื่อ + URL +   │
│   เพิ่ม/ลบ — reuse AISettingsTab    │
│   product refs UI)                  │
└─────────────────────────────────────┘
```

---

## API (ไม่เปลี่ยน)

ใช้ endpoint เดิมทั้งหมด:

| Data | Endpoint |
|---|---|
| Knowledge Base articles | `api/knowledge-base.php` |
| Global Instruction + Product Refs | `api/brand-content.php` (GET/PUT `?action=global-settings`) |

ไม่สร้าง API ใหม่

---

## Content Page — สิ่งที่ต้องลบ/แก้

### `src/components/content/tabs/AISettingsTab.tsx`
- **ลบ** section `global_instruction` (textarea + label + save button)
- **ลบ** section `product_refs` (list รูปสินค้า, ปุ่มเพิ่ม/ลบ/วิเคราะห์)
- **คงไว้** image generation settings (provider, model, API key, base URL)
- **เพิ่ม** note เล็ก: `"จัดการ Global Instruction และสินค้าอ้างอิงได้ที่ ตั้งค่าแบรนด์"` พร้อม link ไป `/brand-setting`

### `src/pages/ContentPlannerPage.tsx` (หรือที่ mount KnowledgeBasePage)
- **ลบ** tab "Knowledge Base" และ route/import ที่เกี่ยวข้อง

---

## KnowledgeBasePage

- ไฟล์ `src/pages/KnowledgeBasePage.tsx` ยังคงอยู่ แต่ **ไม่ถูก mount ที่ `/content` อีกต่อไป**
- BrandSettingPage import และใช้ KnowledgeBase content โดยตรง (หรือ inline ถ้า KnowledgeBasePage มี PageShell ที่ไม่เหมาะกับการ embed — ให้ refactor ออก inner content เป็น component แยก `KnowledgeBaseContent`)

---

## Data Flow

```
BrandSettingPage
├── KnowledgeBaseContent  →  api/knowledge-base.php
├── GlobalInstructionForm →  api/brand-content.php?action=global-settings (GET/PUT)
└── ProductRefsForm       →  api/brand-content.php?action=global-settings (GET/PUT)
```

---

## Out of Scope

- ไม่ย้าย image generation settings
- ไม่เปลี่ยน API
- ไม่เพิ่ม version history หรือ approval workflow สำหรับ Brand content
- Lead Discovery (Spec 2 แยกต่างหาก)

---

## Success Criteria

1. หน้า `/brand-setting` โหลดได้ มี 3 section ครบ
2. CRUD Knowledge Base ทำงานได้จากหน้าใหม่
3. บันทึก Global Instruction และ Product Refs ได้ และค่าสะท้อนใน Content AI generation ทันที
4. Content page ไม่มี tab Knowledge Base และไม่มี field global_instruction / product_refs อีกต่อไป
5. Link "ตั้งค่าแบรนด์" ใน AISettingsTab นำทางไปหน้าใหม่ได้
6. Permission `brand_setting` ใช้งานได้ผ่าน role management ปกติ
