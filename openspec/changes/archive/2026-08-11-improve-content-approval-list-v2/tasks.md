## 1. Database Migration

- [x] 1.1 Create migration file `database/migrations/YYYY_MM_DD_HHMMSS_add_reject_reason.sql`
- [x] 1.2 Add `ALTER TABLE content_items ADD COLUMN reject_reason TEXT NULL AFTER status`
- [x] 1.3 Execute migration against local MariaDB
- [x] 1.4 Verify column exists: `SHOW COLUMNS FROM content_items LIKE 'reject_reason'`

## 2. Backend API

- [x] 2.1 Add `reject_reason` to `$allowed` array in `api/content-items.php` PUT handler (line ~74)
- [x] 2.2 Verify PUT endpoint accepts and stores `reject_reason`

## 3. ContentDetailView — Context Prop & Conditional Buttons

- [x] 3.1 Add `context?: 'approval' | 'content'` prop to `ContentDetailView` interface
- [x] 3.2 When `context='approval'`: hide buttons — "สร้างเนื้อหา AI", "สร้างภาพทุกฉาก", "สร้างวิดีโอ"
- [x] 3.3 When `context='approval'`: hide buttons — "แก้ไข", "ตั้งเวลาโพสต์" (มุมขวาบน)
- [x] 3.4 When `context='approval'` and `item.status === 'review'`: show buttons — "อนุมัติ", "ขอแก้ไข", "ปฏิเสธ" in action bar
- [x] 3.5 Implement `handleApproveFromDetail`, `handleRevisionRequest`, `handleRejectFromDetail` with toast & query invalidation

## 4. ContentApprovalPage — Full Content Detail

- [x] 4.1 Update detail dialog to pass `context='approval'` to `ContentDetailView`
- [x] 4.2 Ensure dialog is `max-w-4xl max-h-[90vh] overflow-y-auto` for full content visibility
- [x] 4.3 Remove sr-only from DialogHeader — show proper title "รายละเอียดคอนเทนต์"

## 5. ContentListTab — Approval Action Buttons

- [x] 5.1 Add state: `approveConfirm`, `revisionDialog` (dialog for revision reason), `rejectDialog` to `ContentListTab`
- [x] 5.2 When `item.status === 'review'`: show buttons — อนุมัติ (Check icon, green), ขอแก้ไข (Pencil icon, amber/orange), ปฏิเสธ (X icon, red) in hover actions
- [x] 5.3 Implement `handleApprove(item)` — PUT status: 'published', toast "อนุมัติเรียบร้อย"
- [x] 5.4 Implement `handleRequestRevision(item, reason)` — PUT status: 'revision' + reject_reason, toast "ขอแก้ไขแล้ว"
- [x] 5.5 Implement `handleReject(item, reason)` — PUT status: 'rejected' + reject_reason, toast "ปฏิเสธแล้ว"
- [x] 5.6 Create ConfirmApproveDialog, RevisionReasonDialog, RejectReasonDialog components (or reuse existing)
- [x] 5.7 Ensure non-review items don't show approval buttons

## 6. ImageViewer — Fix Hover Container Size

- [x] 6.1 Remove `min-h-[60vh]` from dialog content container
- [x] 6.2 Change image container to use `max-w-[90vw] max-h-[90vh]` with `flex items-center justify-center`
- [x] 6.3 Ensure image uses `object-contain` within its natural dimensions
- [x] 6.4 Verify hover on thumbnails in ContentListTab doesn't expand container beyond image size

## 7. Integration & Verification

- [x] 7.1 Run `pnpm build` and verify no TypeScript errors
- [x] 7.2 Run `pnpm lint` and verify no ESLint errors
- [ ] 7.3 Manual test: Approve from Content List → verify status changes to published
- [ ] 7.4 Manual test: Request revision from Content List → verify status changes to revision
- [ ] 7.5 Manual test: Reject from Content List → verify status changes to rejected + reason stored
- [ ] 7.6 Manual test: View detail from Approval Page → verify full content displayed + correct action buttons
- [x] 7.7 Manual test: Image hover → verify container doesn't expand beyond image
- [x] 7.9 Manual test: ContentDetailView from Content Page (context='content') — verify no regression (edit/schedule/AI buttons still work)
