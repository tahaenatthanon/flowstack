## 1. Backend — ตัด Quality Gate ออกจากขออนุมัติ

- [x] 1.1 `api/approvals.php`: ลบการเรียก `content_quality_gate_check()` และเงื่อนไขบล็อก 422 ([:134-152](api/approvals.php:134)) — คง SELECT content item + 404 check ไว้ (ลดเหลือ SELECT id เดียว)
- [x] 1.2 `api/content-items.php`: ลบ block การเรียก `content_quality_gate_check()` ทั้งก้อนตอนตั้ง `status=pending_approval` ([:295-312](api/content-items.php:295))

## 2. Backend — ตัด Quality Gate ออกจากเผยแพร่จริง

- [x] 2.1 `final_publish_gate_check()` ([publish-dispatch.php:286](api/lib/publish-dispatch.php:286)): ลบการเรียก `quality_required_gate()` ทั้ง 2 จุด (marker-check บรรทัด 301 และ full-evaluate บรรทัด 318) และลบ branch `SCRIPT_PLATFORMS` ที่ไม่มีความหมายอีกต่อไป — ฟังก์ชันเหลือ: Platform gate → Approval gate → Platform-selected gate → Video readiness gate → `blocked=false`
- [x] 2.2 ยืนยันว่า `api/cron/publish-scheduler.php` ไม่มีการเรียก quality gate แยกต่างหากนอกจาก `final_publish_gate_check()` — ยืนยันแล้ว ไม่มี ปรับ comment ที่ [:145](api/cron/publish-scheduler.php:145) ให้ตรงกับพฤติกรรมใหม่
- [x] 2.3 คง `content_quality_gate_check()`, `quality_required_gate()`, `quality_required_status()` ไว้ทั้งฟังก์ชันโดยไม่แก้ไข (ยังใช้ที่ Generate และมีเทสต์ตรงอ้างอิงอยู่)

## 3. Frontend — ContentDetailView: ย้ายจุดแสดง SEO/AEO

- [x] 3.1 เปลี่ยน `useEffect` fetch SEO/AEO checklist: trigger เป็น `isApproval && item.type !== 'video'` แทนการผูกกับ `approveConfirm` — dependency array เป็น `[isApproval, item.id, item.type]`
- [x] 3.2 เพิ่มส่วนแสดง `QualityChecklist` (SEO + AEO) ในเนื้อหาหลักของหน้า (หลัง `ContentArticleView`/`ContentVideoView`, ก่อน Dialog ยืนยันอนุมัติ) แสดงเมื่อ `isApproval && !isVideo && (approveGate || approveAeo)`
- [x] 3.3 ลบ UI ส่วน `approveBlocked` และ `QualityChecklist` เดิมออกจาก Dialog ยืนยันอนุมัติ — เหลือแค่ title + description ยืนยัน + ปุ่มยกเลิก/ยืนยัน
- [x] 3.4 แก้ปุ่ม "ยืนยันการอนุมัติ": เอา `approveBlocked`/`approveGateLoading` ออกจาก `disabled` เหลือแค่ `disabled={savingDecision}`
- [x] 3.5 ลบตัวแปร `approveFails`, `approveBlocked` ที่ไม่ใช้แล้ว — คง `approveGateOn` ไว้ (ยังใช้กับ `gateDisabled` prop)
- [x] 3.6 ลบ import `requiredFailedRules` และ `AlertTriangle` ที่ไม่ใช้แล้ว

## 4. Frontend — ContentApprovalTab: ตัดคอลัมน์/ปุ่มจัดการออกจากตาราง

- [x] 4.1 ลบ `<TableHead>` "จัดการ" และ `<TableCell>` ปุ่ม 3 ปุ่ม + "ดำเนินการแล้ว" ออกจากตาราง — คง `onClick={() => setDetailItem(item)}` ที่แถวไว้
- [x] 4.2 ลบ state ที่ไม่ใช้แล้ว: `reasonDialog`, `rejectReason`, `confirmApprove`, `approveGate`, `approveAeo`, `approveGateLoading`, `approveFails`, `approveGateOn`, `approveBlocked`
- [x] 4.3 ลบ `useEffect` 2 ตัวที่ผูกกับ state ข้อ 4.2 (autoResize ตาม `reasonDialog.open`, fetch SEO/AEO ตาม `confirmApprove`)
- [x] 4.4 ลบฟังก์ชัน `handleApprove` และ `handleDecision` ที่ไม่มีจุดเรียกใช้เหลือ
- [x] 4.5 ลบ Dialog ยืนยันอนุมัติ และ Dialog เหตุผล revision/rejected ทั้งสองก้อน
- [x] 4.6 ลบ import ที่ไม่ใช้แล้ว: `useRef`, `useEffect`, `useQueryClient`, `Check`, `X`, `Pencil`, `AlertTriangle`, `Loader2`, `Textarea`, `DialogFooter`, `useToast`, `contentKeys`, `apiFetch`, `requiredFailedRules`, `QualityChecklist`, `SeoChecklistResult`, `AeoChecklistResult`, และตัวแปร `toast`/`qc` ที่ไม่มีจุดใช้เหลือ — คง `XCircle` ไว้ (ยังใช้ใน stat card icon)
- [x] 4.7 รัน `pnpm lint` ยืนยันไม่มี unused-import/unused-var warning ในทั้ง 2 ไฟล์ที่แก้ (0 errors, 0 warnings ในไฟล์ที่แก้ — 48 warnings ที่เหลือทั้งหมดเป็นของเดิมในไฟล์อื่น)

## 5. อัปเดตเทสต์ backend (PHP)

- [x] 5.1 `api/tests/publish-gate-test.php` TC05, TC06: เปลี่ยน assertion `$wp['blocked'] === true` เป็น `false` — ปรับ comment/heading ของ Section B ให้ตรงกับพฤติกรรมใหม่
- [x] 5.2 `api/tests/publish-gate-test.php` TC07, TC08: เปลี่ยน assertion ที่คาดหวัง `blocked === true` เป็น `false`
- [x] 5.3 `api/tests/quality-required-tiers-test.php` QB03: เปลี่ยน `$rp['blocked']` (final_publish_gate_check) เป็น `false` — `$ra['blocked']` (content_quality_gate_check ตรงๆ) ยังคงเป็น `true` เพราะฟังก์ชันไม่เปลี่ยน
- [x] 5.4 รันทั้ง 3 ไฟล์เทสต์ผ่านหมด: `publish-gate-test.php` 18/18, `quality-required-tiers-test.php` 24/24, `publish-video-facebook-test.php` 14/14 (regression check เพิ่มเติม — ยืนยัน `final_publish_gate_check()` ที่ตัด SEO gate ออกไม่กระทบ video readiness gate)

## 6. อัปเดตเทสต์ frontend (Vitest)

- [x] 6.1 เขียนใหม่ `src/__tests__/content/ContentDetailViewApprovalGate.test.tsx` ทั้งไฟล์ — 3 เทสต์ใหม่: เห็น SEO/AEO ทันทีตอนเปิด (ไม่ต้องกด "อนุมัติ" ก่อน), กด "อนุมัติ" ได้แม้ Required failed + ไม่มี checklist ซ้ำใน dialog, วิดีโอไม่ fetch/แสดง SEO/AEO — ผ่านทั้งหมด (3/3)
- [x] 6.2 ตรวจ `src/__tests__/content/ContentApprovalTab.test.tsx` และ `ContentPageApprovalTabAccess.test.tsx` — ไม่มีการอ้างอิงปุ่ม/dialog ที่ถูกลบ ไม่ต้องแก้ไข ผ่านทั้งหมด (9/9, 3/3)
- [x] 6.3 รัน `pnpm test` ทั้งชุด — 311/319 ผ่าน, 8 fail ที่เหลือเป็น pre-existing failures ที่ไม่เกี่ยวกับ change นี้เลย (`BatchGenerateDialog`, `PullFromContentDialog`, `QuickCreateDialog.directMode`, `ResearchProviderForm` — ไฟล์เหล่านี้ไม่ได้แก้ในรอบนี้ และ `git log` ยืนยันว่าถูกแก้ครั้งล่าสุดจาก commit อื่นก่อนหน้านี้ ไม่เกี่ยวกับ approval/publish/quality)

## 7. ทดสอบจริงในเบราว์เซอร์

- [x] 7.1 เปิดแท็บ "รายการอนุมัติ" จริง — ยืนยันตารางไม่มีคอลัมน์/ปุ่มจัดการที่แถวแล้ว (เหลือแค่ ชื่อคอนเทนต์/สถานะ ที่มองเห็น)
- [x] 7.2 คลิกแถวคอนเทนต์บทความ ("AI cost management...", SEO 89/AEO 92 ไม่เต็ม 100) → เปิดหน้ารายละเอียด → เห็น SEO/AEO checklist ทันทีโดยไม่ต้องกด "อนุมัติ" ก่อน
- [x] 7.3 กด "อนุมัติ" → dialog ยืนยันไม่มี checklist ซ้ำ ไม่มีข้อความบล็อก และปุ่ม "ยืนยันการอนุมัติ" กดได้ทันที (ไม่ disabled)
- [x] 7.4 กดยืนยัน → อนุมัติสำเร็จจริง (toast "อนุมัติเรียบร้อย", stat card อนุมัติแล้ว 8→9, รออนุมัติ 4→3) แม้ SEO/AEO ไม่ผ่าน 100%
- [x] 7.5 ทดสอบคอนเทนต์วิดีโอในแท็บรายการอนุมัติ ("เจาะลึกจุดเด่น Duckkit AI Portal...") → เปิดหน้ารายละเอียดแล้วไม่มี SEO/AEO แสดงเลย (ตามดีไซน์)
- [ ] 7.6 กด "ส่งทันที" เผยแพร่คอนเทนต์ไป platform เว็บ/CMS จริง — ข้ามไว้ (ไม่มี WordPress/CMS channel ที่ต่อ credential จริงในระบบตอนนี้ นอกจาก Facebook ซึ่งเป็น social ที่ไม่เคยถูก SEO gate บล็อกอยู่แล้ว) — ครอบคลุมด้วยเทสต์ PHP (TC05-TC08, QB03) แทน
