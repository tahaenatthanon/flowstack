## Context

ฟังก์ชัน "รายการอนุมัติ" ถูก refactor ให้เป็นคอมโพเนนต์ `ContentApprovalTab` (ไม่มี `PageShell`) และถูกฝังเป็น Tab ในหน้า `/content` แล้ว:

- `src/pages/ContentPage.tsx` — มี `<Tabs defaultValue="content">` โดยมี `TabsTrigger value="approval"` → `<TabsContent value="approval"><ContentApprovalTab /></TabsContent>`
- `src/pages/ContentApprovalPage.tsx` — หน้าแยกที่ render `<PageShell>...</PageShell>` ห่อ `<ContentApprovalTab />` (ซ้ำซ้อนกับ Tab)
- `src/App.tsx` — มี lazy import + `<Route path="/content-approval" menuKey="content_approval">`
- `src/pages/ContentDashboardPage.tsx` — ปุ่ม "ดูรายการอนุมัติทั้งหมด" navigate ไป `/content-approval`
- ไม่มีเมนู Sidebar ชี้ไป `/content-approval` (ตรวจแล้ว)

## Goals / Non-Goals

**Goals:**
- เอา route `/content-approval` + หน้า + test ออกจากระบบ
- เปลี่ยนปุ่มลัดในคิวรออนุมัติให้ไปที่ Tab "รายการอนุมัติ" ใน `/content`
- ทำให้ `/content` เปิด Tab "รายการอนุมัติ" ได้ผ่าน URL query

**Non-Goals:**
- ไม่แก้ `ContentApprovalTab.tsx` (ยังใช้ใน Tab)
- ไม่ลบ menuKey `content_approval` ใน `api/auth.php` (คงไว้ ไม่กระทบข้อมูล permission เดิม)
- ไม่แตะ API / DB / hooks

## Decisions

**1. ลบ route + lazy import + หน้า + test**
- ลบ `<Route path="/content-approval" ...>` และ `const ContentApprovalPage = lazy(...)` ใน `src/App.tsx`
- ลบไฟล์ `src/pages/ContentApprovalPage.tsx` และ `src/__tests__/content/ContentApprovalPage.test.tsx`

**2. เปิด Tab "รายการอนุมัติ" ผ่าน URL query**
- `ContentPage.tsx` ใช้ `useSearchParams()` อ่าน param `tab`; ถ้า `tab === 'approval'` ตั้ง `defaultValue`/state เป็น `'approval'`
- ใช้ `<Tabs value={activeTab} onValueChange={...}>` (controlled) แทน `defaultValue` เพื่อรองรับการเปิดจาก URL

**3. ปุ่มลัด "ดูรายการ" ในคิวรออนุมัติ**
- เปลี่ยน `navigate('/content-approval')` → `navigate('/content?tab=approval')`
- URL จริง: `http://localhost:8080/#/content?tab=approval`

## Risks / Trade-offs

- [การเปิด Tab จาก URL ต้องเปลี่ยน Tabs เป็น controlled] → ใช้ `useState` + `useSearchParams` เริ่มต้นค่า; พฤติกรรมเดิม (default "content") คงเดิมเมื่อไม่มี param
- [menuKey `content_approval` กลายเป็น orphan] → คงไว้ ไม่ลบ เพื่อหลีกเลี่ยงการกระทบ `role_menu_permissions` เดิม; cleanup ในภายหลังถ้าจำเป็น

## Migration Plan

- เปลี่ยนเฉพาะ frontend — ไม่มี DB/API migration
- Rollback: คืน route + หน้า + import กลับ, revert ปุ่มลัดเป็น `/content-approval`
